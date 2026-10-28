from fastapi.testclient import TestClient
from pydantic import SecretStr

from backend.config.settings import Settings, get_settings
from backend.main import app
from backend.security.nemoclaw import NemoClawGuardrail


def test_chat_rejects_missing_token() -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        SAYZE_API_TOKEN=SecretStr("test-token")
    )
    try:
        response = TestClient(app).post("/api/chat", json={"message": "Hello"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_chat_rejects_invalid_token() -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        SAYZE_API_TOKEN=SecretStr("test-token")
    )
    try:
        response = TestClient(app).post(
            "/api/chat",
            json={"message": "Hello"},
            headers={"Authorization": "Bearer wrong-token"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 401


def test_sanitize_redacts_email() -> None:
    sanitized, redaction_map, pii_count = NemoClawGuardrail().sanitize_prompt(
        "Contact me at alex@example.com."
    )

    assert sanitized == "Contact me at [EMAIL_TOKEN_0]."
    assert redaction_map == {"[EMAIL_TOKEN_0]": "alex@example.com"}
    assert pii_count == 1


def test_sanitize_redacts_phone_number() -> None:
    sanitized, redaction_map, pii_count = NemoClawGuardrail().sanitize_prompt(
        "Call me at (415) 555-0132."
    )

    assert sanitized == "Call me at [PHONE_TOKEN_0]."
    assert redaction_map == {"[PHONE_TOKEN_0]": "(415) 555-0132"}
    assert pii_count == 1


def test_sanitize_redacts_credit_card() -> None:
    sanitized, redaction_map, pii_count = NemoClawGuardrail().sanitize_prompt(
        "Card number: 4111 1111 1111 1111."
    )

    assert sanitized == "Card number: [CREDIT_CARD_TOKEN_0]."
    assert redaction_map == {"[CREDIT_CARD_TOKEN_0]": "4111 1111 1111 1111"}
    assert pii_count == 1


def test_sanitize_avoids_colliding_with_token_text_in_user_prompt() -> None:
    prompt = "Keep [EMAIL_TOKEN_0] literal; contact alex@example.com."
    guardrail = NemoClawGuardrail()

    sanitized, redaction_map, pii_count = guardrail.sanitize_prompt(prompt)
    restored = guardrail.restore_response(sanitized, redaction_map)

    assert sanitized == "Keep [EMAIL_TOKEN_0] literal; contact [EMAIL_TOKEN_1]."
    assert pii_count == 1
    assert restored == prompt


def test_sanitize_does_not_restore_unknown_token_like_text() -> None:
    prompt = "The literal token [EMAIL_TOKEN_0] is not a real email."
    guardrail = NemoClawGuardrail()

    sanitized, redaction_map, pii_count = guardrail.sanitize_prompt(prompt)

    assert sanitized == prompt
    assert redaction_map == {}
    assert pii_count == 0
    assert guardrail.restore_response(sanitized, redaction_map) == prompt


def test_sanitize_redacts_ssn() -> None:
    sanitized, redaction_map, pii_count = NemoClawGuardrail().sanitize_prompt(
        "SSN: 123-45-6789."
    )

    assert sanitized == "SSN: [SSN_TOKEN_0]."
    assert redaction_map == {"[SSN_TOKEN_0]": "123-45-6789"}
    assert pii_count == 1


def test_restore_response_reinjects_all_original_values_exactly() -> None:
    original = (
        "Email alex@example.com, phone (415) 555-0132, "
        "card 4111 1111 1111 1111, SSN 123-45-6789."
    )
    guardrail = NemoClawGuardrail()
    sanitized, redaction_map, pii_count = guardrail.sanitize_prompt(original)

    restored = guardrail.restore_response(
        f"Your details: {sanitized}",
        redaction_map,
    )

    assert pii_count == 4
    assert restored == f"Your details: {original}"


def test_non_sensitive_text_passes_unchanged() -> None:
    raw_text = "Please summarize the project milestones."

    sanitized, redaction_map, pii_count = NemoClawGuardrail().sanitize_prompt(
        raw_text
    )

    assert sanitized == raw_text
    assert redaction_map == {}
    assert pii_count == 0
