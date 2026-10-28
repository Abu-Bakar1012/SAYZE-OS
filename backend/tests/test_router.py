from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
from pydantic import SecretStr

from backend.config.settings import Settings, get_settings
from backend.engine import router as agent_router
from backend.main import app


def test_nemotron_model_ids_match_nebius_catalog() -> None:
    assert agent_router.MODEL_REASONING == "nvidia/Nemotron-3-Ultra-550b-a55b"
    assert agent_router.MODEL_LIGHTNING == "nvidia/Nemotron-3_5-Lightning"


def test_health_endpoint() -> None:
    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_chat_validates_message_length() -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        SAYZE_API_TOKEN=SecretStr("test-token")
    )
    try:
        response = TestClient(app).post(
            "/api/chat",
            json={"message": "x" * 10_001},
            headers={"Authorization": "Bearer test-token"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422


def test_chat_rejects_coerced_and_extra_request_fields() -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        SAYZE_API_TOKEN=SecretStr("test-token")
    )
    try:
        with TestClient(app) as client:
            coerced_response = client.post(
                "/api/chat",
                json={"message": 123},
                headers={"Authorization": "Bearer test-token"},
            )
            extra_field_response = client.post(
                "/api/chat",
                json={"message": "Hello", "unexpected": True},
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.clear()

    assert coerced_response.status_code == 422
    assert extra_field_response.status_code == 422


@patch("backend.engine.router.TavilyClient")
@patch("backend.engine.router.OpenAI")
@patch("backend.engine.router.get_settings")
def test_search_intent_uses_tavily_and_lightning_model(
    mock_get_settings: Mock,
    mock_openai: Mock,
    mock_tavily: Mock,
) -> None:
    mock_get_settings.return_value = Settings(
        NEBIUS_API_KEY=SecretStr("nebius-test-key"),
        NEBIUS_BASE_URL="https://nebius.example/v1/",
        TAVILY_API_KEY=SecretStr("tavily-test-key"),
    )
    mock_tavily.return_value.search.return_value = {
        "results": [
            {
                "title": "Current forecast",
                "url": "https://example.com/weather",
                "content": "Sunny and 20 degrees.",
            }
        ]
    }
    mock_openai.return_value.chat.completions.create.return_value.choices[
        0
    ].message.content = "It will be sunny."

    result = agent_router.execute_agent_task("Search the latest weather")

    mock_tavily.assert_called_once_with(api_key="tavily-test-key")
    mock_tavily.return_value.search.assert_called_once_with(
        query="Search the latest weather",
        search_depth="basic",
        max_results=5,
    )
    mock_openai.assert_called_once_with(
        api_key="nebius-test-key",
        base_url="https://nebius.example/v1/",
    )
    completion_call = mock_openai.return_value.chat.completions.create.call_args
    assert completion_call.kwargs["model"] == agent_router.MODEL_LIGHTNING
    assert "Sunny and 20 degrees." in completion_call.kwargs["messages"][0]["content"]
    assert result == (
        "It will be sunny.",
        "Nemotron-3-5-Lightning + Tavily",
    )


@patch("backend.engine.router.TavilyClient")
@patch("backend.engine.router.OpenAI")
@patch("backend.engine.router.get_settings")
def test_non_search_intent_uses_reasoning_model_without_tavily(
    mock_get_settings: Mock,
    mock_openai: Mock,
    mock_tavily: Mock,
) -> None:
    mock_get_settings.return_value = Settings(
        NEBIUS_API_KEY=SecretStr("nebius-test-key"),
        NEBIUS_BASE_URL="https://nebius.example/v1/",
        TAVILY_API_KEY=SecretStr("tavily-test-key"),
    )
    mock_openai.return_value.chat.completions.create.return_value.choices[
        0
    ].message.content = "Here is a careful explanation."

    result = agent_router.execute_agent_task(
        "Explain how database indexes work."
    )

    mock_tavily.assert_not_called()
    completion_call = mock_openai.return_value.chat.completions.create.call_args
    assert completion_call.kwargs["model"] == agent_router.MODEL_REASONING
    assert completion_call.kwargs["messages"] == [
        {
            "role": "user",
            "content": "Explain how database indexes work.",
        }
    ]
    assert result == (
        "Here is a careful explanation.",
        "Nemotron-3-Ultra-550b",
    )
