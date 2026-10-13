"""Journal des contrôles GitHub (qualité, tests, déploiement, relecture).

Révision : 0001
Précédente : aucune
"""

from __future__ import annotations

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE prospection.controles_ci (
            id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            cree_le       timestamptz NOT NULL DEFAULT now(),
            depot         text NOT NULL,
            workflow      text NOT NULL,
            evenement     text NOT NULL,
            branche       text NOT NULL,
            pr_numero     integer,
            commit_sha    text NOT NULL,
            conclusion    text NOT NULL CHECK (conclusion IN ('success', 'failure', 'cancelled')),
            resultats     jsonb NOT NULL DEFAULT '{}'::jsonb,
            url_execution text NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX controles_ci_cree_le_idx ON prospection.controles_ci (cree_le DESC)")
    # Aucune politique : la table n'est accessible ni à la clé publique ni aux utilisateurs
    # connectés, seulement aux connexions directes avec le mot de passe de la base.
    op.execute("ALTER TABLE prospection.controles_ci ENABLE ROW LEVEL SECURITY")
    op.execute(
        "COMMENT ON TABLE prospection.controles_ci IS "
        "'Résultat des contrôles GitHub Actions, écrit par scripts/journaliser_controles.py'"
    )


def downgrade() -> None:
    op.execute("DROP TABLE prospection.controles_ci")
