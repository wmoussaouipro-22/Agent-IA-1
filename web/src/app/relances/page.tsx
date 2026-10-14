import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/referentiel";

// Relances dues : en retard ou prévues dans les 7 prochains jours.
// Les clés étrangères ayant été retirées de la base, les rapprochements se font ici.
export default async function RelancesPage() {
  const supabase = await createClient();
  const horizon = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const [{ data: relances, error }, { data: commerces }, { data: commerciaux }] =
    await Promise.all([
      supabase
        .from("interaction")
        .select("id, date_relance, resultat, commerce_id, commercial_id")
        .not("date_relance", "is", null)
        .lte("date_relance", horizon)
        .order("date_relance"),
      supabase.from("commerce").select("id, enseigne, ville, zone, telephone, ne_plus_contacter"),
      supabase.from("commercial").select("id, prenom, nom"),
    ]);

  const commerceParId = new Map(commerces?.map((c) => [c.id, c]));
  const nomCommercial = new Map(commerciaux?.map((x) => [x.id, `${x.prenom} ${x.nom}`]));

  const lignes = (relances ?? [])
    .map((r) => ({ ...r, commerce: commerceParId.get(r.commerce_id) }))
    .filter((r) => r.commerce && !r.commerce.ne_plus_contacter);

  return (
    <main className="page">
      <div className="page-head">
        <h1>Relances</h1>
        <span className="muted">En retard ou dans les 7 prochains jours</span>
      </div>
      {error && <p className="error">Lecture impossible : {error.message}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Commerce</th>
              <th>Zone</th>
              <th>Téléphone</th>
              <th>Dernier résultat</th>
              <th>Commercial</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id} className={l.date_relance < aujourdhui ? "late" : ""}>
                <td>{formatDate(l.date_relance)}</td>
                <td>
                  <Link href={`/commerces/${l.commerce!.id}`}>{l.commerce!.enseigne}</Link>
                  <span className="muted"> · {l.commerce!.ville}</span>
                </td>
                <td>{l.commerce!.zone}</td>
                <td>{l.commerce!.telephone ?? "—"}</td>
                <td>{l.resultat}</td>
                <td>{nomCommercial.get(l.commercial_id) ?? "—"}</td>
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Aucune relance à prévoir.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
