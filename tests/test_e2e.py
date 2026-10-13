"""Parcours complet en 5 étapes : recherche → fiche → tri → e-mail → RDV Outlook."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from types import ModuleType

import pytest

from conftest import CLEAN_BODY, UNSUBSCRIBE_URL, FakeGraph, FakeHttp, FakeLLM

pytestmark = pytest.mark.e2e

ORIGIN = (48.8606, 2.3770)  # point de départ du commercial (Paris 11e)


def test_parcours_complet(
    auth: ModuleType,
    geoloc: ModuleType,
    prospects: ModuleType,
    scoring: ModuleType,
    ai_email: ModuleType,
    outlook: ModuleType,
    fake_http: FakeHttp,
    fake_graph: FakeGraph,
    llm_factory: Callable[..., FakeLLM],
) -> None:
    session = auth.create_session("com-1", access_token="token-a")

    # 1. Recherche géolocalisée
    places = geoloc.PlacesClient(api_key="k", http=fake_http).search(
        city="Paris 11e", sector="boulangerie", radius_km=2
    )
    assert places

    # 2. Fiches prospects (avec anti-doublon : une 2e recherche n'ajoute rien)
    repo = prospects.ProspectRepository()
    for place in places:
        repo.add(prospects.prospect_from_place(place))
    for place in places:
        with pytest.raises(prospects.DuplicateProspectError):
            repo.add(prospects.prospect_from_place(place))
    assert len(repo.all()) == len(places)

    # 3. Tri par potentiel
    distances = {
        p.name: geoloc.distance_km(*ORIGIN, pl.latitude, pl.longitude)
        for p, pl in zip(repo.all(), places, strict=True)
    }
    ranked = scoring.rank([(p, distances[p.name]) for p in repo.all()])
    target = ranked[0]
    assert target.phone  # le prospect joignable directement passe en tête

    # 4. Prise de contact par e-mail
    draft = ai_email.generate_draft(target, llm_factory(CLEAN_BODY), UNSUBSCRIBE_URL)
    assert ai_email.validate_draft(draft, UNSUBSCRIBE_URL) == set()
    target.advance(prospects.Stage.CONTACTE)

    # 5. RDV inscrit dans Outlook
    outlook.book_appointment(
        session, target, datetime(2026, 11, 3, 14), datetime(2026, 11, 3, 14, 45), fake_graph
    )
    assert target.stage == prospects.Stage.RDV_PRIS
    assert fake_graph.calls[0][1]["location"]["displayName"] == target.address
