"""F1 · Session au nom du commercial : isolation stricte des sessions."""

from __future__ import annotations

from types import ModuleType

import pytest

pytestmark = pytest.mark.unit


def test_session_rattachee_au_commercial(auth: ModuleType) -> None:
    session = auth.create_session("com-1", access_token="token-a")
    assert session.commercial_id == "com-1"
    assert session.access_token == "token-a"


def test_acces_a_ses_propres_ressources(auth: ModuleType) -> None:
    session = auth.create_session("com-1", access_token="token-a")
    auth.ensure_access(session, "com-1")  # ne lève pas d'exception


def test_acces_refuse_a_l_agenda_d_un_collegue(auth: ModuleType) -> None:
    session = auth.create_session("com-1", access_token="token-a")
    with pytest.raises(auth.AccessDeniedError):
        auth.ensure_access(session, "com-2")


def test_le_jeton_n_apparait_pas_dans_les_logs(auth: ModuleType) -> None:
    session = auth.create_session("com-1", access_token="secret-token-a")
    assert "secret-token-a" not in repr(session)
    assert "secret-token-a" not in str(session)
