"""Environnement Alembic : toutes les tables de l'assistant vivent dans le schéma `prospection`,
séparé du schéma `public`."""

from __future__ import annotations

import os

from alembic import context
from sqlalchemy import create_engine, pool

SCHEMA = "prospection"


def _database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("Variable DATABASE_URL absente (chaîne de connexion PostgreSQL).")
    # Pilote psycopg 3 pour SQLAlchemy.
    return url.replace("postgresql://", "postgresql+psycopg://", 1).replace(
        "postgres://", "postgresql+psycopg://", 1
    )


def _run() -> None:
    with context.begin_transaction():
        context.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
        context.run_migrations()


if context.is_offline_mode():
    context.configure(
        url=_database_url(),
        literal_binds=True,
        version_table_schema=SCHEMA,
        transaction_per_migration=True,
    )
    _run()
else:
    engine = create_engine(_database_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            version_table_schema=SCHEMA,
            transaction_per_migration=True,
        )
        _run()
