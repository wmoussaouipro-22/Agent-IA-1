"""Fixtures et doublures (fakes) partagées par toute la suite de tests.

Les modules de l'application (dossier `app/`) sont chargés via des fixtures plutôt que par
des `import` en tête de fichier : tant qu'un module n'existe pas, seuls les tests qui en
dépendent échouent, avec un message explicite, et le reste de la suite s'exécute.
Le contrat attendu de chaque module est décrit dans `tests/CONTRAT.md`.
"""

from __future__ import annotations

import importlib
from collections.abc import Callable
from dataclasses import dataclass, field
from types import ModuleType
from typing import Any

import pytest


def _load(name: str) -> ModuleType:
    try:
        return importlib.import_module(name)
    except ModuleNotFoundError as exc:
        if exc.name != name:
            raise
        pytest.fail(
            f"Module `app/{name}/` introuvable : à implémenter (voir tests/CONTRAT.md).",
            pytrace=False,
        )


@pytest.fixture
def auth() -> ModuleType:
    return _load("auth")


@pytest.fixture
def geoloc() -> ModuleType:
    return _load("geoloc")


@pytest.fixture
def prospects() -> ModuleType:
    return _load("prospects")


@pytest.fixture
def scoring() -> ModuleType:
    return _load("scoring")


@pytest.fixture
def ai_email() -> ModuleType:
    return _load("ai_email")


@pytest.fixture
def outlook() -> ModuleType:
    return _load("outlook")


@pytest.fixture
def stats() -> ModuleType:
    return _load("stats")


# --- Doublure de l'API Google Places (New) -------------------------------------------------

PLACES_RESPONSE: dict[str, Any] = {
    "places": [
        {
            "displayName": {"text": "Boulangerie du Marché"},
            "formattedAddress": "12 Rue Oberkampf, 75011 Paris, France",
            "nationalPhoneNumber": "01 43 00 00 01",
            "websiteUri": "https://boulangerie-du-marche.example",
            "location": {"latitude": 48.8650, "longitude": 2.3780},
            "regularOpeningHours": {
                "weekdayDescriptions": [
                    "lundi: Fermé",
                    "mardi: 07:00 – 20:00",
                    "mercredi: 07:00 – 20:00",
                ]
            },
        },
        {
            "displayName": {"text": "Au Pain Doré"},
            "formattedAddress": "3 Rue de la Roquette, 75011 Paris, France",
            "location": {"latitude": 48.8540, "longitude": 2.3720},
        },
    ]
}


@dataclass
class FakeHttp:
    """Remplace le client HTTP : enregistre les appels et renvoie une réponse figée."""

    response: dict[str, Any] = field(default_factory=lambda: PLACES_RESPONSE)
    calls: list[tuple[str, dict[str, Any], dict[str, str]]] = field(default_factory=list)

    def __call__(
        self, url: str, payload: dict[str, Any], headers: dict[str, str]
    ) -> dict[str, Any]:
        self.calls.append((url, payload, headers))
        return self.response


@pytest.fixture
def fake_http() -> FakeHttp:
    return FakeHttp()


# --- Doublure de Microsoft Graph (Outlook) --------------------------------------------------


@dataclass
class FakeGraph:
    fail: bool = False
    calls: list[tuple[str, dict[str, Any], str]] = field(default_factory=list)

    def post(self, path: str, payload: dict[str, Any], token: str) -> dict[str, Any]:
        self.calls.append((path, payload, token))
        if self.fail:
            raise RuntimeError("Graph API indisponible")
        return {"id": "evt-1", **payload}


@pytest.fixture
def fake_graph() -> FakeGraph:
    return FakeGraph()


# --- Doublure du LLM -----------------------------------------------------------------------


@dataclass
class FakeLLM:
    """Renvoie les réponses dans l'ordre (la dernière est répétée) et enregistre les prompts."""

    replies: list[str]
    calls: list[tuple[str, str]] = field(default_factory=list)

    def __call__(self, system_prompt: str, user_prompt: str) -> str:
        self.calls.append((system_prompt, user_prompt))
        return self.replies[min(len(self.calls), len(self.replies)) - 1]


UNSUBSCRIBE_URL = "https://exemple.fr/desabonnement?id=42"

CLEAN_BODY = (
    "Bonjour,\n\n"
    "Je passe régulièrement dans le quartier et votre boulangerie a retenu mon attention. "
    "J'accompagne des commerçants de proximité pour simplifier la gestion de leurs "
    "dépenses courantes, sans engagement.\n\n"
    "Seriez-vous disponible mardi à 14h pour en discuter quelques minutes ?"
)

CLEAN_DRAFT = f"{CLEAN_BODY}\n\nPour ne plus recevoir nos messages : {UNSUBSCRIBE_URL}"


@pytest.fixture
def llm_factory() -> Callable[..., FakeLLM]:
    def make(*replies: str) -> FakeLLM:
        return FakeLLM(list(replies))

    return make


# --- Données métier ------------------------------------------------------------------------


@pytest.fixture
def make_prospect(prospects: ModuleType) -> Callable[..., Any]:
    def make(**overrides: Any) -> Any:
        values: dict[str, Any] = {
            "name": "Boulangerie du Marché",
            "sector": "boulangerie",
            "address": "12 Rue Oberkampf, 75011 Paris, France",
            "phone": "01 43 00 00 01",
        }
        values.update(overrides)
        return prospects.Prospect(**values)

    return make
