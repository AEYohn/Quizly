# Code Execution Setup

Quizly supports LeetCode-style code execution for programming challenges. By default, it uses **Piston** - a free, open-source code execution engine that requires no API key.

## Quick Start (No Setup Required!)

The default configuration uses the free Piston public API. Just start the backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Test it:
```bash
python test_piston.py
```

## Code Execution Engines

### 1. Piston (Default - Free)

- **No API key required**
- 70+ programming languages
- Hosted at: `https://emkc.org/api/v2/piston`
- Self-hostable: `docker run --privileged -p 2000:2000 ghcr.io/engineer-man/piston`

**Supported Languages:**
Python, JavaScript, TypeScript, Java, C, C++, Go, Rust, Ruby, PHP, Swift, Kotlin, Scala, R, Perl, Lua, Bash, SQL, Haskell, and more.

**Configuration (.env):**
```env
CODE_RUNNER=piston
PISTON_API_URL=https://emkc.org/api/v2/piston
PISTON_COMPILE_TIMEOUT=10000
PISTON_RUN_TIMEOUT=3000
PISTON_MEMORY_LIMIT=128000000
```

### 2. Judge0 (Alternative - Requires API Key)

- Requires RapidAPI key (free tier: 50 submissions/day)
- 60+ languages
- More detailed execution stats

**Setup:**
1. Sign up at: https://rapidapi.com/judge0-official/api/judge0-ce
2. Get your API key
3. Update `.env`:

```env
CODE_RUNNER=judge0
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your_key_here
JUDGE0_API_HOST=judge0-ce.p.rapidapi.com
```

### 3. Local Execution (Development Only)

⚠️ **Not sandboxed - only for local development**

```env
CODE_RUNNER=local
```

## API Endpoints

### Execute Code
```bash
POST /code/run
{
  "code": "def solution(nums):\n    return sum(nums)",
  "language": "python",
  "test_cases": [
    {"input": "[1, 2, 3]", "expected_output": "6", "is_hidden": false}
  ]
}
```

### Check Health
```bash
GET /code/health
```

### List Languages
```bash
GET /code/languages
```

## Self-Hosting Piston

For production or to avoid rate limits:

```bash
# Run Piston locally
docker run --privileged -d -p 2000:2000 ghcr.io/engineer-man/piston

# Update .env
PISTON_API_URL=http://localhost:2000
```

## Troubleshooting

### "Connection refused" or "API unreachable"
- The public Piston API may be temporarily down
- Try again after a few minutes
- Consider self-hosting for reliability

### "Unsupported language"
- Check `/code/languages` for the list of supported languages
- Language names are case-insensitive

### Code execution timeout
- Default timeout is 3 seconds
- Adjust `PISTON_RUN_TIMEOUT` for longer-running code
