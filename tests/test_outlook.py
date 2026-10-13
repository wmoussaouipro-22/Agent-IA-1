"""F6 · RDV dans Outlook en un geste (Microsoft Graph simulé)."""

from __future__ import annotations

import re
from collections.abc import Callable
from datetime import datetime
from types import ModuleType
from typing import Any
from urllib.parse import unquote_plus

import pytest

from conftest import FakeGraph

pytestmark = pytest.mark.integration

START = datetime(2026, 11, 3, 14, 0)
END = datetime(2026, 11, 3, 14, 45)


@pytest.fixture
def contacted(prospects: ModuleType, make_prospect: Callable[..., Any]) -> Any:
    p = make_prospect()
    p.advance(prospects.Stage.CONTACTE)
    return p


def _book(outlook: ModuleType, auth: ModuleType, prospect: Any, graph: FakeGraph) -> Any:
    session = auth.create_session("com-1", access_token="token-a")
    return outlook.book_appointment(session, prospect, START, END, graph)


def test_evenement_cree_dans_l_agenda_du_commercial(
    outlook: ModuleType, auth: ModuleType, contacted: Any, fake_graph: FakeGraph
) -> None:
    _book(outlook, auth, contacted, fake_graph)
    assert len(fake_graph.calls) == 1
    path, _, token = fake_graph.calls[0]
    assert path == "/me/events"
    assert token == "token-a"


def test_adresse_exacte_et_horaires(
    outlook: ModuleType, auth: ModuleType, contacted: Any, fake_graph: FakeGraph
) -> None:
    _book(outlook, auth, contacted, fake_graph)
    _, payload, _ = fake_graph.calls[0]
    assert payload["location"]["displayName"] == contacted.address
    assert payload["start"]["dateTime"].startswith("2026-11-03T14:00")
    assert payload["end"]["dateTime"].startswith("2026-11-03T14:45")
    assert payload["start"]["timeZone"] == "Europe/Paris"


def test_lien_d_itineraire(
    outlook: ModuleType, auth: ModuleType, contacted: Any, fake_graph: FakeGraph
) -> None:
    _book(outlook, auth, contacted, fake_graph)
    content = fake_graph.calls[0][1]["body"]["content"]
    urls = [unquote_plus(u) for u in re.findall(r"https?://[^\s\"'<>]+", content)]
    assert any(contacted.address in u for u in urls), "aucun lien d'itinéraire vers l'adresse"


def test_fiche_argumentaire_rattachee(
    outlook: ModuleType,
    auth: ModuleType,
    ai_email: ModuleType,
    contacted: Any,
    fake_graph: FakeGraph,
) -> None:
    _book(outlook, auth, contacted, fake_graph)
    content = fake_graph.calls[0][1]["body"]["content"]
    sheet = ai_email.get_pitch_sheet(contacted.sector)
    assert sheet.best_time in content
    assert sheet.objections[0][0] in content


def test_statut_passe_a_rdv_pris(
    outlook: ModuleType,
    auth: ModuleType,
    prospects: ModuleType,
    contacted: Any,
    fake_graph: FakeGraph,
) -> None:
    _book(outlook, auth, contacted, fake_graph)
    assert contacted.stage == prospects.Stage.RDV_PRIS


def test_statut_inchange_si_outlook_echoue(
    outlook: ModuleType, auth: ModuleType, prospects: ModuleType, contacted: Any
) -> None:
    with pytest.raises(Exception):  # noqa: B017 - toute erreur doit remonter
        _book(outlook, auth, contacted, FakeGraph(fail=True))
    assert contacted.stage == prospects.Stage.CONTACTE


def test_fin_avant_debut_refusee(
    outlook: ModuleType, auth: ModuleType, contacted: Any, fake_graph: FakeGraph
) -> None:
    session = auth.create_session("com-1", access_token="token-a")
    with pytest.raises(ValueError):
        outlook.book_appointment(session, contacted, END, START, fake_graph)
    assert fake_graph.calls == []
