"""
Quizly Backend Application
FastAPI server for classroom session management.
"""

from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()  # Load .env file before other imports

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import uuid
from sqlalchemy import text

from .routes import auth_routes, session_routes, response_routes, analytics_routes, ai_routes, curriculum_routes, live_session_routes, adaptive_routes, quiz_routes, game_routes, websocket_routes, auth_routes_enhanced, explore_routes, course_routes, coding_routes, code_routes, host_routes, student_routes, student_learning_routes, assignment_routes, auth_clerk_routes, student_quiz_routes, library_routes
from .rate_limiter import limiter
from .exceptions import QuizlyException, quizly_exception_handler
from .logging_config import setup_logging, get_logger, set_request_context, clear_request_context, log_info, log_error
from .metrics import get_metrics, get_metrics_content_type, track_request_start, track_request_end, track_error

# Import slowapi for rate limiting
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# Setup structured logging
setup_logging()
logger = get_logger("quizly.main")


# Database lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - database connections etc."""
    # Startup
    log_info(logger, "Starting Quizly API", version="0.1.0")

    # Initialize database (always - SQLite for local, PostgreSQL for production)
    try:
        from .database import init_db, close_db
        from .db_models import Base  # noqa: Import models to register them

        log_info(logger, "Initializing database")
        await init_db()
        log_info(logger, "Database connected")

        # Run pending migrations
        try:
            from .database import engine
            from sqlalchemy import text
            async with engine.begin() as conn:
                # Add course_id to quizzes if not exists
                await conn.execute(text("""
                    ALTER TABLE quizzes
                    ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
                """))
                # Add timer columns to game_sessions if not exists
                await conn.execute(text("""
                    ALTER TABLE game_sessions
                    ADD COLUMN IF NOT EXISTS timer_end_at TIMESTAMPTZ;
                """))
                await conn.execute(text("""
                    ALTER TABLE game_sessions
                    ADD COLUMN IF NOT EXISTS timer_duration INTEGER;
                """))
                log_info(logger, "Database migrations complete")
        except Exception as e:
            log_info(logger, f"Migration note: {e}")

    except ImportError as e:
        log_error(logger, "Database not configured", error=str(e))
    except Exception as e:
        log_error(logger, "Database connection failed", error=str(e))

    # Initialize WebSocket manager (Redis if configured)
    try:
        from .websocket_manager import initialize_manager
        await initialize_manager()
        log_info(logger, "WebSocket manager initialized")
    except Exception as e:
        log_error(logger, "WebSocket manager initialization failed", error=str(e))

    yield  # Application runs here

    # Shutdown
    log_info(logger, "Shutting down Quizly API")

    # Close WebSocket manager
    try:
        from .websocket_manager import close_manager
        await close_manager()
    except Exception:
        pass

    try:
        from .database import close_db
        await close_db()
    except Exception:
        pass


# Create FastAPI app
app = FastAPI(
    title="Quizly API",
    description="AI-powered peer instruction platform API",
    version="0.1.0",
    lifespan=lifespan,
    redirect_slashes=False,  # Don't redirect /quizzes/ to /quizzes (breaks POST requests)
)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add standardized Quizly exception handler
app.add_exception_handler(QuizlyException, quizly_exception_handler)

# CORS configuration
# Allow both dev ports by default so the frontend (3000/3001) can reach the API during development
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in origins else origins,  # Support wildcard
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request context middleware for logging and metrics
@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    """Add request ID, logging context, and track metrics."""
    import time

    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
    set_request_context(request_id)

    # Normalize endpoint for metrics (avoid cardinality explosion)
    endpoint = request.url.path
    # Replace UUIDs and IDs with placeholders
    import re
    endpoint = re.sub(r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "/{id}", endpoint)
    endpoint = re.sub(r"/\d+", "/{id}", endpoint)

    method = request.method
    start_time = time.perf_counter()

    # Skip metrics tracking for /metrics endpoint itself
    if endpoint != "/metrics":
        track_request_start(method, endpoint)

    try:
        response = await call_next(request)
        duration = time.perf_counter() - start_time

        if endpoint != "/metrics":
            track_request_end(method, endpoint, response.status_code, duration)

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception as e:
        duration = time.perf_counter() - start_time
        if endpoint != "/metrics":
            track_request_end(method, endpoint, 500, duration)
            track_error(type(e).__name__, endpoint)
        raise
    finally:
        clear_request_context()

