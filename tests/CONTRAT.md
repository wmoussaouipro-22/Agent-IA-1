# Contrat d'interface attendu par les tests

Cette suite de tests est écrite **avant** l'application : elle sert de cahier de recette exécutable.
Chaque module de `app/` doit exposer les éléments ci-dessous (depuis son `__init__.py`).
Tant qu'un module manque, ses tests échouent avec le message « Module `app/<nom>/` introuvable ».

Les appels externes (Google Places, Microsoft Graph, LLM) sont **injectés** : les tests passent des
doublures (`tests/conftest.py`) et ne touchent jamais au réseau, sauf le test `live` de F2, ignoré
sans la variable `GOOGLE_PLACES_API_KEY`.

## F1 · `auth`
| Élément | Contrat |
|---|---|
| `create_session(commercial_id, access_token) -> Session` | `Session.commercial_id`, `Session.access_token` |
| `ensure_access(session, owner_id)` | lève `AccessDeniedError` si `owner_id` ≠ commercial de la session |
| `repr(session)` / `str(session)` | ne contiennent jamais le jeton |

## F2 · `geoloc`
| Élément | Contrat |
|---|---|
| `PlacesClient(api_key=None, http=None)` | clé lue dans `GOOGLE_PLACES_API_KEY` si absente ; sinon `MissingApiKeyError` |
| `http(url, payload, headers) -> dict` | client HTTP injectable ; la clé passe dans les en-têtes, la ville et le métier dans `payload` |
| `client.search(city, sector, radius_km) -> list[Place]` | `ValueError` si `radius_km <= 0` ; réponse au format Places API (New) |
| `Place` | `name, sector, address, phone, website, latitude, longitude, opening_hours: list[str]` (champs absents → `None` / `[]`) |
| `activity_info(place) -> str` | horaires d'ouverture (pas de données d'affluence) ; texte non vide même sans horaires |
| `distance_km(lat1, lon1, lat2, lon2) -> float` | distance à vol d'oiseau |

## F3 · `prospects`
| Élément | Contrat |
|---|---|
| `Prospect(name, sector, address, phone=None, email=None, website=None, manager_first_name=None, manager_last_name=None, stage=Stage.NOUVEAU, temperature=None)` | identité du gérant toujours facultative |
| `prospect_from_place(place) -> Prospect` | ne remplit jamais l'identité du gérant |
| `ProspectRepository().add(p)` / `.all()` | `DuplicateProspectError` si même nom **et** même adresse (insensible à la casse et aux espaces superflus) |
| `Stage` | `NOUVEAU, CONTACTE, RDV_PRIS, EN_COURS, PAS_INTERESSE` |
| `Temperature` | `CHAUD, TIEDE, FROID` |
| `prospect.advance(stage)` | Nouveau → Contacté → RDV pris / En cours / Pas intéressé ; sinon `InvalidTransitionError` |

## F4 · `scoring`
| Élément | Contrat |
|---|---|
| `SECTOR_WEIGHTS: dict[str, float]` | contient au moins `boulangerie`, `boucherie`, `restaurant` |
| `compute_score(sector, has_direct_contact, distance_km) -> float` | déterministe, ≥ 0 ; croît avec le poids du secteur et le contact direct, décroît avec la distance ; secteur inconnu ≤ secteurs connus ; `ValueError` si distance < 0 |
| `score_prospect(prospect, distance_km)` | contact direct = téléphone **ou** e-mail (un site web seul ne compte pas) |
| `rank(list[tuple[Prospect, distance_km]]) -> list[Prospect]` | score décroissant, égalité départagée par nom |

## F5 · `ai_email`
| Élément | Contrat |
|---|---|
| `SYSTEM_PROMPT: str` | cite les 6 garde-fous et le désabonnement |
| `Guardrail` | `AMOUNT, ELIGIBILITY, NUMBERS, ACRONYM, FEAR, SLOT, OPT_OUT` |
| `validate_draft(text, unsubscribe_url) -> set[Guardrail]` | ensemble vide = brouillon conforme (règles ci-dessous) |
| `generate_draft(prospect, llm, unsubscribe_url) -> str` | `llm(system_prompt, user_prompt) -> str` ; ajoute le lien de désabonnement s'il manque ; 3 tentatives maximum puis `GuardrailViolationError` |
| `get_pitch_sheet(sector) -> PitchSheet` | fiche fixe (sans IA) : `objections: list[(objection, réponse)]`, `best_time: str` |

Règles de validation retenues :
- **Chiffres** : 1 nombre maximum, en ignorant les URL (« 14h30 » compte pour un seul nombre).
- **Créneau en fin de texte** : le dernier paragraphe (blocs séparés par une ligne vide), hors ligne de désabonnement, doit proposer un créneau (jour de semaine, heure type « 14h » ou mot « créneau »).

## F6 · `outlook`
| Élément | Contrat |
|---|---|
| `book_appointment(session, prospect, start, end, graph)` | `graph.post(path, payload, token)` appelé une fois sur `/me/events` avec le jeton de la session |
| payload (format Microsoft Graph) | `location.displayName` = adresse exacte ; `start/end.timeZone` = `Europe/Paris` ; `body.content` contient un lien d'itinéraire vers l'adresse et la fiche argumentaire du secteur |
| statut | passe à `RDV_PRIS` uniquement si Outlook a accepté ; `ValueError` si fin ≤ début |

## F7 · `stats`
| Élément | Contrat |
|---|---|
| `ActivityEvent(commercial_id, kind, at)` / `ActivityKind.CONTACTED, APPOINTMENT` | événements bruts |
| `team_stats_for_week(events, week_start) -> TeamStats` | semaine = 7 jours à partir de `week_start` |
| `TeamStats` | dataclass avec **uniquement** `contacted`, `appointments`, `conversion_rate` (0.0 si aucun contact) |

## Hypothèses à valider avec le métier
1. Passage direct Nouveau → RDV pris interdit (il faut d'abord « Contacté »).
2. Un site web seul n'est pas un « moyen de contact direct ».
3. Anti-doublon tolérant à la casse et aux espaces, mais pas aux accents ni aux abréviations (« rue » / « r. »).
4. Le seul chiffre autorisé dans l'e-mail sert en pratique à l'heure du créneau.
5. SIRENE n'est pas couvert : seul Google Places est testé.
