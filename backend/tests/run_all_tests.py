"""Run the backend test suites with coverage and summarize readiness."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
TEST_FILES = (
    "backend/tests/test_security.py",
    "backend/tests/test_database.py",
    "backend/tests/test_router.py",
    "backend/tests/test_integration.py",
)
COVERAGE_MODULES = (
    "backend.main",
    "backend.config",
    "backend.database",
    "backend.engine",
    "backend.security",
)
OUTCOME_PATTERN = re.compile(r"(\d+)\s+(passed|failed|error|errors|skipped|xfailed|xpassed)")
COVERAGE_PATTERN = re.compile(
    r"^TOTAL\s+\d+\s+\d+\s+(\d+(?:\.\d+)?%)\s*$",
    re.MULTILINE,
)


def main() -> int:
    command = [
        sys.executable,
        "-m",
        "pytest",
        "-q",
        *TEST_FILES,
        *(f"--cov={module}" for module in COVERAGE_MODULES),
        "--cov-report=term-missing",
    ]

    print("Running SAYZE OS backend tests and coverage...\n", flush=True)
    try:
        result = subprocess.run(
            command,
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except OSError as exc:
        print(f"Could not start pytest: {exc}", file=sys.stderr)
        print("Readiness: NOT READY")
        return 1

    output = result.stdout + result.stderr
    if output:
        print(output, end="" if output.endswith("\n") else "\n")

    counts = {
        "passed": 0,
        "failed": 0,
        "errors": 0,
        "skipped": 0,
        "xfailed": 0,
        "xpassed": 0,
    }
    for raw_count, outcome in OUTCOME_PATTERN.findall(output):
        normalized_outcome = "errors" if outcome in {"error", "errors"} else outcome
        counts[normalized_outcome] += int(raw_count)

    completed = counts["passed"] + counts["failed"] + counts["errors"]
    pass_rate = counts["passed"] / completed * 100 if completed else 0
    coverage_match = COVERAGE_PATTERN.search(output)
    coverage = coverage_match.group(1) if coverage_match else "unavailable"

    ready = result.returncode == 0 and completed > 0 and coverage_match is not None
    print("\nBackend test summary")
    print("--------------------")
    print(
        f"Tests: {counts['passed']} passed, {counts['failed']} failed, "
        f"{counts['errors']} errors, {counts['skipped']} skipped"
    )
    print(f"Pass rate: {pass_rate:.1f}%")
    print(f"Backend module coverage: {coverage}")
    print(f"Readiness: {'READY' if ready else 'NOT READY'}")

    return 0 if ready else (result.returncode or 1)


if __name__ == "__main__":
    raise SystemExit(main())
