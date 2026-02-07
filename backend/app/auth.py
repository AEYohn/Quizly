# DEPRECATED: This auth module is superseded by Clerk auth (auth_clerk.py).
# Some route files may still import get_current_user from here during migration.
# Target: migrate all remaining imports to auth_clerk equivalents, then delete.
"""
Authentication Module (DEPRECATED)
Legacy JWT-based authentication with teacher/student roles.
Superseded by Clerk auth (auth_clerk.py).
"""

import os
import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .database import get_db
from .db_models import User

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY", "your-refresh-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token security
security = HTTPBearer(auto_error=False)


# ==============================================================================
# Schemas
# ==============================================================================

class TokenData(BaseModel):
    """Token payload data."""
    user_id: str
    email: str
    role: str  # "teacher" or "student"
    exp: datetime


class Token(BaseModel):
    """Token response."""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = None
    user: dict


class RefreshToken(BaseModel):
    """Refresh token request."""
    refresh_token: str


class UserCreate(BaseModel):
    """User registration request."""
    email: str
    password: str
    name: str
    role: str = "student"  # default to student


class UserLogin(BaseModel):
    """User login request."""
    email: str
    password: str


class UserResponse(BaseModel):
    """User data response."""
    id: str
    email: str
    name: str
    role: str


# ==============================================================================
# Password Utilities
# ==============================================================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


# ==============================================================================
# Token Utilities
# ==============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a refresh token with longer expiry."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, REFRESH_SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[TokenData]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenData(
            user_id=payload.get("user_id"),
            email=payload.get("email"),
            role=payload.get("role"),
            exp=datetime.fromtimestamp(payload.get("exp"))
        )
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[TokenData]:
    """Decode and validate a refresh token."""
    try:
        payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") and payload.get("type") != "refresh":
            return None
        return TokenData(
            user_id=payload.get("user_id"),
            email=payload.get("email"),
            role=payload.get("role"),
            exp=datetime.fromtimestamp(payload.get("exp"))
        )
    except JWTError:
        return None


# ==============================================================================
# User Database Operations
# ==============================================================================

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Get a user by email."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalars().first()


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    """Get a user by ID."""
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        return None
    result = await db.execute(select(User).where(User.id == user_uuid))
    return result.scalars().first()


async def create_user(db: AsyncSession, user_data: UserCreate) -> User:
    """Create a new user."""
    hashed_password = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        name=user_data.name,
        hashed_password=hashed_password,
        role=user_data.role
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    """Authenticate a user with email and password."""
    user = await get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


# ==============================================================================
# Dependency Injection
# ==============================================================================

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Get current user if authenticated, None otherwise."""
    if not credentials:
        return None
    
    token_data = decode_token(credentials.credentials)
    if not token_data:
        return None
    
    user = await get_user_by_email(db, token_data.email)
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user (required)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not credentials:
        raise credentials_exception
    
    token_data = decode_token(credentials.credentials)
    if not token_data:
        raise credentials_exception
    
    user = await get_user_by_email(db, token_data.email)
    if not user:
        raise credentials_exception
    
    return user


async def require_teacher(user: User = Depends(get_current_user)) -> User:
    """Require current user to be a teacher."""
    if user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher access required"
        )
    return user


async def require_student(user: User = Depends(get_current_user)) -> User:
    """Require current user to be a student."""
    if user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )
    return user


# Alias for explore routes
get_optional_user = get_current_user_optional
