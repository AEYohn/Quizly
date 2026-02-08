"""
Clerk Authentication Module
Verifies Clerk JWTs and syncs users to local database.
"""

import os
import httpx
import jwt
from typing import Optional, Tuple
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .database import get_db
from .db_models import User

# Configuration
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
# Clerk's JWKS endpoint for token verification
CLERK_JWKS_URL = None  # Will be derived from the token issuer

# Bearer token security
clerk_security = HTTPBearer(auto_error=False)

# Cache for JWKS keys
_jwks_cache: dict = {}
_jwks_cache_time: float = 0
JWKS_CACHE_TTL = 3600  # 1 hour


class ClerkTokenPayload(BaseModel):
    """Clerk token payload data."""
    user_id: str  # Clerk user ID (sub claim)
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    image_url: Optional[str] = None
    role: Optional[str] = None  # From publicMetadata


class ClerkUserSync(BaseModel):
    """Request to sync Clerk user to local DB."""
    clerk_user_id: str
    email: Optional[str] = None
    name: str
    role: str = "student"


async def fetch_jwks(issuer: str) -> dict:
    """Fetch JWKS from Clerk's endpoint."""
    global _jwks_cache, _jwks_cache_time

    current_time = datetime.now(timezone.utc).timestamp()

    # Return cached JWKS if still valid
    if _jwks_cache and (current_time - _jwks_cache_time) < JWKS_CACHE_TTL:
        return _jwks_cache

    # Fetch fresh JWKS
    jwks_url = f"{issuer}/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        response = await client.get(jwks_url)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_cache_time = current_time
        return _jwks_cache


def get_public_key_from_jwks(jwks: dict, kid: str):
    """Extract public key from JWKS matching the key ID."""
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return jwt.algorithms.RSAAlgorithm.from_jwk(key)
    return None


async def verify_clerk_token(token: str) -> Optional[ClerkTokenPayload]:
    """
    Verify a Clerk JWT token.

    Clerk tokens use RS256 and can be verified using their JWKS endpoint.
    """
    try:
        # First, decode without verification to get the header and issuer
        unverified_header = jwt.get_unverified_header(token)
        unverified_payload = jwt.decode(token, options={"verify_signature": False})

        kid = unverified_header.get("kid")
        issuer = unverified_payload.get("iss")

        if not kid or not issuer:
            return None

        # Fetch JWKS and get the public key
        jwks = await fetch_jwks(issuer)
        public_key = get_public_key_from_jwks(jwks, kid)

        if not public_key:
            return None

        # Verify the token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=None,  # Clerk doesn't always set audience
            options={"verify_aud": False}
        )

        # Extract user info from payload
        # Clerk tokens have user info in different places depending on configuration
        user_id = payload.get("sub")

        # Session claims (if using Clerk's session tokens)
        email = payload.get("email") or payload.get("primary_email_address")
        first_name = payload.get("first_name")
        last_name = payload.get("last_name")
        full_name = payload.get("full_name") or payload.get("name")
        image_url = payload.get("image_url") or payload.get("profile_image_url")

        # Get role from public metadata
        public_metadata = payload.get("public_metadata", {}) or {}
        role = public_metadata.get("role", "student")

        # Build full name if not provided
        if not full_name and (first_name or last_name):
            full_name = f"{first_name or ''} {last_name or ''}".strip()

        return ClerkTokenPayload(
            user_id=user_id,
            email=email,
            first_name=first_name,
            last_name=last_name,
            full_name=full_name,
            image_url=image_url,
            role=role
        )

    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception as e:
        print(f"Clerk token verification error: {e}")
        return None


async def get_user_by_clerk_id(db: AsyncSession, clerk_user_id: str) -> Optional[User]:
    """Get a user by their Clerk user ID."""
    result = await db.execute(
        select(User).where(User.clerk_user_id == clerk_user_id)
    )
    return result.scalars().first()


