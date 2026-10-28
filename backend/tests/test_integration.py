from datetime import datetime
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.config.settings import Settings, get_settings
from backend.database.connection import Base, get_db
from backend.engine.router import MODEL_LIGHTNING
from backend.main import app


def test_execute_rejects_non_string_and_extra_request_fields() -> None:
    test_settings = Settings(SAYZE_API_TOKEN=SecretStr("test-token"))
    app.dependency_overrides[get_settings] = lambda: test_settings

    try:
        with patch("backend.main.init_db"), TestClient(app) as client:
            coerced_response = client.post(
                "/api/v1/execute",
                json={"prompt": 123},
                headers={"Authorization": "Bearer test-token"},
            )
            extra_field_response = client.post(
                "/api/v1/execute",
                json={"prompt": "Hello", "unexpected": True},
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.clear()

    assert coerced_response.status_code == 422
    assert extra_field_response.status_code == 422


def test_health_endpoint_returns_status_timestamp_and_environment() -> None:
    with patch("backend.main.init_db"), TestClient(app) as client:
        response = client.get("/health")
        cors_response = client.options(
            "/api/v1/execute",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["environment"] == "development"
    assert isinstance(datetime.fromisoformat(body["timestamp"]), datetime)
    assert cors_response.headers["access-control-allow-origin"] == (
        "http://localhost:5173"
    )


def test_execute_sanitizes_routes_restores_and_persists_audit_log() -> None:
    test_settings = Settings(
        NEBIUS_API_KEY=SecretStr("nebius-test-key"),
        NEBIUS_BASE_URL="https://nebius.example/v1/",
        TAVILY_API_KEY=SecretStr("tavily-test-key"),
        SAYZE_API_TOKEN=SecretStr("test-token"),
    )
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(test_engine)

    def override_get_db():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_db] = override_get_db

    with (
        patch("backend.main.init_db"),
        patch("backend.engine.router.get_settings", return_value=test_settings),
        patch("backend.engine.router.TavilyClient") as tavily_client,
        patch("backend.engine.router.OpenAI") as openai_client,
    ):
        tavily_client.return_value.search.return_value = {
            "results": [
                {
                    "title": "Weather",
                    "url": "https://example.com/weather",
                    "content": "Sunny today.",
                }
            ]
        }
        completion = Mock()
        completion.choices = [
            Mock(message=Mock(content="Forecast for [EMAIL_TOKEN_0]: sunny."))
        ]
        openai_client.return_value.chat.completions.create.return_value = completion

        try:
            with TestClient(app) as client:
                response = client.post(
                    "/api/v1/execute",
                    json={
                        "prompt": (
                            "Search for the latest weather for "
                            "alice@example.com"
                        )
                    },
                    headers={"Authorization": "Bearer test-token"},
                )
                audit_response = client.get(
                    "/api/v1/audit-logs",
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            app.dependency_overrides.clear()
            test_engine.dispose()

    assert response.status_code == 200
    body = response.json()
    assert body["sanitized_prompt"] == (
        "Search for the latest weather for [EMAIL_TOKEN_0]"
    )
    assert body["raw_response"] == "Forecast for [EMAIL_TOKEN_0]: sunny."
    assert body["final_response"] == "Forecast for alice@example.com: sunny."
    assert body["pii_tokens_protected"] == 1
    assert body["model_used"] == "Nemotron-3-5-Lightning + Tavily"

    tavily_client.return_value.search.assert_called_once_with(
        query="Search for the latest weather for [EMAIL_TOKEN_0]",
        search_depth="basic",
        max_results=5,
    )
    provider_call = openai_client.return_value.chat.completions.create.call_args
    assert provider_call.kwargs["model"] == MODEL_LIGHTNING
    assert "[EMAIL_TOKEN_0]" in provider_call.kwargs["messages"][1]["content"]
    assert "alice@example.com" not in provider_call.kwargs["messages"][1]["content"]

    assert audit_response.status_code == 200
    audit_logs = audit_response.json()
    assert len(audit_logs) == 1
    assert audit_logs[0]["pii_tokens_masked"] == 1
    assert audit_logs[0]["model_used"] == "Nemotron-3-5-Lightning + Tavily"
    assert "alice@example.com" not in audit_logs[0]["prompt_hash"]
