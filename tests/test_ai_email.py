"""F5 · Brouillon d'e-mail IA : les 6 garde-fous, le lien de désabonnement et les fiches fixes."""

from __future__ import annotations

import unicodedata
from collections.abc import Callable
from types import ModuleType
from typing import Any

import pytest

from conftest import CLEAN_BODY, CLEAN_DRAFT, UNSUBSCRIBE_URL, FakeLLM

pytestmark = pytest.mark.ai


def _fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn")


# --- Prompt système -------------------------------------------------------------------------


@pytest.mark.parametrize(
    "keyword",
    ["montant", "eligib", "chiffre", "sigle", "peur", "creneau", "desabonnement"],
)
def test_prompt_systeme_contient_chaque_garde_fou(ai_email: ModuleType, keyword: str) -> None:
    assert keyword in _fold(ai_email.SYSTEM_PROMPT)


# --- Validation post-génération -------------------------------------------------------------


def test_brouillon_conforme(ai_email: ModuleType) -> None:
    assert ai_email.validate_draft(CLEAN_DRAFT, UNSUBSCRIBE_URL) == set()


@pytest.mark.parametrize(
    "sentence",
    ["Vous économiserez 500 € par an.", "Jusqu'à 1 200 euros d'économies.", "Gagnez 300€."],
)
def test_garde_fou_1_aucun_montant(ai_email: ModuleType, sentence: str) -> None:
    draft = CLEAN_DRAFT.replace("sans engagement.", f"sans engagement. {sentence}")
    assert ai_email.Guardrail.AMOUNT in ai_email.validate_draft(draft, UNSUBSCRIBE_URL)


@pytest.mark.parametrize(
    "sentence",
    ["Vous êtes éligible à une aide de l'État.", "Vous avez droit à une subvention."],
)
def test_garde_fou_2_aucune_promesse_d_eligibilite(ai_email: ModuleType, sentence: str) -> None:
    draft = CLEAN_DRAFT.replace("sans engagement.", f"sans engagement. {sentence}")
    assert ai_email.Guardrail.ELIGIBILITY in ai_email.validate_draft(draft, UNSUBSCRIBE_URL)


def test_garde_fou_3_un_seul_chiffre(ai_email: ModuleType) -> None:
    draft = CLEAN_DRAFT.replace("sans engagement.", "sans engagement, depuis 20 ans.")
    assert ai_email.Guardrail.NUMBERS in ai_email.validate_draft(draft, UNSUBSCRIBE_URL)


def test_garde_fou_3_chiffres_du_lien_ignores(ai_email: ModuleType) -> None:
    # Le lien de désabonnement contient « 42 » : il ne doit pas compter comme un chiffre.
    assert ai_email.Guardrail.NUMBERS not in ai_email.validate_draft(CLEAN_DRAFT, UNSUBSCRIBE_URL)


@pytest.mark.parametrize("acronym", ["CEE", "TURPE", "ARENH"])
def test_garde_fou_4_aucun_sigle(ai_email: ModuleType, acronym: str) -> None:
    draft = CLEAN_DRAFT.replace("sans engagement.", f"grâce au dispositif {acronym}.")
    assert ai_email.Guardrail.ACRONYM in ai_email.validate_draft(draft, UNSUBSCRIBE_URL)


@pytest.mark.parametrize(
    "sentence",
    [
        "Attention, vous risquez une amende.",
        "Ne prenez pas le risque de tout perdre.",
        "Il sera bientôt trop tard.",
    ],
)
def test_garde_fou_5_aucun_argument_de_peur(ai_email: ModuleType, sentence: str) -> None:
    draft = CLEAN_DRAFT.replace("sans engagement.", f"sans engagement. {sentence}")
    assert ai_email.Guardrail.FEAR in ai_email.validate_draft(draft, UNSUBSCRIBE_URL)


def test_garde_fou_6_creneau_absent(ai_email: ModuleType) -> None:
    body = CLEAN_BODY.replace(
        "Seriez-vous disponible mardi à 14h pour en discuter quelques minutes ?",
        "Au plaisir d'échanger avec vous.",
    )
    draft = f"{body}\n\nPour ne plus recevoir nos messages : {UNSUBSCRIBE_URL}"
    assert ai_email.Guardrail.SLOT in ai_email.validate_draft(draft, UNSUBSCRIBE_URL)