async def get_or_create_user_from_clerk(
    db: AsyncSession,
    clerk_payload: ClerkTokenPayload
) -> User:
    """
    Get existing user or create new one from Clerk token payload.

    This syncs Clerk users to the local database, creating a new user
    if they don't exist or updating if they do.
    """
    # Try to find existing user by Clerk ID
    user = await get_user_by_clerk_id(db, clerk_payload.user_id)

    if user:
        # Update user info if changed
        name = clerk_payload.full_name or clerk_payload.email or "User"
        if user.name != name or (clerk_payload.email and user.email != clerk_payload.email):
            user.name = name
            if clerk_payload.email:
                user.email = clerk_payload.email
            await db.commit()
            await db.refresh(user)
        return user

    # Also check by email (for users who existed before Clerk integration)
    if clerk_payload.email:
        result = await db.execute(
            select(User).where(User.email == clerk_payload.email)
        )
        existing_user = result.scalars().first()
        if existing_user:
            # Link existing user to Clerk
            existing_user.clerk_user_id = clerk_payload.user_id
            await db.commit()
            await db.refresh(existing_user)
            return existing_user

    # Create new user - handle race condition with try/except
    name = clerk_payload.full_name or clerk_payload.email or "User"
    role = clerk_payload.role or "student"

    new_user = User(
        email=clerk_payload.email,
        name=name,
        role=role,
        clerk_user_id=clerk_payload.user_id,
        hashed_password=None  # Clerk handles auth, no password needed
    )
    db.add(new_user)

    try:
        await db.commit()
        await db.refresh(new_user)
        return new_user
    except Exception as e:
        # Race condition: another request created the user first
        # Rollback and fetch the existing user
        await db.rollback()
        result = await db.execute(
            select(User).where(User.clerk_user_id == clerk_payload.user_id)
        )
        existing_user = result.scalars().first()
        if existing_user:
            return existing_user
        # If still not found, re-raise the original error
        raise e


async def get_current_user_clerk(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(clerk_security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    FastAPI dependency to get current user from Clerk token.

    This verifies the Clerk JWT and returns the corresponding local user,
    creating one if necessary.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise credentials_exception

    clerk_payload = await verify_clerk_token(credentials.credentials)
    if not clerk_payload:
        raise credentials_exception

    user = await get_or_create_user_from_clerk(db, clerk_payload)
    return user


async def get_current_user_clerk_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(clerk_security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    FastAPI dependency to get current user from Clerk token (optional).

    Returns None if not authenticated instead of raising an exception.
    """
    if not credentials:
        return None

    clerk_payload = await verify_clerk_token(credentials.credentials)
    if not clerk_payload:
        return None

    user = await get_or_create_user_from_clerk(db, clerk_payload)
    return user


async def require_teacher_clerk(user: User = Depends(get_current_user_clerk)) -> User:
    """Require current Clerk user to be a teacher."""
    if user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher access required"
        )
    return user


async def require_student_clerk(user: User = Depends(get_current_user_clerk)) -> User:
    """Require current Clerk user to be a student."""
    if user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )
    return user


async def resolve_student_identity(
    student_name: Optional[str] = Query(default=None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(clerk_security),
    db: AsyncSession = Depends(get_db),
) -> Tuple[str, Optional[User]]:
    """
    Resolve the authoritative student identity.

    - Authenticated (valid JWT): ignore client student_name, return (user.name, user)
    - Guest (no token, name starts with 'guest_'): return (student_name, None)
    - Otherwise: raise 401
    """
    # Try to authenticate via JWT
    if credentials:
        clerk_payload = await verify_clerk_token(credentials.credentials)
        if clerk_payload:
            user = await get_or_create_user_from_clerk(db, clerk_payload)
            return (user.name, user)

    # No valid token — allow guest access only with guest_ prefix
    if student_name and student_name.startswith("guest_"):
        return (student_name, None)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def verify_session_ownership(
    session_id: str,
    identity: Tuple[str, Optional[User]],
    db: AsyncSession,
):
    """
    Load a LearningSession by ID and verify the current user owns it.

    Raises 404 if session not found, 403 if not owned by current user.
    """
    import uuid as _uuid
    from .db_models import LearningSession

    try:
        session_uuid = _uuid.UUID(session_id) if isinstance(session_id, str) else session_id
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_uuid)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    student_name, user = identity
    if session.student_name != student_name:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access another user's session",
        )

    return session


async def verify_websocket_token(token: str) -> Optional[ClerkTokenPayload]:
    """
    Verify a Clerk JWT token for WebSocket connections.

    Returns the token payload if valid, None if invalid.
    Used for WS connections where we can't use HTTP Bearer auth.
    """
    return await verify_clerk_token(token)
