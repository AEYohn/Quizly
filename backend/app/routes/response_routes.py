"""
Response Routes
API endpoints for student responses and WebSocket handling.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime, timezone


def utc_now() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


router = APIRouter()


# Request/Response Models
class AnswerSubmit(BaseModel):
    """Request model for submitting an answer."""
    question_id: int
    user_id: int
    answer: str
    confidence: Optional[float] = None
    rationale: Optional[str] = None


class ResponseData(BaseModel):
    """Response model for answer data."""
    id: int
    question_id: int
    user_id: int
    answer: str
    confidence: Optional[float]
    rationale: Optional[str]
    is_correct: Optional[bool]
    created_at: datetime


# Placeholder storage
responses_db: Dict[int, Dict] = {}
response_counter = 0

# WebSocket connections for real-time updates
active_connections: Dict[str, List[WebSocket]] = {}


@router.post("/submit", response_model=ResponseData)
async def submit_answer(answer: AnswerSubmit):
    """
    Submit an answer to a question.
    
    POST /responses/submit
    """
    global response_counter
    response_counter += 1
    
    new_response = {
        "id": response_counter,
        "question_id": answer.question_id,
        "user_id": answer.user_id,
        "answer": answer.answer,
        "confidence": answer.confidence,
        "rationale": answer.rationale,
        "is_correct": None,  # Would be computed from question data
        "created_at": utc_now()
    }
    responses_db[response_counter] = new_response
    
    return ResponseData(**new_response)


@router.get("/question/{question_id}")
async def get_question_responses(question_id: int):
    """
    Get all responses for a question.
    
    GET /responses/question/{question_id}
    """
    question_responses = [
        r for r in responses_db.values()
        if r["question_id"] == question_id
    ]
    
    return {"question_id": question_id, "responses": question_responses}


@router.get("/session/{session_id}")
async def get_session_responses(session_id: int):
    """
    Get all responses for a session.
    
    GET /responses/session/{session_id}
    """
    # Placeholder - would join with questions table
    return {"session_id": session_id, "responses": []}


@router.get("/user/{user_id}")
async def get_user_responses(user_id: int, session_id: Optional[int] = None):
    """
    Get all responses from a user.
    
    GET /responses/user/{user_id}
    """
    user_responses = [
        r for r in responses_db.values()
        if r["user_id"] == user_id
    ]
    
    return {"user_id": user_id, "responses": user_responses}


# WebSocket endpoint for real-time answer submission
@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time answer submission.
    
    WS /responses/ws/{session_id}
    """
    await websocket.accept()
    
    # Register connection
    if session_id not in active_connections:
        active_connections[session_id] = []
    active_connections[session_id].append(websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Process answer submission
            if data.get("type") == "submit_answer":
                # Create response (similar to submit_answer endpoint)
                global response_counter
                response_counter += 1
                
                new_response = {
                    "id": response_counter,
                    "question_id": data.get("question_id"),
                    "user_id": data.get("user_id"),
                    "answer": data.get("answer"),
                    "confidence": data.get("confidence"),
                    "rationale": data.get("rationale"),
                    "is_correct": None,
                    "created_at": utc_now().isoformat()
                }
                responses_db[response_counter] = new_response
                
                # Acknowledge to sender
                await websocket.send_json({
                    "type": "answer_ack",
                    "response_id": response_counter
                })
                
                # Broadcast update to all session participants (instructor)
                for conn in active_connections.get(session_id, []):
                    if conn != websocket:
                        try:
                            await conn.send_json({
                                "type": "new_response",
                                "response": new_response
                            })
                        except Exception:
                            pass
                            
    except WebSocketDisconnect:
        # Remove connection
        if session_id in active_connections:
            active_connections[session_id].remove(websocket)
