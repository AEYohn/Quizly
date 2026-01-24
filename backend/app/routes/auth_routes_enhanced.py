"""
Enhanced Authentication Routes with OAuth2 and refresh tokens.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..auth_enhanced import (
    UserCreate, UserResponse, UserLogin, AuthResponse, Token, TokenRefresh,
    create_user, authenticate_user, get_current_user,
    generate_tokens, decode_refresh_token, get_user_by_id
)
from ..db_models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user account.
    
    - **email**: Valid email address (must be unique)
    - **password**: Password (min 6 characters recommended)
    - **name**: Display name
    - **role**: Either "student" or "teacher"
    """
    user = await create_user(db, user_data)
    tokens = generate_tokens(user)
    
    return AuthResponse(
        **tokens,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            name=user.name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at
        )
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """
    Login with email and password.
    
    Returns access token (short-lived) and refresh token (long-lived).
    """
    user = await authenticate_user(db, login_data.email, login_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    tokens = generate_tokens(user)
    
    return AuthResponse(
        **tokens,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            name=user.name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at
        )
    )


@router.post("/login/form", response_model=Token)
async def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    OAuth2 compatible login endpoint using form data.
    
    Use this endpoint for OAuth2 password flow (e.g., Swagger UI).
    """
    user = await authenticate_user(db, form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    tokens = generate_tokens(user)
    return Token(**tokens)


@router.post("/refresh", response_model=Token)
async def refresh_token(
    token_data: TokenRefresh,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a new access token using a refresh token.
    
    Refresh tokens are long-lived (7 days) and can be used to get new access tokens
    without requiring the user to login again.
    """
    token_info = decode_refresh_token(token_data.refresh_token)
    
    if not token_info or not token_info.user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = await get_user_by_id(db, token_info.user_id)
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    tokens = generate_tokens(user)
    return Token(**tokens)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get the current authenticated user's information.
    """
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )


@router.post("/logout")
async def logout():
    """
    Logout endpoint (client-side token invalidation).
    
    Note: JWT tokens are stateless, so true server-side logout would require
    a token blacklist. For now, clients should discard their tokens.
    
    Future enhancement: Implement Redis-based token blacklist.
    """
    return {"message": "Successfully logged out. Please discard your tokens."}


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    name: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update the current user's profile.
    """
    if name:
        current_user.name = name
        await db.commit()
        await db.refresh(current_user)
    
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )
