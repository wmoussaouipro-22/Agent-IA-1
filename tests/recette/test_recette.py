"""Tests utilisateurs : parcours décrits dans `tests/recette/scenarios.md`."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime
from types import ModuleType
from typing import Any

import pytest

from conftest import CLEAN_BODY, UNSUBSCRIBE_URL, FakeGraph, FakeHttp, FakeLLM

pytestmark = pytest.mark.e2e

START = datetime(2026, 11, 3, 14, 0)
END = datetime(2026, 11, 3, 14, 45)


def _search(geoloc: ModuleType, http: FakeHttp) -> list[Any]:
    client = geoloc.PlacesClient(api_key="k", http=http)
    places: list[Any] = client.search(city="Paris 11e", sector="boulangerie", radius_km=2)
    return places


def test_r2_relancer_la_meme_recherche(
    geoloc: ModuleType, prospects: ModuleType, fake_http: FakeHttp
) -> None:
    repo = prospects.ProspectRepository()
    for place in _search(geoloc, fake_http):
        repo.add(prospects.prospect_from_place(place))
    contacted = repo.all()[0]
    contacted.advance(prospects.Stage.CONTACTE)

    for place in _search(geoloc, fake_http):  # le lendemain
        with pytest.raises(prospects.DuplicateProspectError):
            repo.add(prospects.prospect_from_place(place))

    assert len(repo.all()) == 2
    assert contacted.stage == prospects.Stage.CONTACTE


def test_r4_brouillon_non_conforme_rattrape(
    ai_email: ModuleType,
    make_prospect: Callable[..., Any],
    llm_factory: Callable[..., FakeLLM],
) -> None:
    bad = CLEAN_BODY.replace("sans engagement.", "pour économiser 500 € par an.")
    draft = ai_email.generate_draft(make_prospect(), llm_factory(bad, CLEAN_BODY), UNSUBSCRIBE_URL)
    assert "500" not in draft
    assert UNSUBSCRIBE_URL in draft
    assert ai_email.validate_draft(draft, UNSUBSCRIBE_URL) == set()


def test_r5_deux_commerciaux_le_meme_jour(
    auth: ModuleType,
    prospects: ModuleType,
    outlook: ModuleType,
    make_prospect: Callable[..., Any],
) -> None:
    lea = auth.create_session("lea", access_token="token-lea")
    karim = auth.create_session("karim", access_token="token-karim")
    p_lea = make_prospect()
    p_karim = make_prospect(name="Boucherie Martin", sector="boucherie", address="8 rue Keller")
    for p in (p_lea, p_karim):
        p.advance(prospects.Stage.CONTACTE)

    graph_lea, graph_karim = FakeGraph(), FakeGraph()
    outlook.book_appointment(lea, p_lea, START, END, graph_lea)
    outlook.book_appointment(karim, p_karim, START, END, graph_karim)

    assert [token for _, _, token in graph_lea.calls] == ["token-lea"]
    assert [token for _, _, token in graph_karim.calls] == ["token-karim"]
    with pytest.raises(auth.AccessDeniedError):
        auth.ensure_access(karim, "lea")


def test_r6_point_d_equipe(stats: ModuleType) -> None:
    contacted, appointment = stats.ActivityKind.CONTACTED, stats.ActivityKind.APPOINTMENT
    week = [
        ("lea", contacted, datetime(2026, 11, 2, 10)),
        ("karim", contacted, datetime(2026, 11, 3, 10)),
        ("sophie", contacted, datetime(2026, 11, 4, 10)),
        ("thomas", contacted, datetime(2026, 11, 5, 10)),
        ("lea", contacted, datetime(2026, 11, 6, 10)),
        ("lea", appointment, datetime(2026, 11, 4, 16)),
        ("karim", appointment, START),
    ]
    events = [stats.ActivityEvent(commercial_id=c, kind=k, at=at) for c, k, at in week]

    result = stats.team_stats_for_week(events, date(2026, 11, 2))

    assert (result.contacted, result.appointments) == (5, 2)
    assert result.conversion_rate == pytest.approx(0.4)
    assert not any(name in repr(result) for name in ("lea", "karim", "sophie", "thomas"))


def test_r7_outlook_indisponible_puis_retabli(
    auth: ModuleType,
    prospects: ModuleType,
    outlook: ModuleType,
    make_prospect: Callable[..., Any],
) -> None:
    session = auth.create_session("karim", access_token="token-karim")
    p = make_prospect()
    p.advance(prospects.Stage.CONTACTE)

    with pytest.raises(Exception):  # noqa: B017 - toute erreur doit remonter au commercial
        outlook.book_appointment(session, p, START, END, FakeGraph(fail=True))
    assert p.stage == prospects.Stage.CONTACTE

    graph = FakeGraph()
    outlook.book_appointment(session, p, START, END, graph)
    assert len(graph.calls) == 1
    assert p.stage == prospects.Stage.RDV_PRIS
