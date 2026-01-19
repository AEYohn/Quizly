"""
Quizly Backend Application
FastAPI server for classroom session management.
"""

from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()  # Load .env file before other imports

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .routes import session_routes, response_routes, analytics_routes, ai_routes, curriculum_routes, live_session_routes


# Database lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - database connections etc."""
    # Startup
    print("🚀 Starting Quizly API...")
    
    # Try to import and initialize database
    try:
        from .database import init_db, close_db
        from .db_models import Base  # noqa: Import models to register them
        
        if os.getenv("DATABASE_URL"):
            print("📦 Initializing database...")
            await init_db()
            print("✅ Database connected")
    except ImportError:
        print("⚠️ Database not configured (missing asyncpg)")
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
)

# CORS configuration
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in origins else origins,  # Support wildcard
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(session_routes.router, prefix="/sessions", tags=["sessions"])
app.include_router(response_routes.router, prefix="/responses", tags=["responses"])
app.include_router(analytics_routes.router, prefix="/analytics", tags=["analytics"])
app.include_router(ai_routes.router, prefix="/ai", tags=["ai"])
app.include_router(curriculum_routes.router, prefix="/curriculum", tags=["curriculum"])
app.include_router(live_session_routes.router, prefix="/live-sessions", tags=["live-sessions"])


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
                await session.execute("SELECT 1")
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
