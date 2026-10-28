from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from hashlib import sha256

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAIError
from pydantic import BaseModel, ConfigDict, Field
from requests.exceptions import RequestException
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from tavily import (
    BadRequestError as TavilyBadRequestError,
    InvalidAPIKeyError as TavilyInvalidAPIKeyError,
    KeylessUnsupportedEndpointError as TavilyKeylessUnsupportedEndpointError,
    MissingAPIKeyError as TavilyMissingAPIKeyError,
    UsageLimitExceededError as TavilyUsageLimitExceededError,
)
from tavily.errors import ForbiddenError as TavilyForbiddenError
from tavily.errors import TimeoutError as TavilyTimeoutError

from backend.config.settings import get_settings
from backend.database.connection import AuditLog, get_db, init_db
from backend.engine.router import execute_agent_task, router
from backend.security.nemoclaw import NemoClawGuardrail, require_api_token

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


app = FastAPI(
    title="SAYZE OS Core Engine",
    description="A zero-trust personal AI assistant API.",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in settings.FRONTEND_ORIGIN.split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)


class AgentRequest(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    prompt: str = Field(min_length=1, max_length=10_000)


class AgentResponse(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    sanitized_prompt: str
    raw_response: str
    final_response: str
    pii_tokens_protected: int
    model_used: str


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    id: int
    prompt_hash: str
    pii_tokens_masked: int
    model_used: str
    timestamp: datetime


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "timestamp": datetime.now(UTC).isoformat(),
        "environment": settings.ENVIRONMENT,
    }


@app.post(
    "/api/v1/execute",
    response_model=AgentResponse,
    dependencies=[Depends(require_api_token)],
)
async def execute(
    request: AgentRequest,
    db: Session = Depends(get_db),
) -> AgentResponse:
    guardrail = NemoClawGuardrail()
    sanitized_prompt, redaction_map, pii_count = guardrail.sanitize_prompt(
        request.prompt
    )
    try:
        raw_response, model_used = await run_in_threadpool(
            execute_agent_task,
            sanitized_prompt,
        )
    except OpenAIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Assistant provider request failed",
        ) from exc
    except (
        TavilyBadRequestError,
        TavilyForbiddenError,
        TavilyInvalidAPIKeyError,
        TavilyKeylessUnsupportedEndpointError,
        TavilyMissingAPIKeyError,
        TavilyTimeoutError,
        TavilyUsageLimitExceededError,
        RequestException,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Web search provider request failed",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    final_response = guardrail.restore_response(raw_response, redaction_map)
    audit_log = AuditLog(
        prompt_hash=sha256(sanitized_prompt.encode("utf-8")).hexdigest(),
        pii_tokens_masked=pii_count,
        model_used=model_used,
    )
    try:
        db.add(audit_log)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise

    return AgentResponse(
        sanitized_prompt=sanitized_prompt,
        raw_response=raw_response,
        final_response=final_response,
        pii_tokens_protected=pii_count,
        model_used=model_used,
    )


@app.get(
    "/api/v1/audit-logs",
    response_model=list[AuditLogResponse],
    dependencies=[Depends(require_api_token)],
)
def audit_logs(db: Session = Depends(get_db)) -> list[AuditLogResponse]:
    records = db.scalars(
        select(AuditLog)
        .order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
        .limit(20)
    ).all()
    return [
        AuditLogResponse(
            id=record.id,
            prompt_hash=record.prompt_hash,
            pii_tokens_masked=record.pii_tokens_masked,
            model_used=record.model_used,
            timestamp=record.timestamp,
        )
        for record in records
    ]
