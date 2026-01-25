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
from sqlalchemy import text

from .routes import auth_routes, session_routes, response_routes, analytics_routes, ai_routes, curriculum_routes, live_session_routes, adaptive_routes, quiz_routes, game_routes, websocket_routes, auth_routes_enhanced, explore_routes, course_routes, coding_routes, code_routes, host_routes, student_routes
from .rate_limiter import limiter

# Import slowapi for rate limiting
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded


# Database lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - database connections etc."""
    # Startup
    print("🚀 Starting Quizly API...")
    
    # Initialize database (always - SQLite for local, PostgreSQL for production)
    try:
        from .database import init_db, close_db
        from .db_models import Base  # noqa: Import models to register them
        
        print("📦 Initializing database...")
        await init_db()
        print("✅ Database connected")
    except ImportError as e:
        print(f"⚠️ Database not configured (missing dependency): {e}")
    except Exception as e:
        print(f"⚠️ Database connection failed: {e}")
    
    yield  # Application runs here
    
    # Shutdown
    print("👋 Shutting down Quizly API...")
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
