"""F2 · Recherche géolocalisée par zone et métier (API Google Places)."""

from __future__ import annotations

import json
import os
from types import ModuleType

import pytest

from conftest import FakeHttp


@pytest.mark.integration
def test_cle_api_lue_depuis_l_environnement(
    geoloc: ModuleType, fake_http: FakeHttp, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "cle-de-test")
    client = geoloc.PlacesClient(http=fake_http)
    client.search(city="Paris 11e", sector="boulangerie", radius_km=2)
    _, _, headers = fake_http.calls[0]
    assert "cle-de-test" in headers.values()


@pytest.mark.integration
def test_cle_api_absente(geoloc: ModuleType, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)
    with pytest.raises(geoloc.MissingApiKeyError):
        geoloc.PlacesClient()


@pytest.mark.integration
def test_requete_contient_ville_et_metier(geoloc: ModuleType, fake_http: FakeHttp) -> None:
    client = geoloc.PlacesClient(api_key="k", http=fake_http)
    client.search(city="Paris 11e", sector="boulangerie", radius_km=2)
    _, payload, _ = fake_http.calls[0]
    serialized = json.dumps(payload, ensure_ascii=False)
    assert "Paris 11e" in serialized
    assert "boulangerie" in serialized


@pytest.mark.integration
def test_conversion_des_resultats(geoloc: ModuleType, fake_http: FakeHttp) -> None:
    client = geoloc.PlacesClient(api_key="k", http=fake_http)
    places = client.search(city="Paris 11e", sector="boulangerie", radius_km=2)

    assert len(places) == 2
    first = places[0]
    assert first.name == "Boulangerie du Marché"
    assert first.sector == "boulangerie"
    assert first.address == "12 Rue Oberkampf, 75011 Paris, France"
    assert first.phone == "01 43 00 00 01"
    assert first.website == "https://boulangerie-du-marche.example"
    assert first.latitude == pytest.approx(48.8650)
    assert first.longitude == pytest.approx(2.3780)
    assert first.opening_hours[1] == "mardi: 07:00 – 20:00"


@pytest.mark.integration
def test_champs_optionnels_absents(geoloc: ModuleType, fake_http: FakeHttp) -> None:
    client = geoloc.PlacesClient(api_key="k", http=fake_http)
    second = client.search(city="Paris 11e", sector="boulangerie", radius_km=2)[1]
    assert second.phone is None
    assert second.website is None
    assert second.opening_hours == []


@pytest.mark.integration
@pytest.mark.parametrize("radius", [0, -1])
def test_rayon_invalide(geoloc: ModuleType, fake_http: FakeHttp, radius: float) -> None:
    client = geoloc.PlacesClient(api_key="k", http=fake_http)
    with pytest.raises(ValueError):
        client.search(city="Paris", sector="boulangerie", radius_km=radius)


@pytest.mark.unit
def test_affichage_des_horaires_a_defaut_d_affluence(
    geoloc: ModuleType, fake_http: FakeHttp
) -> None:
    client = geoloc.PlacesClient(api_key="k", http=fake_http)
    place = client.search(city="Paris 11e", sector="boulangerie", radius_km=2)[0]
    assert "mardi: 07:00 – 20:00" in geoloc.activity_info(place)


@pytest.mark.unit
def test_affichage_sans_horaires(geoloc: ModuleType, fake_http: FakeHttp) -> None:
    client = geoloc.PlacesClient(api_key="k", http=fake_http)
    place = client.search(city="Paris 11e", sector="boulangerie", radius_km=2)[1]
    assert geoloc.activity_info(place).strip() != ""


@pytest.mark.unit
def test_distance_paris_lyon(geoloc: ModuleType) -> None:
    km = geoloc.distance_km(48.8566, 2.3522, 45.7640, 4.8357)
    assert km == pytest.approx(392, abs=5)


@pytest.mark.unit
def test_distance_nulle(geoloc: ModuleType) -> None:
    assert geoloc.distance_km(48.85, 2.35, 48.85, 2.35) == pytest.approx(0)


@pytest.mark.integration
@pytest.mark.live
@pytest.mark.skipif(
    not os.getenv("GOOGLE_PLACES_API_KEY"), reason="GOOGLE_PLACES_API_KEY non définie"
)
def test_appel_reel_google_places(geoloc: ModuleType) -> None:
    places = geoloc.PlacesClient().search(city="Paris 11e", sector="boulangerie", radius_km=1)
    assert places, "Aucun résultat renvoyé par l'API réelle"
    assert all(p.name and p.address for p in places)
