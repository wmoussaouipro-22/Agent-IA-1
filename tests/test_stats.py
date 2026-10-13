"""F7 · Compteur d'équipe : indicateurs hebdomadaires agrégés, sans données individuelles."""

from __future__ import annotations

import dataclasses
from datetime import date, datetime
from types import ModuleType
from typing import Any

import pytest

pytestmark = pytest.mark.unit

WEEK = date(2026, 11, 2)  # lundi


def _events(stats: ModuleType) -> list[Any]:
    contacted, appointment = stats.ActivityKind.CONTACTED, stats.ActivityKind.APPOINTMENT
    rows = [
        ("com-1", contacted, datetime(2026, 11, 2, 9)),
        ("com-1", contacted, datetime(2026, 11, 3, 10)),
        ("com-2", contacted, datetime(2026, 11, 4, 11)),
        ("com-3", contacted, datetime(2026, 11, 8, 23, 59)),  # dimanche : inclus
        ("com-1", appointment, datetime(2026, 11, 5, 15)),
        ("com-4", contacted, datetime(2026, 11, 9, 0, 0)),  # semaine suivante : exclu
        ("com-4", appointment, datetime(2026, 11, 1, 18)),  # semaine précédente : exclu
    ]
    return [stats.ActivityEvent(commercial_id=c, kind=k, at=at) for c, k, at in rows]


def test_indicateurs_de_la_semaine(stats: ModuleType) -> None:
    result = stats.team_stats_for_week(_events(stats), WEEK)
    assert result.contacted == 4
    assert result.appointments == 1
    assert result.conversion_rate == pytest.approx(0.25)


def test_semaine_vide(stats: ModuleType) -> None:
    result = stats.team_stats_for_week([], WEEK)
    assert (result.contacted, result.appointments, result.conversion_rate) == (0, 0, 0.0)


def test_aucune_donnee_individuelle_exposee(stats: ModuleType) -> None:
    result = stats.team_stats_for_week(_events(stats), WEEK)
    names = {f.name for f in dataclasses.fields(result)}
    assert names == {"contacted", "appointments", "conversion_rate"}


def test_resultat_independant_de_qui_a_agi(stats: ModuleType) -> None:
    events = _events(stats)
    anonymised = [dataclasses.replace(e, commercial_id="x") for e in events]
    assert stats.team_stats_for_week(events, WEEK) == stats.team_stats_for_week(anonymised, WEEK)
