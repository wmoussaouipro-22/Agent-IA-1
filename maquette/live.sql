with r as (select * from recherche where source = 'Google Maps'),
k as (select * from candidat where google_place_id is not null and recherche_id in (select id from r))
select json_build_object(
 'commerces', (select coalesce(json_agg(json_build_array(id,code,enseigne,type_commerce,ville,code_postal,zone,telephone,email,nom_contact,statut_prospection,potentiel,categorie,commercial_id,siret,adresse,site_web,note_google,nombre_avis_google,date_opposition,horaires,heures_ouverture_semaine(horaires)) order by id),'[]') from commerce where statut_prospection is distinct from 'Pas intéressé'),
 'commerciaux', (select coalesce(json_agg(json_build_array(id,prenom,nom,zone,email) order by id),'[]') from commercial),
 'interactions', (select coalesce(json_agg(json_build_array(id,commerce_id,commercial_id,date_interaction,canal,resultat,commentaire,date_relance,rdv_date_heure,rdv_statut,rdv_objet,rdv_id_evenement_agenda) order by id),'[]') from interaction),
 'tournees', (select coalesce(json_agg(json_build_array(t.id, t.date_tournee, t.nom, t.statut, t.commercial_id, (select coalesce(json_agg(json_build_array(a.id, a.ordre, a.candidat_id, a.commerce_id, a.resultat, a.visite_le) order by a.ordre, a.id), '[]') from tournee_arret a where a.tournee_id = t.id)) order by t.date_tournee, t.id), '[]') from tournee t),
 'mails', (select coalesce(json_agg(json_build_array(id,commerce_id,commercial_id,interaction_id,objet,corps,statut,e_mails,date_creation,date_envoi,type_mail,modifie_avant_envoi) order by id desc),'[]') from mail where type_mail like 'RDV%'),
 'recherches', (select coalesce(json_agg(json_build_array(id,code,date_recherche,source,commercial_id,zone,types_commerce,ville,code_postal,rayon_km,statut,commentaire) order by id),'[]') from r),
 'candidats', (select coalesce(json_agg(json_build_array(id,recherche_id,enseigne,type_commerce,ville,zone,note_google,nombre_avis_google,potentiel,statut_tri,motif_ecart,(select json_build_array(c.statut_prospection, c.ne_plus_contacter, c.commercial_id) from commerce c where c.id = k.commerce_id or (k.commerce_id is null and c.google_place_id = k.google_place_id) order by (c.id = k.commerce_id) desc limit 1),heures_ouverture_semaine(k.horaires)) order by id),'[]') from k),
 'gx', (select coalesce(json_object_agg(id, json_build_array(telephone,site_web,adresse,code_postal,horaires,google_place_id)),'{}') from k),
 'gr', (select coalesce(json_object_agg(id, requete),'{}') from r)
) as d
