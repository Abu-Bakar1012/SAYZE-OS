<<<<<<< HEAD
# SAYZE OS

A minimal full-stack starter for a zero-trust personal AI assistant. The backend
protects chat requests with a bearer token and connects to Nebius through its
OpenAI-compatible API. The React frontend keeps the token in component memory
only; it is not persisted to browser storage.

The current PII guardrail is a local, regex-based implementation; it is not the
NVIDIA NemoClaw SDK and does not guarantee detection of every sensitive value.
The Qdrant vector store accepts precomputed vectors and is not connected to a
local embedding/sanitization pipeline yet.

## Requirements

- Python 3.11+
- Node.js 20+
- Docker Compose (optional)
- Nebius API key and a long random SAYZE API token

## Local setup

### Backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `NEBIUS_API_KEY`, `TAVILY_API_KEY`, and a strong `SAYZE_API_TOKEN` in
`backend/.env`. Start the API from the project root and explicitly load that
environment file:

```powershell
cd ..
uvicorn backend.main:app --reload --env-file backend/.env
```

The API listens on `http://localhost:8000`; interactive API docs are at
`http://localhost:8000/docs`. `GET /api/health` is public, and `POST /api/chat`
requires `Authorization: Bearer <SAYZE_API_TOKEN>`. Before chat prompts are sent
to Nebius, the backend replaces detected email addresses, phone numbers, credit
card numbers, and SSNs with local pseudonym tokens. Matching tokens in the
provider response are restored locally before the response is returned.

The core API also exposes `GET /health` with status, timestamp, and environment
metadata. `POST /api/v1/execute` runs the same privacy and model-routing flow,
returns the sanitized prompt and both provider and restored responses, and logs
only a hash of the sanitized prompt to SQLite. `GET /api/v1/audit-logs` returns
the latest 20 audit records. Both v1 endpoints require the configured bearer
token.

### Frontend

In a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173` and paste the same `SAYZE_API_TOKEN` configured
for the backend into the token field. This is your app's bearer token, not the
Nebius or Tavily provider key. It is kept in browser memory only, so enter it
again after refreshing the page.

## Docker Compose

Create `backend/.env` from `backend/.env.example`, set your secrets, and run from
the project root:

```powershell
docker compose up --build
```

The frontend is served by Nginx at `http://localhost:5173`, and the API is at
`http://localhost:8000`.
Qdrant is available only to backend services on the internal Compose network
and is not exposed on the host. Compose persists the SQLite database and Qdrant
data in named volumes.

## Tests

Run the full backend orchestration from the project root. It executes security,
database, router, and integration tests, reports module coverage and a pass rate,
and exits with a non-zero status if tests or coverage reporting fail:

```powershell
py -m pip install -r backend/requirements.txt
py -m backend.tests.run_all_tests
```

You can also run the backend suites directly:

```powershell
py -m pytest backend/tests/test_security.py backend/tests/test_database.py backend/tests/test_router.py backend/tests/test_integration.py
```

Build and smoke-test the frontend Vite bundle:

```powershell
cd frontend
npm ci
npm run build
npm run preview
```

The production bundle is written to `frontend/dist`. With the preview server
running, open the local URL it prints (normally `http://localhost:4173`) to
smoke-test the built UI. A dedicated frontend unit-test runner is not currently
configured.

## Configuration

See [`backend/.env.example`](backend/.env.example) for supported settings,
including Nebius, Tavily, Qdrant, SQLite, and the API bearer token. Keep actual
credentials in the untracked `.env` file and rotate any token that is exposed.
Tavily and Qdrant client dependencies are included for subsequent retrieval
features; the initial chat route does not yet use those services.
=======
# SAYZE-OS
SAYZE OS solves cloud AI privacy by performing local PII sanitization via NVIDIA NemoClaw before routing payloads to state-of-the-art open-weights models on Nebius AI Cloud. It delivers enterprise-grade reasoning and Tavily-grounded web search while ensuring your sensitive personal data never leaves your device.
>>>>>>> ff1d527a7f6a3429ca618ff1cfe6f8d1c20970b2
