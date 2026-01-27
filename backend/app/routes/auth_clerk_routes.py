"""
Clerk Authentication Routes
Sync Clerk users to local database and provide user info.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..db_models import User
from ..auth_clerk import (
    get_current_user_clerk,
    get_or_create_user_from_clerk,
    ClerkTokenPayload,
    verify_clerk_token,
    get_user_by_clerk_id,
)
from ..auth import UserResponse
from ..models.game import Player

router = APIRouter()


class ClerkSyncRequest(BaseModel):
    """Request to sync Clerk user to local database."""
    role: Optional[str] = "student"  # Role selected during sign-up


class ClerkUserResponse(BaseModel):
    """Response with user data."""
    id: str
    email: Optional[str]
    name: str
    role: str
    clerk_user_id: str


class RoleUpdateRequest(BaseModel):
    """Request to update user role."""
    role: str


class LinkGuestRequest(BaseModel):
    """Request to link a guest player to an authenticated user."""
    player_id: str
    game_id: str


@router.post("/sync", response_model=ClerkUserResponse)
async def sync_clerk_user(
    sync_data: ClerkSyncRequest,
    current_user: User = Depends(get_current_user_clerk),
    db: AsyncSession = Depends(get_db)
):
    """
    Sync Clerk user to local database.

    POST /auth/clerk/sync

    This endpoint is called after Clerk sign-up to ensure the user
    exists in our local database with the correct role.
    """
    # If user was just created, they might need their role set
    if sync_data.role and sync_data.role in ["teacher", "student"]:
        if current_user.role != sync_data.role:
            current_user.role = sync_data.role
            await db.commit()
            await db.refresh(current_user)

    return ClerkUserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        clerk_user_id=current_user.clerk_user_id or ""
    )


@router.get("/me", response_model=ClerkUserResponse)
async def get_clerk_profile(current_user: User = Depends(get_current_user_clerk)):
    """
    Get current Clerk user's profile.

    GET /auth/clerk/me

    Requires Clerk authentication.
    """
    return ClerkUserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        clerk_user_id=current_user.clerk_user_id or ""
    )


@router.get("/verify")
async def verify_clerk_session(current_user: User = Depends(get_current_user_clerk)):
    """
    Verify if Clerk token is valid.

    GET /auth/clerk/verify

    Returns 200 if token is valid, 401 otherwise.
    """
    return {
        "valid": True,
        "user_id": str(current_user.id),
        "role": current_user.role,
        "clerk_user_id": current_user.clerk_user_id
    }


@router.put("/role", response_model=ClerkUserResponse)
async def update_user_role(
    role_data: RoleUpdateRequest,
    current_user: User = Depends(get_current_user_clerk),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user's role.

    PUT /auth/clerk/role

    This allows users to change their role (e.g., from student to teacher).
    """
    if role_data.role not in ["teacher", "student"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'teacher' or 'student'"
        )

    current_user.role = role_data.role
    await db.commit()
    await db.refresh(current_user)

    return ClerkUserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        clerk_user_id=current_user.clerk_user_id or ""
    )


@router.post("/link-guest")
async def link_guest_player(
    link_data: LinkGuestRequest,
    current_user: User = Depends(get_current_user_clerk),
    db: AsyncSession = Depends(get_db)
):
    """
    Link a guest player to the authenticated user after sign-up.

    POST /auth/clerk/link-guest

    This endpoint is called after a guest signs up to link their
    existing player record to their new user account.
    """
    print(f"[link-guest] Attempting to link player_id={link_data.player_id}, game_id={link_data.game_id} to user_id={current_user.id}")

    try:
        # Find the player
        result = await db.execute(
            select(Player).where(
                Player.id == UUID(link_data.player_id),
                Player.game_id == UUID(link_data.game_id),
                Player.user_id.is_(None)  # Only link unlinked players
            )
        )
        player = result.scalars().first()

        if player:
            print(f"[link-guest] Found player: {player.id}, linking to user {current_user.id}")
            player.user_id = current_user.id
            await db.commit()
            return {"linked": True, "player_id": str(player.id)}

        # Debug: check if player exists but is already linked
        result2 = await db.execute(
            select(Player).where(
                Player.id == UUID(link_data.player_id),
                Player.game_id == UUID(link_data.game_id),
            )
        )
        existing_player = result2.scalars().first()
        if existing_player:
            print(f"[link-guest] Player exists but already linked to user_id={existing_player.user_id}")
            return {"linked": False, "reason": "Player already linked to another user"}

        print(f"[link-guest] Player not found")
        return {"linked": False, "reason": "Player not found"}
    except Exception as e:
        print(f"[link-guest] Error: {e}")
        return {"linked": False, "reason": str(e)}
