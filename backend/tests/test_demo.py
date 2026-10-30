from backend.demo import inspect_prompt


def test_inspect_prompt_shows_sanitized_and_restored_echo() -> None:
    sanitized, restored_echo, status = inspect_prompt(
        "Contact alex@example.com."
    )

    assert sanitized == "Contact [EMAIL_TOKEN_0]."
    assert restored_echo == "Echo-only simulation: Contact alex@example.com."
    assert status == "Detected and masked 1 sensitive value(s)."


def test_inspect_prompt_reports_empty_input() -> None:
    assert inspect_prompt(" \n") == ("", "", "Enter a prompt to inspect.")
