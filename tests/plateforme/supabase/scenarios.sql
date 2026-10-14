-- Recette des règles métier Supabase (projet « Nouvelles tables Eco locaux SQL »).
--
-- Chaque scénario est un bloc DO autonome. Il crée ses propres données d'essai, vérifie le
-- comportement des déclencheurs, puis lève TOUJOURS une exception pour tout annuler :
--   « RECETTE_OK S<n> {détails} »  → scénario réussi, rien n'a été écrit ;
--   « RECETTE_KO S<n> : <raison> » → défaut trouvé, rien n'a été écrit non plus.
-- Exécuter les blocs un par un (outil execute_sql de Supabase), jamais en dehors d'un bloc DO.
-- Les identifiants d'essai commencent par RECETTE- pour ne jamais croiser de vraies fiches.

-- S1 · Arrivée d'un candidat Google Maps : code, zone déduite du code postal, potentiel calculé
do $$
declare v_rech bigint; v_c candidat%rowtype;
begin
  insert into recherche (source, ville, statut, commentaire) values ('Google Maps', 'Recette', 'En cours', 'RECETTE') returning id into v_rech;
  insert into candidat (recherche_id, enseigne, type_commerce, code_postal, ville, google_place_id, horaires, latitude, longitude)
  values (v_rech, 'Boulangerie Recette', 'Boulangerie', '59100', 'Roubaix', 'RECETTE-S1',
          'lundi 06:00 to 20:00 ; mardi 06:00 to 20:00 ; mercredi 06:00 to 20:00 ; jeudi 06:00 to 20:00 ; vendredi 06:00 to 20:00 ; samedi Fermé ; dimanche Fermé',
          50.69, 3.18)
  returning * into v_c;
  if v_c.code not like 'Cand-%' then raise exception 'RECETTE_KO S1 : code attendu Cand-xxx, obtenu %', v_c.code; end if;
  if v_c.zone is distinct from 'Nord' then raise exception 'RECETTE_KO S1 : zone attendue Nord (59), obtenue %', v_c.zone; end if;
  if v_c.statut_tri is distinct from 'À examiner' then raise exception 'RECETTE_KO S1 : statut attendu À examiner, obtenu %', v_c.statut_tri; end if;
  if v_c.potentiel is distinct from 'Élevé' then raise exception 'RECETTE_KO S1 : potentiel attendu Élevé (20 + 10 pts, 70 h), obtenu %', v_c.potentiel; end if;
  raise exception 'RECETTE_OK S1 %', jsonb_build_object('code', v_c.code, 'zone', v_c.zone, 'potentiel', v_c.potentiel);
end $$;

-- S2 · Lecture des horaires : format Google mis à plat par n8n et format texte historique
do $$
declare g numeric; t numeric;
begin
  g := heures_ouverture_semaine('lundi 07:00 to 12:45, 15:30 to 19:00 ; mardi Fermé ; mercredi 07:00 to 12:45, 15:30 to 19:00');
  t := heures_ouverture_semaine('Lun-Sam 12h-14h30 / 19h-22h30');
  if g is distinct from 18.5 then raise exception 'RECETTE_KO S2 : format Google, 18,5 h attendues (2 × 9 h 15), obtenu %', g; end if;
  if t is distinct from 36.0 then raise exception 'RECETTE_KO S2 : format texte, 36 h attendues, obtenu %', t; end if;
  if potentiel_niveau(potentiel_points('Restaurant', 'Lun-Sam 12h-14h30 / 19h-22h30', null)) <> 'Faible' then raise exception 'RECETTE_KO S2 : restaurant 36 h attendu Faible'; end if;
  if potentiel_niveau(potentiel_points('Pizzeria', 'Lun-Dim 11h-23h', null)) <> 'Moyen' then raise exception 'RECETTE_KO S2 : pizzeria 84 h attendue Moyen (25 pts)'; end if;
  raise exception 'RECETTE_OK S2 %', jsonb_build_object('google_h', g, 'texte_h', t);
end $$;

-- S3 · Retenir un candidat : création du commerce (potentiel, GPS, commercial de zone), puis verrou
do $$
declare v_rech bigint; v_c candidat%rowtype; v_com commerce%rowtype; v_bloque boolean := false;
begin
  insert into recherche (source, ville, statut, commentaire) values ('Google Maps', 'Recette', 'En cours', 'RECETTE') returning id into v_rech;
  insert into candidat (recherche_id, enseigne, type_commerce, code_postal, ville, google_place_id, latitude, longitude, telephone)
  values (v_rech, 'Pressing Recette', 'Pressing', '59000', 'Lille', 'RECETTE-S3', 50.63, 3.06, '03 20 00 00 03') returning * into v_c;
  update candidat set statut_tri = 'Retenu' where id = v_c.id returning * into v_c;
  if v_c.commerce_id is null then raise exception 'RECETTE_KO S3 : aucun commerce créé au passage en Retenu'; end if;
  select * into v_com from commerce where id = v_c.commerce_id;
  if v_com.code not like 'Co-%' then raise exception 'RECETTE_KO S3 : code commerce attendu Co-xxx, obtenu %', v_com.code; end if;
  if v_com.latitude is null or v_com.longitude is null then raise exception 'RECETTE_KO S3 : la position GPS n''a pas été recopiée'; end if;
  if v_com.potentiel is null then raise exception 'RECETTE_KO S3 : potentiel absent sur le commerce'; end if;
  if v_com.commercial_id is null then raise exception 'RECETTE_KO S3 : aucun commercial attribué'; end if;
  if v_com.google_place_id is distinct from 'RECETTE-S3' then raise exception 'RECETTE_KO S3 : google_place_id non recopié'; end if;
  begin
    update candidat set statut_tri = 'Écarté' where id = v_c.id;
  exception when others then v_bloque := true;
  end;
  if not v_bloque then raise exception 'RECETTE_KO S3 : un candidat retenu a pu être écarté (verrou absent)'; end if;
  raise exception 'RECETTE_OK S3 %', jsonb_build_object('commerce', v_com.code, 'potentiel', v_com.potentiel, 'commercial_id', v_com.commercial_id);