def test_garde_fou_6_creneau_pas_en_fin_de_texte(ai_email: ModuleType) -> None:
    body = (
        "Bonjour,\n\nSeriez-vous disponible mardi à 14h ?\n\n"
        "J'accompagne des commerçants de proximité, sans engagement."
    )
    draft = f"{body}\n\nPour ne plus recevoir nos messages : {UNSUBSCRIBE_URL}"
    assert ai_email.Guardrail.SLOT in ai_email.validate_draft(draft, UNSUBSCRIBE_URL)


def test_lien_de_desabonnement_obligatoire(ai_email: ModuleType) -> None:
    assert ai_email.Guardrail.OPT_OUT in ai_email.validate_draft(CLEAN_BODY, UNSUBSCRIBE_URL)


# --- Génération -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "llm_output",
    [
        CLEAN_BODY,
        CLEAN_DRAFT,
        CLEAN_BODY + "\n\n",
    ],
)
def test_lien_de_desabonnement_dans_100_pourcent_des_brouillons(
    ai_email: ModuleType,
    make_prospect: Callable[..., Any],
    llm_factory: Callable[..., FakeLLM],
    llm_output: str,
) -> None:
    draft = ai_email.generate_draft(make_prospect(), llm_factory(llm_output), UNSUBSCRIBE_URL)
    assert UNSUBSCRIBE_URL in draft
    assert ai_email.validate_draft(draft, UNSUBSCRIBE_URL) == set()


def test_prompt_personnalise(
    ai_email: ModuleType, make_prospect: Callable[..., Any], llm_factory: Callable[..., FakeLLM]
) -> None:
    llm = llm_factory(CLEAN_BODY)
    ai_email.generate_draft(make_prospect(), llm, UNSUBSCRIBE_URL)
    system_prompt, user_prompt = llm.calls[0]
    assert system_prompt == ai_email.SYSTEM_PROMPT
    assert "Boulangerie du Marché" in user_prompt
    assert "boulangerie" in user_prompt.lower()


def test_prompt_sans_gerant_n_affiche_pas_none(
    ai_email: ModuleType, make_prospect: Callable[..., Any], llm_factory: Callable[..., FakeLLM]
) -> None:
    llm = llm_factory(CLEAN_BODY)
    ai_email.generate_draft(make_prospect(), llm, UNSUBSCRIBE_URL)
    assert "None" not in llm.calls[0][1]


def test_nouvelle_tentative_si_garde_fou_viole(
    ai_email: ModuleType, make_prospect: Callable[..., Any], llm_factory: Callable[..., FakeLLM]
) -> None:
    bad = CLEAN_BODY.replace("sans engagement.", "pour économiser 500 € par an.")
    llm = llm_factory(bad, CLEAN_BODY)
    draft = ai_email.generate_draft(make_prospect(), llm, UNSUBSCRIBE_URL)
    assert "500" not in draft
    assert len(llm.calls) == 2


def test_echec_apres_trois_tentatives(
    ai_email: ModuleType, make_prospect: Callable[..., Any], llm_factory: Callable[..., FakeLLM]
) -> None:
    llm = llm_factory("Attention, vous risquez une amende de 750 € avec le TURPE !")
    with pytest.raises(ai_email.GuardrailViolationError):
        ai_email.generate_draft(make_prospect(), llm, UNSUBSCRIBE_URL)
    assert len(llm.calls) == 3


# --- Fiches argumentaires téléphone & visite (sans IA) --------------------------------------


@pytest.mark.parametrize("sector", ["boulangerie", "boucherie", "restaurant"])
def test_fiche_argumentaire_fixe(ai_email: ModuleType, sector: str) -> None:
    sheet = ai_email.get_pitch_sheet(sector)
    assert sheet.objections, "au moins une objection avec sa réponse"
    for objection, answer in sheet.objections:
        assert objection.strip() and answer.strip()
    assert sheet.best_time.strip()
    assert ai_email.get_pitch_sheet(sector) == sheet  # contenu fixe, pas généré
