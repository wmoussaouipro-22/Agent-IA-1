-- Règles d'accès pour l'outil de prospection (site Vercel).
-- Un commercial connecté (rôle Supabase « authenticated ») peut :
--   - lire les commerces, les commerciaux et les échanges ;
--   - enregistrer un nouvel échange ;
--   - mettre à jour la fiche d'un commerce (statut de prospection).
-- Les visiteurs non connectés (rôle « anon ») n'ont toujours accès à rien.
-- Retour arrière : voir la section DOWN en bas de fichier.

create policy "commerciaux connectes lisent les commerces"
  on public.commerce for select to authenticated using (true);

create policy "commerciaux connectes modifient les commerces"
  on public.commerce for update to authenticated using (true) with check (true);

create policy "commerciaux connectes lisent les commerciaux"
  on public.commercial for select to authenticated using (true);

create policy "commerciaux connectes lisent les echanges"
  on public.interaction for select to authenticated using (true);

create policy "commerciaux connectes ajoutent des echanges"
  on public.interaction for insert to authenticated with check (true);

-- DOWN
-- drop policy "commerciaux connectes lisent les commerces" on public.commerce;
-- drop policy "commerciaux connectes modifient les commerces" on public.commerce;
-- drop policy "commerciaux connectes lisent les commerciaux" on public.commercial;
-- drop policy "commerciaux connectes lisent les echanges" on public.interaction;
-- drop policy "commerciaux connectes ajoutent des echanges" on public.interaction;
