import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { POTENTIELS, STATUTS, ZONES, slug } from "@/lib/referentiel";

type Filtres = { q?: string; zone?: string; statut?: string; potentiel?: string };

export default async function CommercesPage({
  searchParams,
}: {
  searchParams: Promise<Filtres>;
}) {
  const { q, zone, statut, potentiel } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("commerce")
    .select(
      "id, enseigne, type_commerce, ville, zone, statut_prospection, potentiel, categorie, ne_plus_contacter, commercial_id",
      { count: "exact" },
    )
    .order("enseigne");

  if (q) query = query.or(`enseigne.ilike.%${q.replace(/[,()]/g, " ")}%,ville.ilike.%${q.replace(/[,()]/g, " ")}%`);
  if (zone) query = query.eq("zone", zone);
  if (statut) query = query.eq("statut_prospection", statut);
  if (potentiel) query = query.eq("potentiel", potentiel);

  const [{ data: commerces, count, error }, { data: commerciaux }] = await Promise.all([
    query,
    supabase.from("commercial").select("id, prenom, nom"),
  ]);
  const nomCommercial = new Map(commerciaux?.map((x) => [x.id, `${x.prenom} ${x.nom}`]));

  return (
    <main className="page">
      <div className="page-head">
        <h1>Commerces</h1>
        <span className="muted">{count ?? 0} résultat(s)</span>
      </div>

      <form className="filters">
        <input name="q" placeholder="Enseigne ou ville" defaultValue={q} />
        <select name="zone" defaultValue={zone ?? ""}>
          <option value="">Toutes zones</option>
          {ZONES.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
        <select name="statut" defaultValue={statut ?? ""}>
          <option value="">Tous statuts</option>
          {STATUTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select name="potentiel" defaultValue={potentiel ?? ""}>
          <option value="">Tout potentiel</option>
          {POTENTIELS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <button type="submit">Filtrer</button>
        <Link href="/commerces" className="reset">
          Réinitialiser
        </Link>
      </form>

      {error && <p className="error">Lecture impossible : {error.message}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Enseigne</th>
              <th>Type</th>
              <th>Ville</th>
              <th>Zone</th>
              <th>Commercial</th>
              <th>Potentiel</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {commerces?.map((c) => {
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/commerces/${c.id}`}>{c.enseigne}</Link>
                    {c.ne_plus_contacter && <span className="tag stop">Ne plus contacter</span>}
                  </td>
                  <td>{c.type_commerce}</td>
                  <td>{c.ville}</td>
                  <td>{c.zone}</td>
                  <td>{nomCommercial.get(c.commercial_id) ?? "—"}</td>
                  <td>{c.potentiel ?? "—"}</td>
                  <td>
                    <span className={`pill s-${slug(c.statut_prospection)}`}>
                      {c.statut_prospection}
                    </span>
                  </td>
                </tr>
              );
            })}
            {commerces?.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  Aucun commerce ne correspond à ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
