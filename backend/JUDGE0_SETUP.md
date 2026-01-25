# Judge0 Code Execution Setup

Quizly uses **Judge0** for secure, sandboxed code execution - the same technology powering LeetCode, HackerRank, and similar platforms.

## Quick Start (5 minutes)

### Option 1: RapidAPI (Recommended for Hackathon)

1. **Get a free API key:**
   - Go to [RapidAPI Judge0 CE](https://rapidapi.com/judge0-official/api/judge0-ce)
   - Click "Subscribe" → Select the **Basic (Free)** plan
   - Copy your API key from the "X-RapidAPI-Key" field

2. **Add to your `.env` file:**
   ```bash
   USE_JUDGE0=true
   JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
   JUDGE0_API_KEY=your_rapidapi_key_here
   JUDGE0_API_HOST=judge0-ce.p.rapidapi.com
   ```

3. **Test the integration:**
   ```bash
   cd backend
   python test_judge0.py
   ```

**Free Tier Limits:** 50 submissions/day (enough for hackathon demo)

---

### Option 2: Railway Deployment (Production)

Deploy your own Judge0 instance for unlimited submissions:

1. Click: [Deploy Judge0 on Railway](https://railway.app/template/judge0)
2. Wait for deployment (~2 minutes)
3. Copy your Railway URL (e.g., `https://judge0-xxxxx.railway.app`)
4. Update `.env`:
   ```bash
   JUDGE0_API_URL=https://judge0-xxxxx.railway.app
   JUDGE0_API_KEY=  # Leave empty unless you configured auth
   JUDGE0_API_HOST=  # Leave empty for self-hosted
   ```

**Cost:** ~$5-20/month depending on usage

---

### Option 3: Local Docker (Development)

Run Judge0 locally for development:

```bash
# Clone Judge0
git clone https://github.com/judge0/judge0.git
cd judge0

# Start services
docker-compose up -d

# Judge0 is now available at http://localhost:2358
```

Update `.env`:
```bash
JUDGE0_API_URL=http://localhost:2358
JUDGE0_API_KEY=
JUDGE0_API_HOST=
```

---

## Supported Languages

Judge0 supports 60+ languages. Our integration includes:

| Language | Judge0 ID | Notes |
|----------|-----------|-------|
| Python 3 | 71 | Primary language |
| JavaScript (Node.js) | 63 | Full ES6+ support |
| C++ 17 (GCC) | 54 | STL included |
| Java (OpenJDK) | 62 | Full JDK support |
| TypeScript | 74 | Transpiled to JS |
| Go | 60 | Standard library |
| Rust | 73 | Cargo not available |
| Ruby | 72 | Standard gems |

---

## API Endpoints

### Execute Code
```bash
POST /code/run
{
  "code": "def solution(nums): return sum(nums)",
  "language": "python",
  "test_cases": [
    {"input": "[1, 2, 3]", "expected_output": "6", "is_hidden": false}
  ]
}
```

### Batch Execute (Faster)
```bash
POST /code/run/batch
# Same payload as /run, but uses batch API for multiple test cases
```

### Health Check
```bash
GET /code/health
# Returns: {"status": "healthy", "execution_engine": "judge0", ...}
```

### Supported Languages
```bash
GET /code/languages
# Returns list of available languages with templates
```

---

## Execution Limits

| Limit | Default | Environment Variable |
|-------|---------|---------------------|
| CPU Time | 2 seconds | `JUDGE0_CPU_TIME_LIMIT` |
| Memory | 128 MB | `JUDGE0_MEMORY_LIMIT` |
| Output Size | 10 KB | `JUDGE0_MAX_OUTPUT` |

---

## Troubleshooting

### "Judge0 API key not configured"
- Make sure `JUDGE0_API_KEY` is set in your `.env` file
- For RapidAPI, the key should look like: `a1b2c3d4e5...`

### "API error: 401 Unauthorized"
- Your API key may be invalid or expired
- Check your RapidAPI subscription is active

### "API error: 429 Too Many Requests"
- You've hit the rate limit (50/day on free tier)
- Wait 24 hours or upgrade your plan

### Code works locally but fails on Judge0
- Judge0 uses Linux containers - Windows-specific code won't work
- Check for missing imports
- Ensure your code reads from stdin correctly

---

## Security Notes

Judge0 provides enterprise-grade security:
- **Docker isolation**: Each submission runs in its own container
- **Resource limits**: CPU, memory, and time limits enforced
- **Network isolation**: No network access by default
- **Filesystem isolation**: Submissions can't access host files

This is significantly more secure than running code locally with subprocess.
