"""Directive n°3 : aucune clé d'API écrite en dur dans le dépôt."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

pytestmark = pytest.mark.unit

ROOT = Path(__file__).resolve().parent.parent
KEY_PATTERNS = {
    "Google": re.compile(r"AIza[0-9A-Za-z_\-]{35}"),
    "OpenAI": re.compile(r"sk-(?:proj-)?[A-Za-z0-9]{20,}"),
    "Anthropic": re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}"),
    "Secret Azure/Microsoft": re.compile(r"(?i)client_secret\s*=\s*[\"'][^\"']{16,}[\"']"),
}


def _source_files() -> list[Path]:
    files: list[Path] = []
    for folder in ("app", "db"):
        base = ROOT / folder
        if base.exists():
            files += [p for p in base.rglob("*") if p.suffix in {".py", ".toml", ".json", ".yml"}]
    return files


def test_aucune_cle_api_en_dur() -> None:
    leaks = [
        f"{path.relative_to(ROOT)} ({provider})"
        for path in _source_files()
        for provider, pattern in KEY_PATTERNS.items()
        if pattern.search(path.read_text(encoding="utf-8", errors="ignore"))
    ]
    assert not leaks, f"Clés d'API en dur détectées : {leaks}"


def test_fichier_env_ignore_par_git() -> None:
    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
    assert ".env" in gitignore
