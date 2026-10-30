---
title: SAYZE OS Privacy Guardrail
emoji: 🛡️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
short_description: Interactive PII guardrail demo for SAYZE OS
---

# SAYZE OS Privacy Guardrail

An interactive demo of the PII redaction and restoration guardrail in the SAYZE
OS backend. Try the synthetic example or enter other **synthetic** text to see
emails, phone numbers, valid credit-card numbers, and SSNs replaced with
pseudonym tokens.

The demo runs the same `NemoClawGuardrail` class used by the backend API. The
second output is an echo-only simulation of restoring matching tokens; it does
not call Nebius, Tavily, or any other provider. The existing FastAPI endpoints
remain available alongside the Gradio interface.

**Do not enter real personal or confidential information.** This Space runs on
Hugging Face infrastructure, and text submitted to the UI is processed by the
Space server. The backend's redaction-before-provider flow is not a guarantee
that every sensitive value will be detected.

## Run locally

From the repository root, install the backend dependencies and start the demo:

```powershell
py -m pip install -r backend/requirements.txt
$env:PORT = "7860"
uvicorn backend.demo:app --host 0.0.0.0 --port $env:PORT
```

Open `http://localhost:7860`. The FastAPI endpoints are also available, for
example `/health`, `/api/health`, and `/docs`.

This Space is built from the `backend` folder using its Dockerfile.
