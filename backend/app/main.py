"""
Quizly Backend Application
FastAPI server for classroom session management.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .routes import session_routes, response_routes, analytics_routes

# Create FastAPI app
app = FastAPI(
    title="Quizly API",
    description="AI-powered peer instruction platform API",
    version="0.1.0"
)

# CORS configuration
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(session_routes.router, prefix="/sessions", tags=["sessions"])
app.include_router(response_routes.router, prefix="/responses", tags=["responses"])
app.include_router(analytics_routes.router, prefix="/analytics", tags=["analytics"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "healthy", "service": "Quizly API", "version": "0.1.0"}


@app.get("/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "not_configured",
        "redis": "not_configured"
    }
