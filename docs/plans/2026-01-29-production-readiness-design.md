# Production Readiness & Demo Polish Design

**Date:** 2026-01-29
**Goal:** Hackathon demo wow-factor + production-ready foundation
**Timeline:** 1-2 weeks
**Demo Focus:** Full teacher+student loop with AI showcase

---

## Phase 1: Demo Polish (Days 1-4)

### 1.1 Demo Seeding Script

**Purpose:** One command populates the app with realistic data for demo

**What it creates:**
- 2 demo teachers (one with full data, one empty for live creation)
- 3 demo courses (CS101 Intro to Programming, PHYS201 Mechanics, MATH150 Calculus)
- 10-15 students per course with varied performance profiles
- Quiz history with responses, misconceptions, mastery progression
- Pre-generated exit tickets and analytics data
- Active game session ready to demo

**Implementation:**
- Backend: `backend/app/scripts/seed_demo.py`
- CLI command: `python -m app.scripts.seed_demo`
- Idempotent (can re-run safely)
- Configurable via env vars (DEMO_MODE=true)

### 1.2 Onboarding Wizard

**Teacher Flow:**
1. Welcome screen explaining Quizly's value prop
2. Create first course (or use template)
3. Add first quiz (or let AI generate)
4. Invite students (show join code)
5. Start first session (guided)

**Student Flow:**
1. Welcome screen
2. Join course via code
3. Quick tutorial on answering questions
4. Ready state

**Implementation:**
- Frontend: `frontend/src/components/onboarding/`
- Store onboarding state in localStorage + user preferences API
- Skip button always available
- Re-accessible from settings

### 1.3 Loading & Error States

**Loading States:**
- Skeleton loaders for all data-dependent views
- Optimistic UI updates where appropriate
- Consistent loading spinner component

**Error States:**
- Global error boundary with friendly message
- Per-component error states with retry buttons
- Empty states for lists (courses, quizzes, students)
- Network error handling with offline indicator

**Implementation:**
- Frontend: `frontend/src/components/ui/Skeleton.tsx`
- Frontend: `frontend/src/components/ui/ErrorBoundary.tsx`
- Frontend: `frontend/src/components/ui/EmptyState.tsx`

### 1.4 AI Demo Mode

**Purpose:** Reliable demo even if Gemini API is slow/down

**Features:**
- Pre-cached responses for demo courses
- Fallback to cached when API times out (>3s)
- Visual indicator when using cached (dev only)
- Toggle via DEMO_MODE env var

**Implementation:**
- Backend: `backend/app/ai_agents/demo_cache.py`
- JSON files with pre-generated questions, exit tickets, misconceptions
- Middleware that intercepts AI calls in demo mode

---

## Phase 2: Production Foundation (Days 5-8)

### 2.1 Testing Setup

**Backend (pytest):**
- `backend/tests/` directory structure
- Fixtures for database, auth, test client
- Critical path tests:
  - Auth flows (login, signup, token refresh)
  - Quiz CRUD operations
  - Game session lifecycle
  - WebSocket connections

**Frontend (Vitest + Testing Library):**
- `frontend/src/__tests__/` directory
- Component tests for critical UI
- Integration tests for key user flows

**Coverage targets:**
- Phase 2: 30% coverage on critical paths
- Post-hackathon: 70%+ coverage

### 2.2 CI/CD Pipeline

**GitHub Actions workflows:**

`.github/workflows/ci.yml`:
- Trigger: push to main, PRs
- Jobs:
  - Lint (ruff for Python, eslint for TS)
  - Type check (mypy, tsc)
  - Test (pytest, vitest)
  - Build check

`.github/workflows/deploy.yml`:
- Trigger: push to main (after CI passes)
- Deploy backend to Railway
- Deploy frontend to Vercel/Railway
- Run migrations
- Health check

### 2.3 Error Monitoring (Sentry)

**Backend:**
- Sentry SDK integration in FastAPI
- Capture unhandled exceptions
- Performance monitoring for slow endpoints
- User context (anonymized)

**Frontend:**
- Sentry React SDK
- Error boundary integration
- Source maps for stack traces
- Session replay (optional)

**Implementation:**
- Backend: `backend/app/sentry_config.py`
- Frontend: `frontend/src/lib/sentry.ts`
- Env vars: SENTRY_DSN, SENTRY_ENVIRONMENT

### 2.4 Basic Accessibility

**Keyboard Navigation:**
- All interactive elements focusable
- Logical tab order
- Escape closes modals
- Arrow keys for option selection in quizzes

**Screen Readers:**
- aria-labels on buttons/icons
- aria-live regions for dynamic content (scores, timers)
- Semantic HTML (headings, landmarks)

**Visual:**
- Focus indicators (visible outlines)
- Color contrast compliance (WCAG AA)
- Don't rely on color alone for information

---

## Phase 3: Market-Ready (Days 9-12)

### 3.1 Data Export

**Teacher Exports:**
- Student grades as CSV
- Quiz results as CSV
- Analytics report as PDF
- Misconception summary as PDF

**Implementation:**
- Backend: `backend/app/routes/exports.py`
- PDF generation: weasyprint or reportlab
- CSV: standard library
- Async generation for large exports

### 3.2 Rate Limit UX

**User Feedback:**
- Toast notification when rate limited
- Retry-after countdown
- Graceful degradation (show cached data)

**Implementation:**
- Backend already has slowapi
- Frontend: intercept 429 responses globally
- Show user-friendly message with wait time

### 3.3 Privacy Basics

**Data Deletion:**
- DELETE /api/users/me endpoint
- Cascading deletion of user data
- Confirmation flow in UI

**Privacy Policy:**
- `/privacy` page with policy text
- Link in footer and signup flow

**Cookie Consent:**
- Banner for non-essential cookies
- Preference storage

---

## Deferred (Post-Hackathon)

| Feature | Notes |
|---------|-------|
| LMS Integrations | Canvas LTI, Google Classroom API |
| Payment/Billing | Stripe subscriptions |
| Admin Dashboard | Platform-wide analytics, user management |
| Full i18n | next-intl setup, translation workflow |
| FERPA/GDPR | Full compliance audit, DPA templates |
| Offline Support | Service worker for mobile |

---

## File Structure Overview

```
backend/
├── app/
│   ├── scripts/
│   │   └── seed_demo.py          # Demo data seeding
│   ├── ai_agents/
│   │   └── demo_cache.py         # AI response caching
│   ├── sentry_config.py          # Error monitoring
│   └── routes/
│       └── exports.py            # Data export endpoints
├── tests/
│   ├── conftest.py               # Pytest fixtures
│   ├── test_auth.py
│   ├── test_quizzes.py
│   └── test_games.py

frontend/
├── src/
│   ├── components/
│   │   ├── onboarding/
│   │   │   ├── TeacherOnboarding.tsx
│   │   │   └── StudentOnboarding.tsx
│   │   └── ui/
│   │       ├── Skeleton.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── EmptyState.tsx
│   ├── lib/
│   │   └── sentry.ts
│   └── __tests__/

.github/
└── workflows/
    ├── ci.yml
    └── deploy.yml
```

---

## Success Criteria

**Demo Ready:**
- [ ] Single command seeds realistic demo data
- [ ] Teacher can create course → quiz → run session smoothly
- [ ] Student can join → answer → see results smoothly
- [ ] AI features work reliably (with fallback)
- [ ] No crashes or ugly error states during demo

**Production Ready:**
- [ ] CI pipeline catches regressions
- [ ] Errors are tracked and alertable
- [ ] Critical paths have test coverage
- [ ] Basic accessibility compliance
- [ ] Users can export their data
