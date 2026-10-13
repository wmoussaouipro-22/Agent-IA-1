"""F3 · Fiche prospect automatique, anti-doublons, RGPD et statuts."""

from __future__ import annotations

from collections.abc import Callable
from types import ModuleType
from typing import Any

import pytest

from conftest import FakeHttp

pytestmark = pytest.mark.unit


def test_fiche_creee_depuis_un_resultat_de_recherche(
    prospects: ModuleType, geoloc: ModuleType, fake_http: FakeHttp
) -> None:
    place = geoloc.PlacesClient(api_key="k", http=fake_http).search(
        city="Paris 11e", sector="boulangerie", radius_km=2
    )[0]
    p = prospects.prospect_from_place(place)
    assert p.name == "Boulangerie du Marché"
    assert p.sector == "boulangerie"
    assert p.address == "12 Rue Oberkampf, 75011 Paris, France"
    assert p.phone == "01 43 00 00 01"
    assert p.website == "https://boulangerie-du-marche.example"
    assert p.stage == prospects.Stage.NOUVEAU


def test_rgpd_identite_du_gerant_facultative(
    prospects: ModuleType, make_prospect: Callable[..., Any]
) -> None:
    p = make_prospect()
    assert p.manager_first_name is None
    assert p.manager_last_name is None
    repo = prospects.ProspectRepository()
    repo.add(p)  # aucune erreur sans identité du gérant


def test_rgpd_identite_du_gerant_saisie_manuellement(make_prospect: Callable[..., Any]) -> None:
    p = make_prospect(manager_first_name="Camille", manager_last_name="Durand")
    assert (p.manager_first_name, p.manager_last_name) == ("Camille", "Durand")


def test_rgpd_jamais_remplie_automatiquement(
    prospects: ModuleType, geoloc: ModuleType, fake_http: FakeHttp
) -> None:
    places = geoloc.PlacesClient(api_key="k", http=fake_http).search(
        city="Paris 11e", sector="boulangerie", radius_km=2
    )
    for place in places:
        p = prospects.prospect_from_place(place)
        assert p.manager_first_name is None and p.manager_last_name is None


def test_doublon_bloque(prospects: ModuleType, make_prospect: Callable[..., Any]) -> None:
    repo = prospects.ProspectRepository()
    repo.add(make_prospect())
    with pytest.raises(prospects.DuplicateProspectError):
        repo.add(make_prospect(phone="06 00 00 00 00"))


def test_doublon_insensible_a_la_casse_et_aux_espaces(
    prospects: ModuleType, make_prospect: Callable[..., Any]
) -> None:
    repo = prospects.ProspectRepository()
    repo.add(make_prospect())
    with pytest.raises(prospects.DuplicateProspectError):
        repo.add(
            make_prospect(
                name="  boulangerie DU marché ",
                address="12 rue Oberkampf,  75011 Paris, France",
            )
        )


@pytest.mark.parametrize(
    "overrides",
    [
        {"address": "40 Rue de Charonne, 75011 Paris, France"},  # même nom, autre adresse
        {"name": "Le Fournil"},  # même adresse, autre nom
    ],
)
def test_pas_un_doublon(
    prospects: ModuleType, make_prospect: Callable[..., Any], overrides: dict[str, str]
) -> None:
    repo = prospects.ProspectRepository()
    repo.add(make_prospect())
    repo.add(make_prospect(**overrides))
    assert len(repo.all()) == 2


def test_transition_nouveau_vers_contacte(
    prospects: ModuleType, make_prospect: Callable[..., Any]
) -> None:
    p = make_prospect()
    p.advance(prospects.Stage.CONTACTE)
    assert p.stage == prospects.Stage.CONTACTE


@pytest.mark.parametrize("target", ["RDV_PRIS", "EN_COURS", "PAS_INTERESSE"])
def test_transitions_depuis_contacte(
    prospects: ModuleType, make_prospect: Callable[..., Any], target: str
) -> None:
    p = make_prospect()
    p.advance(prospects.Stage.CONTACTE)
    p.advance(prospects.Stage[target])
    assert p.stage == prospects.Stage[target]


def test_transition_interdite(prospects: ModuleType, make_prospect: Callable[..., Any]) -> None:
    p = make_prospect()
    with pytest.raises(prospects.InvalidTransitionError):
        p.advance(prospects.Stage.RDV_PRIS)
    assert p.stage == prospects.Stage.NOUVEAU


def test_temperature(prospects: ModuleType, make_prospect: Callable[..., Any]) -> None:
    assert {t.name for t in prospects.Temperature} == {"CHAUD", "TIEDE", "FROID"}
    p = make_prospect(temperature=prospects.Temperature.TIEDE)
    assert p.temperature == prospects.Temperature.TIEDE
