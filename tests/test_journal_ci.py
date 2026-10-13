"""Journal des contrôles GitHub dans la base PostgreSQL (scripts/journaliser_controles.py)."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from types import ModuleType

import pytest

pytestmark = pytest.mark.unit

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "journaliser_controles.py"

ENV = {
    "GITHUB_REPOSITORY": "wmoussaouipro-22/Agent-IA-1",
    "GITHUB_WORKFLOW": "CI",
    "GITHUB_EVENT_NAME": "pull_request",
    "GITHUB_HEAD_REF": "claude/branche",
    "GITHUB_REF_NAME": "1/merge",
    "GITHUB_SHA": "merge-sha",
    "HEAD_SHA": "head-sha",
    "PR_NUMBER": "1",
    "GITHUB_SERVER_URL": "https://github.com",
    "GITHUB_RUN_ID": "42",
}


@pytest.fixture
def journal() -> ModuleType:
    spec = importlib.util.spec_from_file_location("journaliser_controles", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _steps(**outcomes: str) -> str:
    return json.dumps(
        {k: {"outcome": v, "conclusion": v, "outputs": {}} for k, v in outcomes.items()}
    )


def test_ligne_d_une_pr(journal: ModuleType) -> None:
    row = journal.build_row({**ENV, "STEPS": _steps(ruff="success", unit="failure")})
    assert row["branche"] == "claude/branche"
    assert row["pr_numero"] == 1
    assert row["commit_sha"] == "head-sha"
    assert row["conclusion"] == "failure"
    assert json.loads(row["resultats"]) == {"ruff": "success", "unit": "failure"}
    assert row["url_execution"] == "https://github.com/wmoussaouipro-22/Agent-IA-1/actions/runs/42"


def test_ligne_d_un_push_sur_main(journal: ModuleType) -> None:
    env = {k: v for k, v in ENV.items() if k not in {"GITHUB_HEAD_REF", "HEAD_SHA", "PR_NUMBER"}}
    row = journal.build_row({**env, "GITHUB_REF_NAME": "main", "STEPS": _steps(ruff="success")})
    assert (row["branche"], row["pr_numero"], row["commit_sha"]) == ("main", None, "merge-sha")
    assert row["conclusion"] == "success"


def test_etape_ignoree_ne_fait_pas_echouer(journal: ModuleType) -> None:
    row = journal.build_row({**ENV, "STEPS": _steps(ruff="success", migrations_prod="skipped")})
    assert row["conclusion"] == "success"


def test_l_etape_journal_n_est_pas_journalisee(journal: ModuleType) -> None:
    row = journal.build_row({**ENV, "STEPS": _steps(ruff="success", journal="success")})
    assert "journal" not in json.loads(row["resultats"])


def test_sans_base_le_script_n_echoue_pas(
    journal: ModuleType, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert journal.main() == 0
    assert "DATABASE_URL absent" in capsys.readouterr().out


def test_base_injoignable_le_script_n_echoue_pas(
    journal: ModuleType, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://x:y@127.0.0.1:1/z")
    for key, value in {**ENV, "STEPS": _steps(ruff="success")}.items():
        monkeypatch.setenv(key, value)
    assert journal.main() == 0
    assert "Journal non écrit" in capsys.readouterr().out