end $$;

-- S4 · Retenir sans type de commerce : refus avec un message compréhensible
do $$
declare v_rech bigint; v_id bigint; v_msg text;
begin
  insert into recherche (source, ville, statut, commentaire) values ('Google Maps', 'Recette', 'En cours', 'RECETTE') returning id into v_rech;
  insert into candidat (recherche_id, enseigne, code_postal, ville, google_place_id) values (v_rech, 'Sans Type Recette', '59000', 'Lille', 'RECETTE-S4') returning id into v_id;
  begin
    update candidat set statut_tri = 'Retenu' where id = v_id;
  exception when others then v_msg := sqlerrm;
  end;
  if v_msg is null or v_msg not ilike '%type de commerce%' then raise exception 'RECETTE_KO S4 : refus attendu « préciser le type de commerce », obtenu %', coalesce(v_msg, 'aucun refus'); end if;
  raise exception 'RECETTE_OK S4 %', jsonb_build_object('message', v_msg);
end $$;

-- S5 · Doublon : un commerce déjà en base revient d'une recherche → statut « Connu »
do $$
declare v_rech bigint; v_com bigint; v_c candidat%rowtype;
begin
  insert into commerce (enseigne, type_commerce, ville, zone, google_place_id, statut_prospection, categorie)
  values ('Boucherie Recette', 'Boucherie', 'Lille', 'Nord', 'RECETTE-S5', 'Contacté', 'Prospect') returning id into v_com;
  insert into recherche (source, ville, statut, commentaire) values ('Google Maps', 'Recette', 'En cours', 'RECETTE') returning id into v_rech;
  insert into candidat (recherche_id, enseigne, type_commerce, code_postal, ville, google_place_id)
  values (v_rech, 'Boucherie Recette', 'Boucherie', '59000', 'Lille', 'RECETTE-S5') returning * into v_c;
  if v_c.statut_tri is distinct from 'Connu' then raise exception 'RECETTE_KO S5 : statut attendu Connu, obtenu %', v_c.statut_tri; end if;
  if v_c.commerce_id is distinct from v_com then raise exception 'RECETTE_KO S5 : le candidat n''est pas relié au commerce existant'; end if;
  raise exception 'RECETTE_OK S5 %', jsonb_build_object('statut', v_c.statut_tri, 'note', v_c.note_tri);
end $$;

-- S6 · « Pas intéressé » : le commerce reste en base, une nouvelle recherche le reconnaît (Connu)
do $$
declare v_rech bigint; v_com bigint; v_c candidat%rowtype; v_statut text;
begin
  insert into commerce (enseigne, type_commerce, ville, zone, google_place_id, statut_prospection, categorie, telephone)
  values ('Laverie Recette', 'Laverie', 'Lille', 'Nord', 'RECETTE-S6', 'Contacté', 'Prospect', '03 20 00 00 06') returning id into v_com;
  update commerce set statut_prospection = 'Pas intéressé' where id = v_com;
  select statut_prospection into v_statut from commerce where id = v_com;
  if v_statut is distinct from 'Pas intéressé' then raise exception 'RECETTE_KO S6 : commerce absent ou statut perdu'; end if;
  insert into recherche (source, ville, statut, commentaire) values ('Google Maps', 'Recette', 'En cours', 'RECETTE') returning id into v_rech;
  insert into candidat (recherche_id, enseigne, type_commerce, code_postal, ville, google_place_id)
  values (v_rech, 'Laverie Recette', 'Laverie', '59000', 'Lille', 'RECETTE-S6') returning * into v_c;
  if v_c.statut_tri is distinct from 'Connu' then raise exception 'RECETTE_KO S6 : un « Pas intéressé » revient comme %', v_c.statut_tri; end if;
  raise exception 'RECETTE_OK S6 %', jsonb_build_object('statut', v_c.statut_tri, 'note', v_c.note_tri);
end $$;

-- S7 · Potentiel saisi à la main : jamais écrasé par le calcul automatique
do $$
declare v_com commerce%rowtype;
begin
  insert into commerce (enseigne, type_commerce, ville, zone, google_place_id, statut_prospection, categorie, potentiel)
  values ('Restaurant Recette', 'Restaurant', 'Lille', 'Nord', 'RECETTE-S7', 'Nouveau', 'Prospect', 'Élevé') returning * into v_com;
  update commerce set telephone = '03 20 00 00 07' where id = v_com.id returning * into v_com;
  if v_com.potentiel is distinct from 'Élevé' then raise exception 'RECETTE_KO S7 : le potentiel manuel a été écrasé (%)', v_com.potentiel; end if;
  raise exception 'RECETTE_OK S7 %', jsonb_build_object('potentiel', v_com.potentiel);
end $$;

-- S8 · Lecture de la maquette : la requête maquette/live.sql s'exécute et respecte le format attendu
-- (à lancer tel quel : requête en lecture seule, sans bloc DO)
-- select json_array_length(d->'commerces'->0) = 22 as commerces_ok,
--        coalesce(json_array_length(d->'candidats'->0), 13) = 13 as candidats_ok,
--        not exists (select 1 from json_array_elements(d->'commerces') e where e->>10 = 'Pas intéressé') as sans_pas_interesse
-- from ( <contenu de maquette/live.sql> ) s;
