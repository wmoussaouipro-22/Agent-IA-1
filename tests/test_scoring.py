"""F4 · Tri par potentiel : score déterministe (secteur, contact direct, distance).

Les poids exacts ne sont pas fixés par le cahier des charges : ces tests vérifient les
propriétés attendues du score, pas des valeurs précises.
"""

from __future__ import annotations

from collections.abc import Callable
from types import ModuleType
from typing import Any

import pytest

pytestmark = pytest.mark.unit


def test_secteurs_de_reference_ponderes(scoring: ModuleType) -> None:
    for sector in ("boulangerie", "boucherie", "restaurant"):
        assert sector in scoring.SECTOR_WEIGHTS


def test_deterministe(scoring: ModuleType) -> None:
    results = {scoring.compute_score("boulangerie", True, 1.5) for _ in range(20)}
    assert len(results) == 1


def test_score_positif(scoring: ModuleType) -> None:
    assert scoring.compute_score("inconnu", False, 50.0) >= 0


def test_contact_direct_augmente_le_score(scoring: ModuleType) -> None:
    assert scoring.compute_score("boulangerie", True, 2.0) > scoring.compute_score(
        "boulangerie", False, 2.0
    )


def test_proximite_augmente_le_score(scoring: ModuleType) -> None:
    near = scoring.compute_score("boulangerie", True, 0.5)
    mid = scoring.compute_score("boulangerie", True, 3.0)
    far = scoring.compute_score("boulangerie", True, 15.0)
    assert near > mid > far


def test_poids_du_secteur(scoring: ModuleType) -> None:
    weights = scoring.SECTOR_WEIGHTS
    heavy = max(weights, key=weights.get)
    light = min(weights, key=weights.get)
    if weights[heavy] == weights[light]:
        pytest.skip("Tous les secteurs ont le même poids")
    assert scoring.compute_score(heavy, True, 2.0) > scoring.compute_score(light, True, 2.0)


def test_secteur_inconnu_ne_depasse_pas_les_secteurs_connus(scoring: ModuleType) -> None:
    unknown = scoring.compute_score("cordonnerie", True, 2.0)
    for sector in scoring.SECTOR_WEIGHTS:
        assert unknown <= scoring.compute_score(sector, True, 2.0)


def test_secteur_insensible_a_la_casse(scoring: ModuleType) -> None:
    assert scoring.compute_score("Boulangerie", True, 2.0) == scoring.compute_score(
        "boulangerie", True, 2.0
    )


def test_distance_negative_refusee(scoring: ModuleType) -> None:
    with pytest.raises(ValueError):
        scoring.compute_score("boulangerie", True, -1.0)


@pytest.mark.parametrize(
    ("contact", "expected"),
    [
        ({"phone": "01 00 00 00 00", "email": None}, True),
        ({"phone": None, "email": "contact@exemple.fr"}, True),
        ({"phone": None, "email": None, "website": "https://exemple.fr"}, False),
        ({"phone": None, "email": None}, False),
    ],
)
def test_contact_direct_telephone_ou_email(
    scoring: ModuleType,
    make_prospect: Callable[..., Any],
    contact: dict[str, Any],
    expected: bool,
) -> None:
    p = make_prospect(**contact)
    assert scoring.score_prospect(p, 2.0) == scoring.compute_score(p.sector, expected, 2.0)


def test_classement_par_score_decroissant(
    scoring: ModuleType, make_prospect: Callable[..., Any]
) -> None:
    near_with_phone = make_prospect(name="A", address="1 rue A")
    far_with_phone = make_prospect(name="B", address="2 rue B")
    near_no_contact = make_prospect(name="C", address="3 rue C", phone=None)
    ranked = scoring.rank([(far_with_phone, 12.0), (near_no_contact, 0.5), (near_with_phone, 0.5)])
    assert ranked[0] is near_with_phone
    assert {p.name for p in ranked} == {"A", "B", "C"}


def test_classement_stable_a_score_egal(
    scoring: ModuleType, make_prospect: Callable[..., Any]
) -> None:
    b = make_prospect(name="Boulangerie B", address="2 rue B")
    a = make_prospect(name="Boulangerie A", address="1 rue A")
    assert [p.name for p in scoring.rank([(b, 1.0), (a, 1.0)])] == [
        "Boulangerie A",
        "Boulangerie B",
    ]
