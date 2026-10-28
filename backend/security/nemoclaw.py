import hmac
import re
from typing import Annotated
from typing import Dict, Tuple

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.config.settings import Settings, get_settings

bearer_scheme = HTTPBearer(auto_error=False)


class NemoClawGuardrail:
    _PATTERNS = {
        "EMAIL": re.compile(
            r"(?<![\w.+-])[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@"
            r"[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?"
            r"(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+",
            re.IGNORECASE,
        ),
        "CREDIT_CARD": re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)"),
        "SSN": re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)"),
        "PHONE": re.compile(
            r"(?<!\w)(?:\+\d{1,3}[\s.-]?)?"
            r"(?:\(\d{2,4}\)|\d{2,4})[\s.-]?"
            r"\d{3,4}[\s.-]?\d{3,4}(?!\w)"
        ),
    }

    def sanitize_prompt(self, raw_text: str) -> tuple[str, dict[str, str], int]:
        redaction_map: dict[str, str] = {}
        token_counts = {category: 0 for category in self._PATTERNS}
        pii_count = 0
        sanitized_text = raw_text

        for category, pattern in self._PATTERNS.items():
            def replace_match(match: re.Match[str], *, token_type: str = category) -> str:
                nonlocal pii_count
                original_value = match.group(0)
                if token_type == "PHONE":
                    digit_count = sum(character.isdigit() for character in original_value)
                    if digit_count < 7 or digit_count > 15:
                        return original_value
                elif token_type == "CREDIT_CARD" and not self._passes_luhn(
                    original_value
                ):
                    return original_value

                token_index = token_counts[token_type]
                token = f"[{token_type}_TOKEN_{token_index}]"
                while token in raw_text or token in redaction_map:
                    token_index += 1
                    token = f"[{token_type}_TOKEN_{token_index}]"
                token_counts[token_type] = token_index + 1
                redaction_map[token] = original_value
                pii_count += 1
                return token

            sanitized_text = pattern.sub(replace_match, sanitized_text)

        return sanitized_text, redaction_map, pii_count

    @staticmethod
    def _passes_luhn(value: str) -> bool:
        digits = [int(character) for character in value if character.isdigit()]
        checksum = 0
        parity = len(digits) % 2
        for index, digit in enumerate(digits):
            if index % 2 == parity:
                digit *= 2
                if digit > 9:
                    digit -= 9
            checksum += digit
        return len(digits) in range(13, 20) and checksum % 10 == 0

    def restore_response(self, text: str, redaction_map: dict[str, str]) -> str:
        if not redaction_map:
            return text

        token_pattern = re.compile(
            "|".join(re.escape(token) for token in redaction_map)
        )
        return token_pattern.sub(lambda match: redaction_map[match.group(0)], text)


def require_api_token(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    expected_token = settings.SAYZE_API_TOKEN.get_secret_value()
    if not expected_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API authentication is not configured",
        )
    if credentials is None or not hmac.compare_digest(
        credentials.credentials, expected_token
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
