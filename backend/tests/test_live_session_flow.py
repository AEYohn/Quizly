import pytest


@pytest.mark.anyio
async def test_live_session_happy_path(client):
    # Start session
    start_payload = {
        "topic": "Test Topic",
        "objectives": ["Obj1"],
        "questions": [
            {
                "concept": "c1",
                "prompt": "2+2?",
                "options": ["A", "B", "C", "D"],
                "correct_answer": "B",
                "explanation": "",
                "difficulty": 0.3,
            },
            {
                "concept": "c2",
                "prompt": "3+3?",
                "options": ["A", "B", "C", "D"],
                "correct_answer": "D",
                "explanation": "",
                "difficulty": 0.4,
            },
        ],
    }
    resp = await client.post("/live-sessions/start", json=start_payload)
    assert resp.status_code == 200
    session = resp.json()
    session_id = session["session_id"]
    q0_id = session["questions"][0]["id"]

    # Join
    resp = await client.post("/live-sessions/join", json={"student_name": "Alice"})
    assert resp.status_code == 200

    # Submit response
    resp = await client.post(
        "/live-sessions/submit",
        json={
            "student_name": "Alice",
            "question_id": q0_id,
            "answer": "B",
            "reasoning": "",
            "confidence": 80,
            "response_type": "mcq",
        },
    )
    assert resp.status_code == 200

    # Pulse should show correctness
    resp = await client.get(f"/analytics/session/{session_id}/pulse", params={"question_id": q0_id})
    assert resp.status_code == 200
    pulse = resp.json()
    assert pulse["response_count"] == 1
    assert pulse["correctness_rate"] == 100.0
