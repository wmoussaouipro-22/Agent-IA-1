"""Écrit le résultat d'une exécution GitHub Actions dans la base (prospection.controles_ci).

Appelé en dernière étape des workflows avec `STEPS: ${{ toJSON(steps) }}`. Sans la variable
DATABASE_URL (secret absent, PR venant d'un fork), le script signale l'absence et n'échoue pas :
le journal ne doit jamais faire échouer les contrôles eux-mêmes.
"""

from __future__ import annotations

import json
import os
import sys
from collections.abc import Mapping
from typing import Any

INSERT = """
INSERT INTO prospection.controles_ci
    (depot, workflow, evenement, branche, pr_numero, commit_sha, conclusion, resultats,
     url_execution)
VALUES (%(depot)s, %(workflow)s, %(evenement)s, %(branche)s, %(pr_numero)s, %(commit_sha)s,
        %(conclusion)s, %(resultats)s, %(url_execution)s)
"""


def build_row(env: Mapping[str, str]) -> dict[str, Any]:
    """Construit la ligne à insérer à partir des variables d'environnement de GitHub Actions."""
    steps: dict[str, Any] = json.loads(env.get("STEPS") or "{}")
    resultats = {
        step_id: step.get("outcome", "skipped")
        for step_id, step in steps.items()
        if step_id != "journal"
    }
    if any(outcome == "failure" for outcome in resultats.values()):
        conclusion = "failure"
    elif any(outcome == "cancelled" for outcome in resultats.values()):
        conclusion = "cancelled"
    else:
        conclusion = "success"

    pr_numero = env.get("PR_NUMBER") or None
    return {
        "depot": env["GITHUB_REPOSITORY"],
        "workflow": env["GITHUB_WORKFLOW"],
        "evenement": env["GITHUB_EVENT_NAME"],
        "branche": env.get("GITHUB_HEAD_REF") or env["GITHUB_REF_NAME"],
        "pr_numero": int(pr_numero) if pr_numero else None,
        "commit_sha": env.get("HEAD_SHA") or env["GITHUB_SHA"],
        "conclusion": conclusion,
        "resultats": json.dumps(resultats),
        "url_execution": (
            f"{env['GITHUB_SERVER_URL']}/{env['GITHUB_REPOSITORY']}"
            f"/actions/runs/{env['GITHUB_RUN_ID']}"
        ),
    }


def main() -> int:
    url = os.getenv("DATABASE_URL")
    if not url:
        print("::warning::DATABASE_URL absent : résultat non journalisé dans la base.")
        return 0

    import psycopg

    row = build_row(os.environ)
    try:
        with psycopg.connect(url, connect_timeout=15) as conn:
            conn.execute(INSERT, row)
    except psycopg.Error as exc:
        # Base injoignable ou table absente (migrations pas encore appliquées) : on signale.
        print(f"::warning::Journal non écrit dans la base : {type(exc).__name__}")
        return 0
    print(f"Journalisé dans la base : {row['workflow']} → {row['conclusion']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