# Include routers
app.include_router(auth_routes.router, prefix="/auth", tags=["authentication"])
app.include_router(session_routes.router, prefix="/sessions", tags=["sessions"])
app.include_router(response_routes.router, prefix="/responses", tags=["responses"])
app.include_router(analytics_routes.router, prefix="/analytics", tags=["analytics"])
app.include_router(ai_routes.router, prefix="/ai", tags=["ai"])
app.include_router(curriculum_routes.router, prefix="/curriculum", tags=["curriculum"])
app.include_router(live_session_routes.router, prefix="/live-sessions", tags=["live-sessions"])
app.include_router(adaptive_routes.router, prefix="/adaptive", tags=["adaptive-learning"])
app.include_router(quiz_routes.router, prefix="/quizzes", tags=["quizzes"])
app.include_router(game_routes.router, prefix="/games", tags=["games"])
# WebSocket routes (no prefix - they use /ws/game/...)
app.include_router(websocket_routes.router, tags=["websocket"])
# Enhanced auth (with refresh tokens) - mounted under /auth-v2 to avoid clashing
app.include_router(auth_routes_enhanced.router, prefix="/auth-v2", tags=["authentication-v2"])
# Clerk auth routes
app.include_router(auth_clerk_routes.router, prefix="/auth/clerk", tags=["authentication-clerk"])
# Explore/Marketplace routes
app.include_router(explore_routes.router, tags=["explore"])
# Course routes (Canvas-style)
app.include_router(course_routes.router, prefix="/courses", tags=["courses"])
# Coding problems routes (LeetCode-style)
app.include_router(coding_routes.router, prefix="/coding", tags=["coding"])
# Code execution routes
app.include_router(code_routes.router, tags=["code-execution"])
# AI Game Host routes
app.include_router(host_routes.router, tags=["game-host"])
# Student learning profile routes
app.include_router(student_routes.router, prefix="/students", tags=["student-learning"])
# Student learning features (exit tickets, misconceptions, adaptive learning)
app.include_router(student_learning_routes.router, prefix="/student-learning", tags=["student-learning-features"])

app.include_router(assignment_routes.router, tags=["assignments"])
# Student self-study quiz routes
app.include_router(student_quiz_routes.router, prefix="/student", tags=["student-quizzes"])
# Student library routes
app.include_router(library_routes.router, prefix="/library", tags=["library"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "healthy", "service": "Quizly API", "version": "0.1.0"}


@app.get("/health")
async def health_check():
    """Detailed health check."""
    db_status = "not_configured"
    gemini_status = "not_configured"

    # Check database
    if os.getenv("DATABASE_URL"):
        try:
            from .database import async_session
            async with async_session() as session:
                await session.execute(text("SELECT 1"))
                db_status = "connected"
        except Exception as e:
            db_status = f"error: {str(e)[:50]}"

    # Check Gemini
    if os.getenv("GEMINI_API_KEY"):
        gemini_status = "configured"

    return {
        "status": "healthy",
        "database": db_status,
        "gemini": gemini_status,
        "version": "0.1.0"
    }


@app.get("/health/ready")
async def readiness_check():
    """Readiness check for load balancers and orchestration.

    Returns 200 only if all critical dependencies are available.
    Returns 503 if any dependency is unavailable.
    """
    checks = {
        "database": {"status": "unchecked", "latency_ms": None},
        "redis": {"status": "unchecked", "latency_ms": None},
    }
    all_healthy = True

    # Check database
    import time
    db_start = time.monotonic()
    try:
        from .database import async_session
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
            checks["database"]["status"] = "healthy"
            checks["database"]["latency_ms"] = round((time.monotonic() - db_start) * 1000, 2)
    except Exception as e:
        checks["database"]["status"] = "unhealthy"
        checks["database"]["error"] = str(e)[:100]
        all_healthy = False

    # Check Redis (if configured)
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        redis_start = time.monotonic()
        try:
            import redis.asyncio as redis_client
            r = redis_client.from_url(redis_url, decode_responses=True)
            await r.ping()
            await r.close()
            checks["redis"]["status"] = "healthy"
            checks["redis"]["latency_ms"] = round((time.monotonic() - redis_start) * 1000, 2)
        except Exception as e:
            checks["redis"]["status"] = "unhealthy"
            checks["redis"]["error"] = str(e)[:100]
            all_healthy = False
    else:
        checks["redis"]["status"] = "not_configured"

    status_code = 200 if all_healthy else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "ready": all_healthy,
            "checks": checks,
            "version": "0.1.0"
        }
    )


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    from fastapi.responses import Response
    return Response(
        content=get_metrics(),
        media_type=get_metrics_content_type()
    )
