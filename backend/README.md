# Quizly Backend

FastAPI server for the Quizly peer-instruction platform.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --port 8000
```

## API Documentation

Once running, API docs are available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Environment Variables

Create a `.env` file:

```bash
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL=postgresql://user:pass@localhost:5432/quizly
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
CORS_ORIGINS=http://localhost:3000
```

## Project Structure

```
backend/
├── app/
│   ├── main.py          # FastAPI app entry point
│   ├── models.py        # SQLAlchemy data models
│   └── routes/          # API endpoints
│       ├── session_routes.py
│       ├── response_routes.py
│       └── analytics_routes.py
└── requirements.txt
```
