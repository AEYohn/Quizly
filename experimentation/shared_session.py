"""
Shared Session Store
Simple file-based session sharing between teacher and student dashboards.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

# Session file location
SESSION_FILE = Path(__file__).parent / ".active_session.json"


def save_session(session_data: Dict[str, Any]) -> bool:
    """Save the current session to shared storage."""
    try:
        session_data["updated_at"] = datetime.now().isoformat()
        with open(SESSION_FILE, 'w') as f:
            json.dump(session_data, f, indent=2, default=str)
        return True
    except Exception as e:
        print(f"Error saving session: {e}")
        return False


def load_session() -> Optional[Dict[str, Any]]:
    """Load the current session from shared storage."""
    try:
        if SESSION_FILE.exists():
            with open(SESSION_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading session: {e}")
    return None


def get_active_questions() -> List[Dict]:
    """Get approved questions from the active session."""
    session = load_session()
    if session and "approved_questions" in session:
        return session["approved_questions"]
    return []


def get_session_info() -> Dict[str, Any]:
    """Get session metadata."""
    session = load_session()
    if session:
        return {
            "topic": session.get("topic", "No topic"),
            "num_questions": len(session.get("approved_questions", [])),
            "active": True,
            "updated_at": session.get("updated_at", "")
        }
    return {"topic": "No active session", "num_questions": 0, "active": False}


def start_session(topic: str, questions: List[Dict], objectives: List[str] = None) -> str:
    """Start a new session with approved questions."""
    session_data = {
        "session_id": datetime.now().strftime("%Y%m%d_%H%M%S"),
        "topic": topic,
        "approved_questions": questions,
        "objectives": objectives or [],
        "current_question_index": 0,
        "student_responses": {},
        "started_at": datetime.now().isoformat(),
        "status": "active"
    }
    
    if save_session(session_data):
        return session_data["session_id"]
    return ""


def submit_response(student_name: str, question_id: str, response: Dict) -> bool:
    """Submit a student response to the session."""
    session = load_session()
    if not session:
        return False
    
    if "student_responses" not in session:
        session["student_responses"] = {}
    
    if student_name not in session["student_responses"]:
        session["student_responses"][student_name] = {}
    
    session["student_responses"][student_name][question_id] = {
        **response,
        "submitted_at": datetime.now().isoformat()
    }
    
    return save_session(session)


def get_class_responses(question_id: str) -> List[Dict]:
    """Get all student responses for a question."""
    session = load_session()
    if not session:
        return []
    
    responses = []
    for student, answers in session.get("student_responses", {}).items():
        if question_id in answers:
            responses.append({
                "student": student,
                **answers[question_id]
            })
    
    return responses


def advance_question() -> Optional[int]:
    """Advance to the next question in the session."""
    session = load_session()
    if not session:
        return None
    
    current = session.get("current_question_index", 0)
    total = len(session.get("approved_questions", []))
    
    if current < total - 1:
        session["current_question_index"] = current + 1
        save_session(session)
        return current + 1
    
    return None


def get_current_question() -> Optional[Dict]:
    """Get the current active question."""
    session = load_session()
    if not session:
        return None
    
    questions = session.get("approved_questions", [])
    index = session.get("current_question_index", 0)
    
    if 0 <= index < len(questions):
        return {
            "index": index,
            "total": len(questions),
            "question": questions[index]
        }
    
    return None


def clear_session():
    """Clear the active session."""
    if SESSION_FILE.exists():
        os.remove(SESSION_FILE)


# Debug info
if __name__ == "__main__":
    print(f"Session file: {SESSION_FILE}")
    session = load_session()
    if session:
        print(f"Active session: {session.get('topic')} with {len(session.get('approved_questions', []))} questions")
    else:
        print("No active session")
