# Quizly Backend Deployment Guide

## Quick Deploy to Railway

### Option 1: Railway CLI (Fastest)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project  
cd backend
railway init

# Add PostgreSQL
railway add --database postgres

# Deploy
railway up

# Set environment variables
railway variables set GEMINI_API_KEY=your_key_here
railway variables set CORS_ORIGINS=https://your-frontend.vercel.app
```

### Option 2: Railway Dashboard

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select this repository
4. Set root directory to `/backend`
5. Railway auto-detects FastAPI
6. Add PostgreSQL: Click "Add" → "Database" → "PostgreSQL"
7. Set environment variables:
   - `GEMINI_API_KEY`: Your Gemini API key
   - `CORS_ORIGINS`: Your frontend URL

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL URL (auto-set by Railway) | `postgresql://...` |
| `GEMINI_API_KEY` | Gemini API key | `AIzaSy...` |
| `CORS_ORIGINS` | Allowed origins | `https://quizly.vercel.app` |

---

## Deploy Frontend to Vercel

```bash
cd frontend
npm install -g vercel
vercel

# Set environment variable
vercel env add NEXT_PUBLIC_API_URL
# Enter: https://your-railway-app.railway.app
```

---

## Verify Deployment

```bash
# Check health
curl https://your-app.railway.app/health

# Check API docs
open https://your-app.railway.app/docs
```
