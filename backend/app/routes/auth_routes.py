"""
Authentication Routes
User registration, login, and profile management.
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..auth import (
    UserCreate, UserLogin, UserResponse, Token, RefreshToken,
    create_access_token, create_refresh_token, authenticate_user, create_user,
    get_user_by_email, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES,
    decode_refresh_token, get_user_by_id
)
from ..db_models import User

router = APIRouter()


@router.post("/register", response_model=Token)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Register a new user.
    
    POST /auth/register
    
    - Validates email uniqueness
    - Hashes password
    - Creates user with specified role
    - Returns JWT token
    """
    # Check if user exists
    existing = await get_user_by_email(db, user_data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Validate role
    if user_data.role not in ["teacher", "student"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'teacher' or 'student'"
        )
    
    # Create user
    user = await create_user(db, user_data)
    
    # Generate token
    access_token = create_access_token(
        data={
            "user_id": str(user.id),
            "email": user.email,
            "role": user.role
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    refresh_token = create_refresh_token(
        data={
            "user_id": str(user.id),
            "email": user.email,
            "role": user.role
        }
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    )


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Login with email and password.
    
    POST /auth/login
    
    Returns JWT token on success.
    """
    user = await authenticate_user(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    access_token = create_access_token(
        data={
            "user_id": str(user.id),
            "email": user.email,
            "role": user.role
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    refresh_token = create_refresh_token(
        data={
            "user_id": str(user.id),
            "email": user.email,
            "role": user.role
        }
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    )


@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    token_data: RefreshToken,
    db: AsyncSession = Depends(get_db)
):
    """Refresh an access token using a refresh token."""
    token_info = decode_refresh_token(token_data.refresh_token)
    if not token_info or not token_info.user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = await get_user_by_id(db, token_info.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"}
        )

    access_token = create_access_token(
        data={
            "user_id": str(user.id),
            "email": user.email,
            "role": user.role
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    refresh_token = create_refresh_token(
        data={
            "user_id": str(user.id),
            "email": user.email,
            "role": user.role
        }
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    )


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """
    Get current user's profile.
    
    GET /auth/me
    
    Requires authentication.
    """
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        role=current_user.role
    )


@router.get("/verify")
async def verify_token(current_user: User = Depends(get_current_user)):
    """
    Verify if token is valid.
    
    GET /auth/verify
    
    Returns 200 if token is valid, 401 otherwise.
    """
    return {"valid": True, "user_id": str(current_user.id), "role": current_user.role}


@router.post("/demo", response_model=Token)
async def demo_login(db: AsyncSession = Depends(get_db)):
    """
    Quick demo login - no credentials needed!
    
    POST /auth/demo
    
    Creates or retrieves a demo teacher account for easy MVP testing.
    Perfect for quick demos without registration hassle.
    """
    from ..auth import get_password_hash
    
    demo_email = "demo@quizly.app"
    demo_password = "demo123"  # Fixed password for demo account
    
    # Check if demo user exists
    user = await get_user_by_email(db, demo_email)
    
    if not user:
        # Create demo teacher account
        user = User(
            email=demo_email,
            name="Demo Teacher",
            hashed_password=get_password_hash(demo_password),
            role="teacher"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    # Generate tokens
    access_token = create_access_token(
        data={
            "user_id": str(user.id),
            "email": user.email,
            "role": user.role
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    refresh_token = create_refresh_token(
        data={
            "user_id": str(user.id),
            "email": user.email,
            "role": user.role
        }
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    )
