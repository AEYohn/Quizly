"""
Standardized exception handling for Quizly API.

Provides consistent error response format across all endpoints:
{
    "code": "ERROR_CODE",
    "message": "Human-readable description"
}
"""

from typing import Optional, Dict
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class QuizlyException(HTTPException):
    """Base exception for Quizly API errors.

    Usage:
        raise QuizlyException("GAME_NOT_FOUND", "Game does not exist", 404)
        raise QuizlyException("INVALID_ANSWER", "Answer must be A, B, C, or D")
    """

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        headers: Optional[Dict[str, str]] = None,
    ):
        self.code = code
        self.message = message
        detail = {"code": code, "message": message}
        super().__init__(status_code=status_code, detail=detail, headers=headers)


# Common error codes as constants
class ErrorCodes:
    # Authentication
    UNAUTHORIZED = "UNAUTHORIZED"
    INVALID_TOKEN = "INVALID_TOKEN"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"

    # Game errors
    GAME_NOT_FOUND = "GAME_NOT_FOUND"
    GAME_ALREADY_STARTED = "GAME_ALREADY_STARTED"
    GAME_FINISHED = "GAME_FINISHED"
    INVALID_GAME_CODE = "INVALID_GAME_CODE"

    # Player errors
    PLAYER_NOT_FOUND = "PLAYER_NOT_FOUND"
    PLAYER_ALREADY_JOINED = "PLAYER_ALREADY_JOINED"
    NICKNAME_TAKEN = "NICKNAME_TAKEN"

    # Answer errors
    INVALID_ANSWER = "INVALID_ANSWER"
    ANSWER_ALREADY_SUBMITTED = "ANSWER_ALREADY_SUBMITTED"
    QUESTION_CLOSED = "QUESTION_CLOSED"

    # Quiz errors
    QUIZ_NOT_FOUND = "QUIZ_NOT_FOUND"
    NO_QUESTIONS = "NO_QUESTIONS"

    # Rate limiting
    RATE_LIMITED = "RATE_LIMITED"

    # Learning / Session errors
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    INVALID_INPUT = "INVALID_INPUT"
    FORBIDDEN = "FORBIDDEN"
    AI_SERVICE_UNAVAILABLE = "AI_SERVICE_UNAVAILABLE"

    # Server errors
    INTERNAL_ERROR = "INTERNAL_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"


# Pre-built common exceptions for convenience
class GameNotFound(QuizlyException):
    def __init__(self, game_id: str = ""):
        msg = f"Game {game_id} not found" if game_id else "Game not found"
        super().__init__(ErrorCodes.GAME_NOT_FOUND, msg, 404)


class PlayerNotFound(QuizlyException):
    def __init__(self, player_id: str = ""):
        msg = f"Player {player_id} not found" if player_id else "Player not found"
        super().__init__(ErrorCodes.PLAYER_NOT_FOUND, msg, 404)


class QuizNotFound(QuizlyException):
    def __init__(self, quiz_id: str = ""):
        msg = f"Quiz {quiz_id} not found" if quiz_id else "Quiz not found"
        super().__init__(ErrorCodes.QUIZ_NOT_FOUND, msg, 404)


class InvalidGameCode(QuizlyException):
    def __init__(self, code: str = ""):
        msg = f"Invalid game code: {code}" if code else "Invalid game code"
        super().__init__(ErrorCodes.INVALID_GAME_CODE, msg, 404)


class GameAlreadyStarted(QuizlyException):
    def __init__(self):
        super().__init__(
            ErrorCodes.GAME_ALREADY_STARTED,
            "Game has already started and does not allow late joins",
            400,
        )


class GameFinished(QuizlyException):
    def __init__(self):
        super().__init__(ErrorCodes.GAME_FINISHED, "Game has already finished", 400)


class AnswerAlreadySubmitted(QuizlyException):
    def __init__(self):
        super().__init__(
            ErrorCodes.ANSWER_ALREADY_SUBMITTED,
            "You have already submitted an answer for this question",
            400,
        )


class QuestionClosed(QuizlyException):
    def __init__(self):
        super().__init__(
            ErrorCodes.QUESTION_CLOSED, "The question is no longer accepting answers", 400
        )


class RateLimited(QuizlyException):
    def __init__(self, retry_after: Optional[int] = None):
        headers = {"Retry-After": str(retry_after)} if retry_after else None
        super().__init__(
            ErrorCodes.RATE_LIMITED,
            "Too many requests. Please slow down.",
            429,
            headers=headers,
        )


class SessionNotFound(QuizlyException):
    def __init__(self, session_id: str = ""):
        msg = f"Session {session_id} not found" if session_id else "Session not found"
        super().__init__(ErrorCodes.SESSION_NOT_FOUND, msg, 404)


class ResourceNotFound(QuizlyException):
    def __init__(self, resource: str = "Resource"):
        msg = f"{resource} not found"
        super().__init__(ErrorCodes.RESOURCE_NOT_FOUND, msg, 404)


class Forbidden(QuizlyException):
    def __init__(self, message: str = "Cannot access another user's data"):
        super().__init__(ErrorCodes.FORBIDDEN, message, 403)


class InvalidInput(QuizlyException):
    def __init__(self, message: str = "Invalid input"):
        super().__init__(ErrorCodes.INVALID_INPUT, message, 400)


class AIServiceUnavailable(QuizlyException):
    def __init__(self, message: str = "AI service is currently unavailable"):
        super().__init__(ErrorCodes.AI_SERVICE_UNAVAILABLE, message, 503)


async def quizly_exception_handler(request: Request, exc: QuizlyException) -> JSONResponse:
    """FastAPI exception handler for QuizlyException.

    Register with: app.add_exception_handler(QuizlyException, quizly_exception_handler)
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "message": exc.message},
        headers=exc.headers,
    )
