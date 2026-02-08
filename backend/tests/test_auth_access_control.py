"""
Access control tests for the resolve_student_identity auth migration.

Tests cover:
1. Unauthenticated request without guest_ prefix → 401
2. Authenticated user gets own data using server-derived identity
3. Authenticated user cannot access another user's session → 403
4. Guest user with guest_ prefix can access own data
5. Session ownership verification works
"""

import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import jwt as pyjwt
import pytest
import pytest_asyncio
from cryptography.hazmat.primitives.asymmetric import rsa
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_clerk import resolve_student_identity, verify_session_ownership
from app.database import Base, get_db
from app.db_models import User, LearningSession
from app.main import app


# ==============================================================================
# Fixtures (reuse RSA keypair pattern from test_auth_clerk.py)
# ==============================================================================

@pytest.fixture(scope="session")
def rsa_keypair():
    """Generate an RSA keypair for signing test JWTs."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()
    return private_key, public_key


@pytest.fixture(scope="session")
def kid():
    return "test-key-id-ac-001"


@pytest.fixture(scope="session")
def issuer():
    return "https://clerk.test.quizly.dev"


@pytest.fixture(scope="session")
def jwks_data(rsa_keypair, kid):
    _, public_key = rsa_keypair
    jwk_dict = pyjwt.algorithms.RSAAlgorithm.to_jwk(public_key, as_dict=True)
    jwk_dict["kid"] = kid
    jwk_dict["use"] = "sig"
    jwk_dict["alg"] = "RS256"
    return {"keys": [jwk_dict]}


def _make_token(
    private_key,
    kid,
    issuer,
    clerk_user_id="user_clerk_ac_test",
    email="ac_test@example.com",
    full_name="AC Test User",
    role="student",
    expired=False,
):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": clerk_user_id,
        "iss": issuer,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=-1 if expired else 1)).timestamp()),
        "email": email,
        "full_name": full_name,
        "public_metadata": {"role": role},
    }
    return pyjwt.encode(
        payload,
        private_key,
        algorithm="RS256",
        headers={"kid": kid},
    )


# ==============================================================================
# Test Class: resolve_student_identity unit tests
# ==============================================================================

class TestResolveStudentIdentity:
    """Unit tests for the resolve_student_identity dependency."""

    @pytest.mark.asyncio
    async def test_authenticated_user_ignores_client_student_name(
        self, db_session: AsyncSession, rsa_keypair, kid, issuer, jwks_data
    ):
        """Auth user: server-derived name used, client student_name ignored."""
        private_key, _ = rsa_keypair
        clerk_id = f"user_clerk_rsi_{uuid.uuid4().hex[:8]}"
        token = _make_token(
            private_key, kid, issuer,
            clerk_user_id=clerk_id,
            full_name="Real Name",
        )

        credentials = MagicMock()
        credentials.credentials = token

        with patch("app.auth_clerk.fetch_jwks", new_callable=AsyncMock, return_value=jwks_data):
            student_name, user = await resolve_student_identity(
                student_name="attacker_name",
                credentials=credentials,
                db=db_session,
            )

        # Should use the JWT-derived name, not the attacker-supplied one
        assert student_name == "Real Name"
        assert user is not None
        assert user.clerk_user_id == clerk_id

    @pytest.mark.asyncio
    async def test_guest_with_prefix_allowed(self, db_session: AsyncSession):
        """Guest with guest_ prefix should be allowed through."""
        student_name, user = await resolve_student_identity(
            student_name="guest_12345_abc",
            credentials=None,
            db=db_session,
        )

        assert student_name == "guest_12345_abc"
        assert user is None

    @pytest.mark.asyncio
    async def test_no_token_no_guest_prefix_raises_401(self, db_session: AsyncSession):
        """No token and no guest_ prefix should raise 401."""
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await resolve_student_identity(
                student_name="SomeUser",
                credentials=None,
                db=db_session,
            )

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_no_token_no_name_raises_401(self, db_session: AsyncSession):
        """No token and no student_name should raise 401."""
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await resolve_student_identity(
                student_name=None,
                credentials=None,
                db=db_session,
            )

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token_no_guest_prefix_raises_401(self, db_session: AsyncSession):
        """Invalid token + non-guest name should raise 401."""
        from fastapi import HTTPException

        credentials = MagicMock()
        credentials.credentials = "bad-token"

        with pytest.raises(HTTPException) as exc_info:
            await resolve_student_identity(
                student_name="NotAGuest",
                credentials=credentials,
                db=db_session,
            )

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_token_with_guest_prefix_falls_through(
        self, db_session: AsyncSession, rsa_keypair, kid, issuer, jwks_data
    ):
        """Expired token but guest_ student_name should allow guest access."""
        private_key, _ = rsa_keypair
        token = _make_token(private_key, kid, issuer, expired=True)

        credentials = MagicMock()
        credentials.credentials = token

        with patch("app.auth_clerk.fetch_jwks", new_callable=AsyncMock, return_value=jwks_data):
            student_name, user = await resolve_student_identity(
                student_name="guest_expired_user",
                credentials=credentials,
                db=db_session,
            )

        assert student_name == "guest_expired_user"
        assert user is None


# ==============================================================================
# Test Class: verify_session_ownership unit tests
# ==============================================================================

class TestVerifySessionOwnership:
    """Unit tests for session ownership verification."""

    @pytest.mark.asyncio
    async def test_owner_can_access_session(self, db_session: AsyncSession):
        """Session owner should be able to access their session."""
        session = LearningSession(
            student_name="Alice",
            topic="Math",
        )
        db_session.add(session)
        await db_session.commit()
        await db_session.refresh(session)

        result = await verify_session_ownership(
            str(session.id),
            ("Alice", None),
            db_session,
        )
        assert result.id == session.id

    @pytest.mark.asyncio
    async def test_non_owner_gets_403(self, db_session: AsyncSession):
        """Non-owner should get 403."""
        from fastapi import HTTPException

        session = LearningSession(
            student_name="Alice",
            topic="Math",
        )
        db_session.add(session)
        await db_session.commit()
        await db_session.refresh(session)

        with pytest.raises(HTTPException) as exc_info:
            await verify_session_ownership(
                str(session.id),
                ("Eve", None),
                db_session,
            )

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_nonexistent_session_gets_404(self, db_session: AsyncSession):
        """Non-existent session should get 404."""
        from fastapi import HTTPException

        fake_id = str(uuid.uuid4())
        with pytest.raises(HTTPException) as exc_info:
            await verify_session_ownership(
                fake_id,
                ("Alice", None),
                db_session,
            )

        assert exc_info.value.status_code == 404


# ==============================================================================
# Test Class: HTTP Integration Tests
# ==============================================================================

class TestAccessControlHTTPIntegration:
    """Integration tests hitting actual API endpoints."""

    @pytest.mark.asyncio
    async def test_progress_returns_401_without_token(self, client: AsyncClient):
        """GET /learn/progress without token or guest_ should return 401."""
        response = await client.get(
            "/learn/progress?student_name=SomeUser",
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_progress_returns_401_no_params(self, client: AsyncClient):
        """GET /learn/progress with no params at all should return 401."""
        response = await client.get("/learn/progress")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_progress_works_for_guest(self, client: AsyncClient):
        """GET /learn/progress with guest_ prefix should work without token."""
        response = await client.get(
            "/learn/progress?student_name=guest_test_123",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["student_name"] == "guest_test_123"

    @pytest.mark.asyncio
    async def test_progress_works_for_authenticated_user(
        self, client: AsyncClient, db_session: AsyncSession,
        rsa_keypair, kid, issuer, jwks_data,
    ):
        """Authenticated user should get progress using JWT-derived identity."""
        private_key, _ = rsa_keypair
        clerk_id = f"user_clerk_progress_{uuid.uuid4().hex[:8]}"
        token = _make_token(
            private_key, kid, issuer,
            clerk_user_id=clerk_id,
            full_name="Auth Progress User",
        )

        with patch("app.auth_clerk.fetch_jwks", new_callable=AsyncMock, return_value=jwks_data):
            response = await client.get(
                "/learn/progress?student_name=ignored_by_server",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 200
        data = response.json()
        # Server should use JWT name, not the query param
        assert data["student_name"] == "Auth Progress User"

    @pytest.mark.asyncio
    async def test_history_returns_401_without_auth(self, client: AsyncClient):
        """GET /learn/history without auth should return 401."""
        response = await client.get("/learn/history")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_history_works_for_guest(self, client: AsyncClient):
        """GET /learn/history with guest_ prefix should work."""
        response = await client.get(
            "/learn/history?student_name=guest_history_456",
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_session_answer_returns_403_for_wrong_user(
        self, client: AsyncClient, db_session: AsyncSession,
        rsa_keypair, kid, issuer, jwks_data,
    ):
        """POST /learn/session/{id}/answer should return 403 if session belongs to someone else."""
        # Create a session owned by "Alice"
        session = LearningSession(
            student_name="Alice",
            topic="Math",
        )
        db_session.add(session)
        await db_session.commit()
        await db_session.refresh(session)

        # Authenticate as "Not Alice"
        private_key, _ = rsa_keypair
        clerk_id = f"user_clerk_notAlice_{uuid.uuid4().hex[:8]}"
        token = _make_token(
            private_key, kid, issuer,
            clerk_user_id=clerk_id,
            full_name="Not Alice",
        )

        with patch("app.auth_clerk.fetch_jwks", new_callable=AsyncMock, return_value=jwks_data):
            response = await client.post(
                f"/learn/session/{session.id}/answer",
                json={"answer": "A", "confidence": 50},
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_subject_requires_auth(self, client: AsyncClient):
        """DELETE /learn/subject/Math without auth should return 401."""
        response = await client.delete(
            "/learn/subject/Math?student_name=SomeUser",
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_leaderboard_requires_auth(self, client: AsyncClient):
        """GET /learn/leaderboard without auth should return 401."""
        response = await client.get("/learn/leaderboard")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_leaderboard_works_for_guest(self, client: AsyncClient):
        """GET /learn/leaderboard with guest_ prefix should work."""
        response = await client.get(
            "/learn/leaderboard?student_name=guest_leader_789",
        )
        assert response.status_code == 200
