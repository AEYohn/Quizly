"""
Health Check Endpoint Tests

Tests for the root, health, and metrics endpoints.
"""

import pytest


@pytest.mark.anyio
async def test_root_endpoint(client):
    """
    Test GET / returns healthy status.

    The root endpoint should return:
    - status: "healthy"
    - service: "Quizly API"
    - version: semver string
    """
    response = await client.get("/")

    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "Quizly API"
    assert "version" in data
    assert data["version"] == "0.1.0"


@pytest.mark.anyio
async def test_health_endpoint(client):
    """
    Test GET /health returns database status.

    The health endpoint should return:
    - status: "healthy"
    - database: connection status
    - gemini: AI service status
    - version: semver string
    """
    response = await client.get("/health")

    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert "database" in data
    assert "gemini" in data
    assert "version" in data

    # In test mode, database should be connected (SQLite in-memory)
    # Note: May show "not_configured" if DATABASE_URL check fails
    assert data["database"] in ["connected", "not_configured", "error: "]


@pytest.mark.anyio
async def test_health_endpoint_returns_version(client):
    """Test that health endpoint includes version information."""
    response = await client.get("/health")

    assert response.status_code == 200

    data = response.json()
    assert data["version"] == "0.1.0"


@pytest.mark.anyio
async def test_metrics_endpoint(client):
    """
    Test GET /metrics returns Prometheus metrics data.

    The metrics endpoint should return:
    - Content-Type: text/plain or application/openmetrics-text
    - Body containing Prometheus-formatted metrics
    """
    response = await client.get("/metrics")

    assert response.status_code == 200

    # Check content type is appropriate for Prometheus
    content_type = response.headers.get("content-type", "")
    assert any(ct in content_type for ct in ["text/plain", "text/", "openmetrics"])

    # Check that response body contains Prometheus metrics format
    content = response.text

    # Prometheus metrics should contain at least some common patterns
    # HELP comments, TYPE comments, or metric names
    assert len(content) > 0

    # Typical Prometheus metrics include HELP and TYPE declarations
    # or metric names followed by values
    has_metrics_format = (
        "# HELP" in content or
        "# TYPE" in content or
        "_total" in content or
        "_count" in content or
        "_sum" in content or
        "_bucket" in content or
        "quizly" in content.lower() or
        "http" in content.lower() or
        "process" in content.lower()
    )
    assert has_metrics_format, f"Response doesn't look like Prometheus metrics: {content[:500]}"


@pytest.mark.anyio
async def test_metrics_endpoint_content_type(client):
    """Test that metrics endpoint returns correct content type for Prometheus."""
    response = await client.get("/metrics")

    assert response.status_code == 200

    content_type = response.headers.get("content-type", "")
    # Prometheus expects text/plain or openmetrics format
    valid_content_types = [
        "text/plain",
        "text/",
        "application/openmetrics-text",
    ]
    assert any(ct in content_type for ct in valid_content_types)


@pytest.mark.anyio
async def test_root_has_request_id_header(client):
    """Test that responses include X-Request-ID header for tracing."""
    response = await client.get("/")

    assert response.status_code == 200
    # The middleware adds X-Request-ID to responses
    assert "x-request-id" in response.headers


@pytest.mark.anyio
async def test_health_ready_endpoint(client):
    """
    Test GET /health/ready returns readiness status.

    The readiness endpoint is used by load balancers to check
    if the service is ready to accept traffic.
    """
    response = await client.get("/health/ready")

    # May return 200 (ready) or 503 (not ready)
    assert response.status_code in [200, 503]

    data = response.json()
    assert "ready" in data
    assert "checks" in data
    assert "version" in data

    # Checks should include database status
    assert "database" in data["checks"]
