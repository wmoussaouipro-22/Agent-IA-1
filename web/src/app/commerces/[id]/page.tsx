import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CANAUX, RESULTATS, STATUTS, formatDate, slug } from "@/lib/referentiel";
import { ajouterInteraction, changerStatut } from "./actions";

export default async function CommercePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const commerceId = Number(id);
  const supabase = await createClient();

  const [{ data: c }, { data: interactions }, { data: commerciaux }, { data: auth }] =
    await Promise.all([
      supabase
        .from("commerce")
        .select("*")
        .eq("id", commerceId)
        .single(),
      supabase
        .from("interaction")
        .select("id, date_interaction, canal, resultat, commentaire, date_relance, rdv_date_heure, rdv_statut, commercial_id")
        .eq("commerce_id", commerceId)
        .order("date_interaction", { ascending: false }),
      supabase.from("commercial").select("id, prenom, nom, email, zone, actif").order("nom"),
      supabase.auth.getUser(),
    ]);

  if (!c) notFound();

  const moi = commerciaux?.find(
    (x) => x.email && x.email.toLowerCase() === auth.user?.email?.toLowerCase(),
  );
  const suivi = commerciaux?.find((x) => x.id === c.commercial_id) ?? null;
  const auteurDe = (cid: number | null) => commerciaux?.find((x) => x.id === cid) ?? null;
  const parDefaut = moi?.id ?? suivi?.id ?? "";
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <main className="page">
      <Link href="/commerces" className="back">
        ← Commerces
      </Link>

      <div className="page-head">
        <div>
          <h1>{c.enseigne}</h1>
          <p className="muted">
            {c.type_commerce} · {c.adresse} {c.code_postal} {c.ville} · zone {c.zone}
          </p>
        </div>
        <form action={changerStatut.bind(null, commerceId)} className="inline">
          <select name="statut_prospection" defaultValue={c.statut_prospection ?? ""}>
            {STATUTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button type="submit" className="ghost">
            Mettre à jour
          </button>
        </form>
      </div>

      {c.ne_plus_contacter && (
        <p className="banner stop">
          Ce commerçant a demandé à ne plus être sollicité le {formatDate(c.date_opposition)}.
        </p>
      )}

      <div className="grid">
        <section className="card">
          <h2>Fiche</h2>
          <dl>
            <dt>Statut</dt>
            <dd>
              <span className={`pill s-${slug(c.statut_prospection)}`}>{c.statut_prospection}</span>
            </dd>
            <dt>Catégorie</dt>
            <dd>{c.categorie ?? "—"}</dd>
            <dt>Potentiel</dt>
            <dd>{c.potentiel ?? "—"}</dd>
            <dt>Commercial</dt>
            <dd>{suivi ? `${suivi.prenom} ${suivi.nom}` : "—"}</dd>
            <dt>Contact</dt>
            <dd>{c.nom_contact ?? "—"}</dd>
            <dt>Téléphone</dt>
            <dd>{c.telephone ? <a href={`tel:${c.telephone}`}>{c.telephone}</a> : "—"}</dd>
            <dt>E-mail</dt>
            <dd>{c.email ?? "—"}</dd>
            <dt>Site web</dt>
            <dd>
              {c.site_web ? (
                <a href={c.site_web} target="_blank" rel="noreferrer">
                  {c.site_web}
                </a>
              ) : (
                "—"
              )}
            </dd>
            <dt>Avis Google</dt>
            <dd>
              {c.note_google ? `${c.note_google} / 5 (${c.nombre_avis_google ?? 0} avis)` : "—"}
            </dd>
            <dt>SIRET</dt>
            <dd>{c.siret ?? "—"}</dd>
          </dl>
        </section>

        <section className="card">
          <h2>Nouvel échange</h2>
          {c.ne_plus_contacter ? (
            <p className="muted">Saisie bloquée : opposition enregistrée.</p>
          ) : (
            <form action={ajouterInteraction.bind(null, commerceId)} className="stack">
              <div className="row">
                <label>
                  Date
                  <input type="date" name="date_interaction" defaultValue={aujourdhui} required />
                </label>
                <label>
                  Canal
                  <select name="canal" required>
                    {CANAUX.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="row">
                <label>
                  Résultat
                  <select name="resultat" required>
                    {RESULTATS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Relance le
                  <input type="date" name="date_relance" />
                </label>
              </div>
              <label>
                Commercial
                <select name="commercial_id" defaultValue={String(parDefaut)} required>
                  {commerciaux?.filter((x) => x.actif !== false).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.prenom} {x.nom} ({x.zone})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Commentaire
                <textarea name="commentaire" rows={3} />
              </label>
              <button type="submit">Enregistrer l&apos;échange</button>
            </form>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Historique ({interactions?.length ?? 0})</h2>
        {interactions?.length ? (
          <ol className="timeline">
            {interactions.map((i) => {
              const auteur = auteurDe(i.commercial_id);
              return (
                <li key={i.id}>
                  <div className="when">{formatDate(i.date_interaction)}</div>
                  <div>
                    <strong>{i.canal}</strong> · {i.resultat}
                    {auteur && <span className="muted"> · {auteur.prenom} {auteur.nom}</span>}
                    {i.commentaire && <p>{i.commentaire}</p>}
                    {i.rdv_date_heure && (
                      <p className="muted">
                        RDV le {new Date(i.rdv_date_heure).toLocaleString("fr-FR")}
                        {i.rdv_statut && ` · ${i.rdv_statut}`}
                      </p>
                    )}
                    {i.date_relance && (
                      <p className="muted">Relance prévue le {formatDate(i.date_relance)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="muted">Aucun échange pour l&apos;instant.</p>
        )}
      </section>
    </main>
  );
}
