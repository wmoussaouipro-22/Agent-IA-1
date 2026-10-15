// Recette de la maquette Eco-Locaux CRM (logique de l'interface, connecteurs simulés).
// Lancement : cd tests/plateforme && npm install && npm test
// La maquette est reconstruite à partir de maquette/template.html avant chaque passage.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const MAQ = join(ROOT, "maquette");
execFileSync("python3", ["build.py"], { cwd: MAQ, stdio: "ignore" });
const HTML = readFileSync(join(MAQ, "eco-locaux-crm.html"), "utf8");
const DEMO = JSON.parse(readFileSync(join(MAQ, "data.json"), "utf8"));

/* ---------- Données Supabase simulées (forme exacte de maquette/live.sql) ---------- */
const COM = (id, enseigne, o = {}) => [id, "Co-" + id, enseigne, o.type ?? "Boulangerie", o.ville ?? "Roubaix", "59100", "Nord",
  o.tel ?? "03 20 00 00 00", o.email ?? null, null, o.statut ?? "Nouveau", o.pot ?? "Moyen", "Prospect", 2, null, "1 rue Test", null, null, null, null,
  o.horaires ?? null, o.heures ?? null];
const CAND = (id, rech, enseigne, tri = "À examiner", known = null, heures = 70) =>
  [id, rech, enseigne, "Boulangerie", "Roubaix", "Nord", null, null, "Élevé", tri, null, known, heures];
function liveData() {
  return {
    commerces: [COM(160, "Boulangerie Ancienne"), COM(170, "Boulangerie Récente", { heures: 83 })],
    commerciaux: [[1, "Camille", "Lefèvre", "Nord", "c@x"], [2, "Wassila", "Moussaoui", "Nord", "w@x"]],
    interactions: [[900, 160, 2, "2026-10-14", "Appel", "RDV pris", null, "2026-10-19", "2026-10-20T08:00:00Z", "Planifié", "Diagnostic", "evt-1"]],
    recherches: [[50, "Rech-050", "2026-10-14T09:00:00Z", "Google Maps", 2, "Nord", ["Boulangerie"], "Roubaix", null, 1, "Terminée", null]],
    candidats: [CAND(501, 50, "Fournil A"), CAND(502, 50, "Fournil B"), CAND(503, 50, "Fournil Connu", "Connu", ["Pas intéressé", false, 2])],
    gx: { 501: ["03 20 11 11 11", null, "2 rue A", "59100", "lundi 06:00 to 20:00", "PLACE-A"] },
    gr: { 50: "boulangerie Roubaix" },
    tournees: [],
    mails: [[40, 160, 2, 900, "Confirmation de notre rendez-vous diagnostic du 20 octobre", "Madame, Monsieur,\n\nTexte rédigé par l'IA.", "Brouillon IA", "contact@ancienne.fr", "2026-10-14", null, "RDV · Diagnostic", false]],
  };
}
const wrap = d => ({ content: [{ type: "text", text: JSON.stringify({ result: `Below <untrusted-data-x1>\n${JSON.stringify([{ d }])}\n</untrusted-data-x1>\nUse` }) }] });

const OUVERTES = [];
afterEach(() => { while (OUVERTES.length) OUVERTES.pop().close(); });

/* ---------- Ouverture de la maquette ----------
   mode "live" : connecteurs Supabase et n8n disponibles ; "figee" : aucun connecteur ;
   "refus" : Supabase refusé par le lecteur. */
async function ouvrir(mode = "live", hash = "") {
  const data = liveData(), calls = [];
  const dom = new JSDOM(`<!doctype html><body>${HTML}</body>`, {
    runScripts: "dangerously", url: "https://recette.test/" + hash,
    beforeParse(w) {
      w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {}; w.__RECETTE_RAPIDE = true; w.__TODAY = "2026-10-14";
      if (mode === "figee") return;
      w.claude = { use: async () => ({ callTool: async (server, tool, input) => {
        calls.push({ server, tool, input });
        if (mode === "refus") throw { code: "not_in_manifest" };
        if (server === "n8n") {
          const body = input.inputs?.webhookData?.body || {};
          if (body.interaction_id) data.mails.unshift([41, 170, 2, body.interaction_id, "Présentation de votre proposition le 22 octobre", "Bonjour,\n\nBrouillon IA.", "Brouillon IA", null, "2026-10-14", null, "RDV · Présentation devis", false]);
          if (body.mail_id) { const m = data.mails.find(x => x[0] === body.mail_id); if (m) { m[6] = "Envoyé"; m[9] = "2026-10-14"; } }
          return { content: [{ type: "text", text: '{"executionId":"1"}' }] };
        }
        const q = input.query;
        if (q.startsWith("update public.candidat")) {
          const id = +/where id = (\d+)/.exec(q)[1], st = /statut_tri = '([^']+)'/.exec(q)[1];
          data.candidats.find(c => c[0] === id)[9] = st;
          return { content: [{ type: "text", text: JSON.stringify({ result: `<untrusted-data-x1>\n${JSON.stringify([{ id, statut_tri: st, commerce_id: 999, code_commerce: "Co-999" }])}\n</untrusted-data-x1>` }) }] };
        }
        if (q.startsWith("with t as (insert into public.tournee")) {
          const id = 70 + data.tournees.length, day = /'(\d{4}-\d\d-\d\d)'/.exec(q)[1], m = /select id, 1, (\d+) from t/.exec(q), cand = /candidat_id\)/.test(q);
          data.tournees.push([id, day, null, "Planifiée", 2, [[800 + id, 1, cand ? +m[1] : null, cand ? null : +m[1], null, null]]]); return { content: [] };
        }
        if (q.startsWith("update public.tournee_arret set tournee_id")) {
          const to = +/tournee_id = (\d+)/.exec(q)[1], add = +/ordre \+ (\d+)/.exec(q)[1], ids = /in \(([\d, ]+)\)/.exec(q)[1].split(",").map(Number), tr = data.tournees.find(x => x[0] === to);
          for (const x of data.tournees.filter(x => ids.includes(x[0]))) for (const a of x[5]) tr[5].push([a[0], a[1] + add, a[2], a[3], a[4], a[5]]);
          data.tournees = data.tournees.filter(x => !ids.includes(x[0])); return { content: [] };
        }
        if (q.startsWith("insert into public.commerce")) {
          const v = [...q.matchAll(/'((?:[^']|'')*)'|null/g)].map(x => x[1] == null ? null : x[1].replace(/''/g, "'"));
          const id = 300 + data.commerces.length; data.commerces.push(COM(id, v[0], { type: v[1], ville: v[3], tel: v[6] }));
          return { content: [{ type: "text", text: JSON.stringify({ result: `<untrusted-data-x1>\n[{"id":${id}}]\n</untrusted-data-x1>` }) }] };
        }
        if (q.startsWith("insert into public.tournee (")) {
          const id = 70 + data.tournees.length; data.tournees.push([id, /'(\d{4}-\d\d-\d\d)'/.exec(q)[1], /'(\d{4}-\d\d-\d\d)', (null|'([^']*)')/.exec(q)[3] || null, "Planifiée", 2, []]);
          return { content: [{ type: "text", text: JSON.stringify({ result: `<untrusted-data-x1>\n[{"id":${id}}]\n</untrusted-data-x1>` }) }] };
        }
        if (q.startsWith("insert into public.tournee_arret")) {
          const m = /values \((\d+), (\d+), (\d+)\)/.exec(q), tr = data.tournees.find(x => x[0] === +m[1]), cand = /candidat_id\)/.test(q);
          tr[5].push([800 + tr[5].length, +m[2], cand ? +m[3] : null, cand ? null : +m[3], null, null]); return { content: [] };
        }
        if (q.startsWith("update public.tournee_arret set ordre")) {
          for (const [, o, id] of q.matchAll(/set ordre = (\d+) where id = (\d+)/g)) for (const tr of data.tournees) for (const a of tr[5]) if (a[0] === +id) a[1] = +o;
          for (const tr of data.tournees) tr[5].sort((a, b) => a[1] - b[1]);
          return { content: [] };
        }
        if (q.startsWith("update public.tournee_arret set resultat")) {
          const id = +/where id = (\d+)/.exec(q)[1], r = /resultat = '([^']+)'/.exec(q)[1];
          for (const tr of data.tournees) for (const a of tr[5]) if (a[0] === id) a[4] = r;
          return { content: [] };
        }
        if (q.startsWith("delete from public.tournee_arret where tournee_id")) {
          const id = +/tournee_id = (\d+)/.exec(q)[1]; data.tournees = data.tournees.filter(x => x[0] !== id); return { content: [] };
        }
        if (q.startsWith("update public.tournee set")) {
          const id = +/where id = (\d+)/.exec(q)[1], tr = data.tournees.find(x => x[0] === id);
          tr[1] = /date_tournee = '([^']+)'/.exec(q)[1]; tr[2] = /nom = (null|'([^']*)')/.exec(q)[2] || null; return { content: [] };
        }
        if (q.startsWith("update public.interaction set date_relance_initiale")) {
          const id = +/where id = (\d+)/.exec(q)[1], i = data.interactions.find(x => x[0] === id), d = /date_relance = '([^']+)'/.exec(q)[1];
          if (i) { i[12] = i[12] || i[7]; i[7] = d; } return { content: [] };
        }
        if (q.startsWith("update public.commerce set statut_prospection = 'Injoignable'")) {
          const id = +/where id = (\d+)/.exec(q)[1], c = data.commerces.find(x => x[0] === id); if (c) c[10] = "Injoignable";
          const m2 = /date_relance = '([^']+)' where id = (\d+)/.exec(q); if (m2) { const i = data.interactions.find(x => x[0] === +m2[2]); if (i) i[7] = m2[1]; }
          return { content: [] };
        }
        if (q.startsWith("update public.interaction set rdv_statut")) {
          const id = +/where id = (\d+)/.exec(q)[1], i = data.interactions.find(x => x[0] === id); if (i) i[9] = /rdv_statut = '([^']+)'/.exec(q)[1]; return { content: [] };
        }
        if (q.startsWith("delete from public.tournee_arret")) {
          const id = +/where id = (\d+)/.exec(q)[1]; for (const tr of data.tournees) tr[5] = tr[5].filter(a => a[0] !== id); return { content: [] };
        }
        if (q.startsWith("with i as (insert into public.interaction")) {
          const id = 950 + data.interactions.length;
          data.interactions.push([id, 170, 2, "2026-10-14", "Appel", /'(RDV pris|Sans réponse|Intéressé|À rappeler)'/.exec(q)?.[1] || "Appel", null, null, /'(2026-[^']+T[^']+)'/.exec(q)?.[1] || null, "Planifié", /'(Diagnostic|Présentation devis|Signature)'/.exec(q)?.[1] || null, null]);
          return { content: [{ type: "text", text: JSON.stringify({ result: `<untrusted-data-x1>\n[{"interaction_id":${id}}]\n</untrusted-data-x1>` }) }] };
        }
        if (q.startsWith("update public.mail")) {
          const id = +/where id = (\d+)/.exec(q)[1], m = data.mails.find(x => x[0] === id);
          m[4] = /objet = '((?:[^']|'')*)'/.exec(q)[1].replace(/''/g, "'"); m[5] = /corps = '((?:[^']|'')*)'/.exec(q)[1].replace(/''/g, "'");
          if (/statut = 'Validé'/.test(q)) m[6] = "Validé";
          return { content: [] };
        }
        if (q.startsWith("update public.commerce set statut_prospection = 'Pas intéressé'")) {
          const ids = /in \(([\d,]+)\)/.exec(q)[1].split(",").map(Number);
          data.commerces = data.commerces.filter(c => !ids.includes(c[0]));
          return { content: [] };
        }
        return wrap(data);
      } }) };
    },
  });
  const w = dom.window, d = w.document, errs = [];
  OUVERTES.push(w);
  w.addEventListener("error", e => errs.push(e.message || String(e.error && e.error.stack || e.error)));
  await new Promise(r => setTimeout(r, 60));
  const click = sel => { const el = typeof sel === "string" ? d.querySelector(sel) : sel; assert.ok(el, "élément absent : " + sel); el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); };
  const change = (sel, v) => { const el = d.querySelector(sel); assert.ok(el, "champ absent : " + sel); el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
  const toasts = () => [...d.querySelectorAll(".toast")].map(t => t.textContent).join(" | ");
  const wait = (ms = 40) => new Promise(r => setTimeout(r, ms));
  return { w, d, calls, errs, click, change, toasts, wait, data };
}

/* P1 */ test("P1 · Lecture Supabase : indicateur, liste des prospects (plus récents en premier), aucun code affiché", async () => {
  const m = await ouvrir("live");
  assert.match(m.d.querySelector("#src-l").textContent, /Supabase · lu à/);
  m.click("[data-go=prospects]");
  const noms = [...m.d.querySelectorAll("tbody .ens")].map(x => x.textContent);
  assert.deepEqual(noms, ["Boulangerie Récente", "Boulangerie Ancienne"]);
  assert.equal(/\b(Co|Rech|Cand)-\d+/.test(m.d.querySelector("#view").textContent), false, "un code interne est visible");
  assert.deepEqual(m.errs, []);
});

/* P1b */ test("P1b · Sans connecteur ou connecteur refusé : la maquette reste utilisable sur les données figées", async () => {
  for (const mode of ["figee", "refus"]) {
    const m = await ouvrir(mode);
    assert.match(m.d.querySelector("#src-l").textContent, /figées/);
    m.click("[data-go=prospects]");
    assert.ok(m.d.querySelectorAll("tbody tr").length > 0);
    assert.deepEqual(m.errs, []);
  }
});

/* P2 */ test("P2 · Tri des candidats : onglets, Retenir (sans fenêtre, attribué à Com-02), Connu", async () => {
  const m = await ouvrir("live");
  m.click("[data-go=recherches]");
  assert.deepEqual([...m.d.querySelectorAll(".tri-tabs button")].map(b => b.textContent.split(" ·")[0]), ["Tous", "Retenus", "Écartés", "Connus"]);
  assert.equal(m.d.querySelector("#view").textContent.includes("À examiner ·"), false, "l'onglet À examiner ne doit plus exister");
  m.click("[data-keep='501']");
  assert.equal(m.d.querySelector(".modal"), null, "Retenir ne doit pas ouvrir de fenêtre");
  await m.wait();
  const upd = m.calls.filter(c => c.input.query?.startsWith("update public.candidat"));
  assert.match(upd[0].input.query, /statut_tri = 'Retenu'.*trie_par = 2.*where id = 501;.*update public\.commerce set commercial_id = 2/s);
  assert.match(m.toasts(), /fiche prospect créée dans Supabase, attribuée à Wassila Moussaoui/);
  m.click("[data-known='502']"); await m.wait();
  assert.match(m.calls.at(-2).input.query, /statut_tri = 'Connu'.*where id = 502/s);
  assert.deepEqual(m.errs, []);
});

/* P3 */ test("P3 · Candidat Connu : le commercial voit que le commerce est « Pas intéressé »", async () => {
  const m = await ouvrir("live");
  m.click("[data-go=recherches]");
  assert.match(m.d.querySelector("#view").textContent, /Déjà connu · Pas intéressé : à ne pas recontacter/);
});

/* P4 */ test("P4 · Relances automatiques : Sans réponse ×3 → visite, À rappeler avec ou sans date, RDV → veille", async () => {
  const m = await ouvrir("figee");
  const id = m.w.eval("S.commerces[0].id");
  m.w.eval(`S.interactions = S.interactions.filter(i => i.commerceId !== ${id});
    S.interactions.push({ id: 9001, commerceId: ${id}, commercialId: 2, date: "2026-10-01", canal: "Appel", resultat: "Sans réponse" },
                        { id: 9002, commerceId: ${id}, commercialId: 2, date: "2026-10-06", canal: "Appel", resultat: "Sans réponse" });
    go("fiche", ${id});`);
  assert.equal(m.d.querySelector("#view").textContent.includes("Relance le"), false, "le champ de date de relance manuel doit avoir disparu");
  m.change("#i-res", "Sans réponse");
  assert.match(m.d.querySelector("#i-auto").textContent, /Visite sur place · 3e sans réponse → J\+5 ouvrés · le 21\/10\/2026/);
  m.change("#i-res", "À rappeler");
  assert.equal(m.d.querySelector("#rap-f").hidden, false);
  assert.match(m.d.querySelector("#i-auto").textContent, /J\+7 ouvrés · le 23\/10\/2026/);
  m.change("#i-rap", "2026-10-16");
  assert.match(m.d.querySelector("#i-auto").textContent, /date convenue avec le gérant · le 16\/10\/2026/);
  m.change("#i-res", "Intéressé");
  assert.equal(m.d.querySelector("#rap-f").hidden, true);
  assert.match(m.d.querySelector("#i-auto").textContent, /présentation par e-mail · J\+1 ouvré · le 15\/10\/2026/);
  m.change("#i-res", "RDV pris"); m.change("#i-rdv", "2026-10-22T10:00");
  assert.match(m.d.querySelector("#i-auto").textContent, /Confirmer le RDV par e-mail · la veille du RDV · le 21\/10\/2026/);
  assert.deepEqual([...m.d.querySelectorAll("#i-canal option")].map(o => o.textContent), ["Appel", "E-mail", "Visite"], "le canal SMS doit avoir disparu");
  assert.deepEqual(m.errs, []);
});

/* P5 */ test("P5 · Échange « Pas intéressé » : confirmation, mise à jour Supabase, le prospect disparaît des écrans", async () => {
  const m = await ouvrir("live");
  m.click("[data-go=prospects]");
  m.click("tbody [data-open]");
  m.change("#i-res", "Pas intéressé");
  m.d.querySelector("#f-inter").dispatchEvent(new m.w.Event("submit", { bubbles: true, cancelable: true }));
  assert.match(m.d.querySelector("#mt")?.textContent || "", /n'est pas intéressé/);
  m.click('[data-action="confirm-retire"]'); await m.wait(80);
  assert.ok(m.calls.some(c => /update public\.commerce set statut_prospection = 'Pas intéressé' where id in \(170\)/.test(c.input.query || "")));
  assert.deepEqual([...m.d.querySelectorAll("tbody .ens")].map(x => x.textContent), ["Boulangerie Ancienne"]);
});

/* Relances réelles (Supabase) : en retard de 2, 8 et 20 jours, et une pour aujourd'hui (date de la recette : 14/10/2026) */
async function relancesReelles(m) {
  const add = (cid, nom, iid, date, res, rel) => { m.data.commerces.push(COM(cid, nom, { statut: "À rappeler", ville: "Lille" })); m.data.interactions.push([iid, cid, 2, date, "Appel", res, null, rel, null, null, null, null]); };
  add(180, "Rappel J+2", 980, "2026-10-05", "À rappeler", "2026-10-12");
  add(181, "Rappel J+8", 981, "2026-09-28", "À rappeler", "2026-10-06");
  add(182, "Rappel J+20", 982, "2026-09-15", "À rappeler", "2026-09-24");
  add(183, "Rappel du jour", 983, "2026-10-07", "À rappeler", "2026-10-14");
  m.click('[data-action="live"]'); await m.wait(80);
}

/* P6 */ test("P6 · « À traiter » sur les vraies relances : aujourd'hui, puis paliers de retard (à rattraper, en retard, à requalifier)", async () => {
  const m = await ouvrir("live");
  await relancesReelles(m);
  assert.match(m.d.querySelector("h1").textContent, /Données d'illustration \(sauf À traiter et RDV\)/);
  m.click("[data-todo=jour]");
  assert.match(m.d.querySelector("#todo").textContent, /Rappel du jour.*Action du jour/s, "la relance du jour doit être dans « Aujourd'hui »");
  m.click("[data-todo=retard]");
  const rows = Object.fromEntries([...m.d.querySelectorAll("#todo .trow")].map(r => [r.querySelector(".ens").textContent, r.querySelector(".act-k").textContent]));
  assert.deepEqual(rows, { "Rappel J+2": "À rattraper", "Rappel J+8": "En retard", "Rappel J+20": "À requalifier" });
  const stale = m.d.querySelector("#todo [data-stale='182']");
  m.click(stale); await m.wait(80);
  assert.ok(m.calls.some(c => /update public\.commerce set statut_prospection = 'Injoignable' where id = 182;/.test(c.input.query || "")), "« Classer injoignable » doit être enregistré dans Supabase");
  assert.equal(m.d.querySelector("[data-scope]"), null, "le sélecteur Ma zone / Équipe doit avoir disparu");
  assert.deepEqual(m.errs, []);
});

/* P7 */ test("P7 · Lancer une recherche : le workflow n8n actif reçoit ville, rayon, activités et commercial", async () => {
  const m = await ouvrir("live");
  m.click("[data-go=recherches]");
  m.w.eval('ui.rq = "Lille, 1 km"; ui.rTypes = ["Boulangerie"]; ui.rRayon = 1;');
  m.click('[data-action="launch"]'); await m.wait();
  const n8n = m.calls.find(c => c.server === "n8n");
  assert.ok(n8n, "n8n n'a pas été appelé");
  assert.equal(n8n.tool, "execute_workflow");
  assert.equal(n8n.input.workflowId, "AWmyFaxZsYPLdOAN");
  assert.equal(n8n.input.executionMode, "production");
  assert.deepEqual(JSON.parse(JSON.stringify(n8n.input.inputs.webhookData.body)), { ville: "Lille", rayon_km: 1, types: ["Boulangerie"], commercial_id: 2, max_resultats: 10 });
  assert.equal(m.d.querySelector('[data-action="launch"]').disabled, true, "le bouton doit être bloqué pendant la recherche");
});

/* P8 */ test("P8 · Fiche prospect : potentiel calculé expliqué, pas de section Synthèse ni « suivi par »", async () => {
  const m = await ouvrir("live");
  m.w.eval("go('fiche', 170)");
  const h1 = m.d.querySelector("h1");
  assert.match(h1.textContent, /Potentiel/);
  assert.match(h1.querySelector(".temp").title, /secteur 20 pts \+ horaires 10 pts \(83 h\/sem\.\) = 30\/40 → Élevé/);
  assert.equal(m.d.querySelector("#view").textContent.includes("Synthèse"), false);
  assert.equal(m.d.querySelector("#view").textContent.includes("suivi par"), false);
  assert.equal(m.d.querySelector("[data-relance]"), null, "la section Relance de la fiche doit avoir disparu");
});

test("P9 · Données d'illustration du tableau de bord : aucun prospect « Pas intéressé »", async () => {
  const m = await ouvrir("live");
  assert.equal(m.w.eval("DEMO_RAW.commerces.filter(c => c[10] === 'Pas intéressé').length"), 0);
  assert.equal(m.d.querySelector("#view").textContent.includes("Pas intéressé"), false, "le pipeline ne doit plus afficher « Pas intéressé »");
});

/* P10 */ test("P10 · RDV « Présentation devis » : échange enregistré dans Supabase, brouillon IA demandé à n8n puis ouvert", async () => {
  const m = await ouvrir("live");
  m.w.eval("go('fiche', 170)");
  m.change("#i-res", "RDV pris"); m.change("#i-rdv", "2026-10-22T10:00"); m.change("#i-rdvobj", "Présentation devis");
  m.d.querySelector("#f-inter").dispatchEvent(new m.w.Event("submit", { bubbles: true, cancelable: true }));
  await m.wait(300);
  const ins = m.calls.find(c => (c.input.query || "").startsWith("with i as (insert into public.interaction"));
  assert.ok(ins, "l'échange n'a pas été enregistré dans Supabase");
  assert.match(ins.input.query, /'RDV pris'.*'Présentation devis'.*'Planifié'/s);
  assert.match(ins.input.query, /update public\.commerce set statut_prospection = 'RDV pris' where id = 170/);
  const n8n = m.calls.find(c => c.server === "n8n");
  assert.ok(n8n, "n8n n'a pas été appelé pour le brouillon");
  assert.equal(n8n.input.workflowId, "PhjyhtFAAnD4Xog6");
  assert.ok(n8n.input.inputs.webhookData.body.interaction_id >= 950);
  assert.match(m.d.querySelector("#mt")?.textContent || "", /Brouillon à valider/);
  assert.equal(m.d.querySelector("#m-objet").value, "Présentation de votre proposition le 22 octobre");
  assert.deepEqual(m.errs, []);
});

/* P11 */ test("P11 · E-mails : brouillon modifiable, enregistré, validé puis envoyé par n8n (Gmail)", async () => {
  const m = await ouvrir("live");
  m.click("[data-go=emails]");
  assert.match(m.d.querySelector("#view").textContent, /À valider · 1/);
  m.click("[data-mail='40']");
  m.d.querySelector("#m-corps").value = "Madame, Monsieur,\n\nTexte relu par la commerciale.";
  m.click('[data-action="mail-send"]'); await m.wait(200);
  const upd = m.calls.find(c => (c.input.query || "").startsWith("update public.mail"));
  assert.match(upd.input.query, /corps = 'Madame, Monsieur,\n\nTexte relu par la commerciale\.'/);
  assert.match(upd.input.query, /modifie_avant_envoi = true, statut = 'Validé'/);
  const env = m.calls.find(c => c.server === "n8n");
  assert.equal(env.input.workflowId, "0YDc66J34yXL3ywe");
  assert.equal(env.input.inputs.webhookData.body.mail_id, 40);
  assert.match(m.toasts(), /E-mail envoyé/);
  m.click("[data-mailtab='Envoyé']");
  assert.match(m.d.querySelector("#view").textContent, /envoyé le 14\/10\/2026/);
  assert.deepEqual(m.errs, []);
});

/* P12 */ test("P12 · Agenda : le RDV apparaît dans la semaine, avec Google Agenda et l'état de l'e-mail", async () => {
  const m = await ouvrir("live");
  m.click("[data-go=agenda]");
  m.click("[data-week='1']");
  const ev = m.d.querySelector(".ag-ev");
  assert.ok(ev, "aucun rendez-vous affiché la semaine du 19 octobre");
  assert.match(ev.textContent, /10:00.*Diagnostic.*Boulangerie Ancienne/s);
  assert.match(ev.textContent, /Google/);
  assert.match(ev.textContent, /À valider/);
  m.click(ev);
  assert.match(m.d.querySelector("h1").textContent, /Boulangerie Ancienne/);
});

/* P13 */ test("P13 · Tournée terrain : date choisie, candidat + prospect distingués, ordre choisi, itinéraire, résultat de visite", async () => {
  const m = await ouvrir("live");
  m.click("[data-go=tournees]");
  assert.equal(m.d.querySelector(".tour-chip"), null, "plus de liste de tournées");
  assert.equal(m.d.querySelector("#t-nom"), null, "plus de formulaire « Nouvelle tournée »");
  m.change("#t-day", "2026-10-20");
  assert.match(m.d.querySelector(".card-head h2").textContent, /Tournée du mardi 20 octobre/);
  assert.ok(!m.calls.some(c => /insert into public\.tournee/.test(c.input.query || "")), "aucune tournée vide créée");
  m.click("[data-go=recherches]");
  m.click("[data-tour='501']"); await m.wait(80);
  assert.ok(m.calls.some(c => /with t as \(insert into public\.tournee \(commercial_id, date_tournee\) values \(2, '2026-10-20'\) returning id\) insert into public\.tournee_arret \(tournee_id, ordre, candidat_id\) select id, 1, 501 from t;/.test(c.input.query || "")), "la tournée se crée au premier arrêt");
  m.w.eval("go('fiche', 170)");
  m.click("[data-tourp='170']"); await m.wait(80);
  m.click("[data-go=tournees]");
  let stops = [...m.d.querySelectorAll(".stop")];
  assert.equal(stops.length, 2);
  assert.match(stops[0].textContent, /Candidat.*Fournil A/s);
  assert.match(stops[1].textContent, /Prospect.*Boulangerie Récente/s);
  assert.match(stops[0].textContent, /Ouvert le mardi : 06:00–20:00|Horaires inconnus|Fermé le mardi/);
  const href = m.d.querySelector('a[href^="https://www.google.com/maps/dir/"]').href;
  assert.match(href, /waypoints=/);
  m.click(stops[1].querySelector("[data-tmove$=':-1']")); await m.wait(80);
  stops = [...m.d.querySelectorAll(".stop")];
  assert.match(stops[0].textContent, /Prospect.*Boulangerie Récente/s, "le commercial doit pouvoir remonter un arrêt");
  m.click(stops[0].querySelector("[data-tres$=':À rappeler']")); await m.wait(120);
  assert.ok(m.calls.some(c => /update public\.tournee_arret set resultat = 'À rappeler'/.test(c.input.query || "")));
  assert.ok(m.calls.some(c => /insert into public\.interaction.*'Visite', 'À rappeler'/s.test(c.input.query || "")), "la visite doit être enregistrée comme échange");
  m.click("[data-go=dashboard]"); m.click("[data-todo=todo]");
  assert.match(m.d.querySelector("#view").textContent, /Ma prochaine tournée.*Tournée du 20\/10\/2026.*2 arrêts.*1 candidat.*1 prospect/s);
  assert.deepEqual(m.errs, []);
});

/* P14 */ test("P14 · Tournée : motif de visite (1re visite, relance, RDV commercial), recherche paginée, modifier et supprimer", async () => {
  const m = await ouvrir("live");
  for (let k = 0; k < 23; k++) m.data.commerces.push(COM(200 + k, `Commerce test ${String(k).padStart(2, "0")}`, { ville: "Lille" }));
  m.click('[data-action="live"]'); await m.wait(80);
  m.click("[data-go=tournees]");
  m.change("#t-day", "2026-10-20");
  // RDV du jour hors tournée : proposé avec un bouton, pas ajouté d'office
  const box = m.d.querySelector(".rdv-day");
  assert.ok(box, "les RDV commerciaux du jour doivent être proposés");
  assert.match(box.textContent, /10 h 00 · Boulangerie Ancienne.*Ajouter à la tournée/s);
  assert.equal(m.d.querySelectorAll(".stop").length, 0, "un RDV ne s'ajoute pas tout seul à la tournée");
  // Recherche + liste paginée (20 par page)
  assert.match(m.d.querySelector(".pick-nav").textContent, /1–20 sur 25/);
  m.click("[data-tpage='2']");
  assert.match(m.d.querySelector(".pick-nav").textContent, /21–25 sur 25/);
  const q = m.d.querySelector("#t-q"); q.value = "récente"; q.dispatchEvent(new m.w.Event("input", { bubbles: true }));
  let rows = [...m.d.querySelectorAll(".pick-list .pick-row")];
  assert.equal(rows.length, 1); assert.match(rows[0].textContent, /Boulangerie Récente.*1re visite/s);
  m.click(rows[0].querySelector("[data-tourp='170']")); await m.wait(80);
  m.click(m.d.querySelector(".rdv-day [data-tourp='160']")); await m.wait(80);
  let stops = [...m.d.querySelectorAll(".stop")];
  assert.equal(stops.length, 2);
  assert.match(stops[0].textContent, /1re visite.*Prospect.*Boulangerie Récente/s);
  assert.match(stops[1].textContent, /RDV commercial · 10 h 00.*Boulangerie Ancienne.*RDV Diagnostic · heure fixe 10 h 00/s);
  assert.ok(stops[1].classList.contains("mot-rdv"));
  assert.deepEqual([...stops[1].querySelectorAll("[data-tres]")].map(b => b.textContent), ["RDV réalisé", "Reporté", "Annulé"]);
  m.click("[data-go=dashboard]"); m.click("[data-todo=todo]");
  assert.match(m.d.querySelector("#view").textContent, /1 1re visite · 1 RDV commercial \(10 h 00\)/);
  m.click("[data-go=tournees]");
  stops = [...m.d.querySelectorAll(".stop")];
  m.click(stops[1].querySelector("[data-tres$=':RDV réalisé']")); await m.wait(120);
  assert.ok(m.calls.some(c => /update public\.interaction set rdv_statut = 'Réalisé' where id = 900/.test(c.input.query || "")));
  // Modifier la tournée
  m.click('[data-action="tour-edit"]');
  m.d.querySelector("#te-date").value = "2026-10-21"; m.d.querySelector("#te-nom").value = "Lille sud";
  m.click('[data-action="tour-save"]'); await m.wait(80);
  assert.ok(m.calls.some(c => /update public\.tournee set date_tournee = '2026-10-21', nom = 'Lille sud' where id = 70/.test(c.input.query || "")));
  assert.match(m.d.querySelector(".card-head h2").textContent, /Lille sud/);
  // Supprimer : confirmation dans la page, puis suppression des arrêts et de la tournée
  m.click('[data-action="tour-askdel"]');
  assert.match(m.d.querySelector(".tour-del").textContent, /Supprimer « Lille sud » et ses 2 arrêts/);
  m.click('[data-action="tour-del"]'); await m.wait(80);
  assert.ok(m.calls.some(c => /delete from public\.tournee_arret where tournee_id = 70; delete from public\.tournee where id = 70;/.test(c.input.query || "")));
  assert.equal(m.d.querySelectorAll(".stop").length, 0);
  assert.match(m.d.querySelector(".stops").textContent, /Aucun arrêt ce jour-là/);
  assert.deepEqual(m.errs, []);
});

/* P15 */ test("P15 · « Ma to do » : une relance en retard reportée y passe, avec la prochaine tournée et les 5 prochains RDV", async () => {
  const m = await ouvrir("live");
  await relancesReelles(m);
  assert.ok(m.d.querySelector("[data-todo=todo]"), "l'onglet Ma to do doit exister");
  assert.equal([...m.d.querySelectorAll("[data-todo]")].some(b => /Cette semaine/.test(b.textContent)), false, "l'onglet Cette semaine est remplacé");
  m.click("[data-todo=retard]");
  m.click("#todo [data-panel='181:report']");
  m.d.querySelector("#rep-181").value = "2026-10-21";
  m.click("#todo [data-postpone='181:date']"); await m.wait(100);
  assert.ok(m.calls.some(c => /update public\.interaction set date_relance_initiale = coalesce\(date_relance_initiale, date_relance\), date_relance = '2026-10-21' where id = 981;/.test(c.input.query || "")), "le report doit être enregistré dans Supabase");
  assert.match(m.toasts(), /reporté au 21\/10\/2026 · dans Ma to do/);
  assert.ok(![...m.d.querySelectorAll("#todo .trow .ens")].some(e => e.textContent === "Rappel J+8"), "la relance reportée quitte « En retard »");
  m.click("[data-todo=todo]");
  const v = m.d.querySelector("#todo").textContent;
  assert.match(v, /Relances reportées.*Rappel J\+8.*Reportée.*reportée au mercredi 21 octobre · initialement prévue le 06\/10\/2026/s);
  assert.match(v, /Ma (prochaine )?tournée/);
  assert.match(v, /Mes 5 prochains RDV.*Boulangerie Ancienne/s, "les RDV viennent des vraies données");
  assert.ok(m.d.querySelectorAll("#todo .todo li").length <= 5, "pas plus de 5 RDV");
  assert.deepEqual(m.errs, []);
});

/* P16 */ test("P16 · Plusieurs tournées le même jour : signalées et regroupées en une seule", async () => {
  const m = await ouvrir("live");
  m.data.tournees.push([60, "2026-10-15", null, "Planifiée", 2, [[601, 1, null, 160, null, null]]], [61, "2026-10-15", null, "Planifiée", 2, [[611, 1, null, 170, null, null]]], [62, "2026-10-15", null, "Planifiée", 2, []]);
  m.click('[data-action="live"]'); await m.wait(80);
  m.click("[data-go=tournees]");
  m.change("#t-day", "2026-10-15");
  assert.match(m.d.querySelector("#view").textContent, /3 tournées existent ce jour-là \(1 autre arrêt\)/);
  m.click('[data-action="tour-merge"]'); await m.wait(80);
  assert.ok(m.calls.some(c => /update public\.tournee_arret set tournee_id = 60, ordre = ordre \+ 1 where tournee_id in \(61, 62\); delete from public\.tournee where id in \(61, 62\);/.test(c.input.query || "")));
  assert.equal(m.d.querySelectorAll(".stop").length, 2);
  assert.doesNotMatch(m.d.querySelector("#view").textContent, /tournées existent ce jour-là/);
  assert.deepEqual(m.errs, []);
});

/* P17 */ test("P17 · « À traiter » : le nom de l'enseigne ouvre sa fiche ; un commerce sans fiche ouvre la création", async () => {
  const m = await ouvrir("live");
  await relancesReelles(m);
  assert.doesNotMatch(m.d.querySelector("#todo").textContent, /Saisir le résultat/);
  m.click("[data-todo=todo]");
  assert.doesNotMatch(m.d.querySelector("#todo").textContent, /Préparer/);
  m.click("[data-todo=retard]");
  m.click([...m.d.querySelectorAll("#todo .trow .ens")].find(e => e.textContent === "Rappel J+20"));
  assert.equal(m.w.location.hash, "#fiche-182");
  assert.match(m.d.querySelector("#view").textContent, /Rappel J\+20/);
  // Commerce fictif sans fiche réelle : formulaire de création pré-rempli, enregistré dans Supabase
  m.click("[data-go=dashboard]");
  const nom = m.w.eval("DEMO_S.commerces[0].enseigne");
  m.w.eval("ouvrirDepuisDemo(DEMO_S.commerces[0].id)");
  assert.equal(m.d.querySelector("#p-enseigne")?.value, nom, "le formulaire de création doit être pré-rempli");
  m.d.querySelector("#f-prospect").dispatchEvent(new m.w.Event("submit", { bubbles: true, cancelable: true })); await m.wait(120);
  const ins = m.calls.find(c => /^insert into public\.commerce \(enseigne, type_commerce, zone, ville/.test(c.input.query || ""));
  assert.ok(ins && ins.input.query.includes(`'${nom.replace(/'/g, "''")}'`), "la fiche doit être créée dans Supabase");
  assert.equal(m.w.eval("ui.view"), "fiche", "la nouvelle fiche doit s'ouvrir");
  assert.equal(commerceOuvert(m), nom);
  assert.deepEqual(m.errs, []);
});
const commerceOuvert = m => m.w.eval("commerce(ui.ficheId).enseigne");

/* P18 */ test("P18 · Liste des prospects : colonne E-mail, vide quand Google Maps n'en a pas fourni", async () => {
  const m = await ouvrir("live");
  m.data.commerces[0][8] = "contact@ancienne.fr";
  m.click('[data-action="live"]'); await m.wait(80);
  m.click("[data-go=prospects]");
  const th = [...m.d.querySelectorAll("thead th")].map(x => x.textContent);
  assert.ok(th.includes("E-mail"), "colonne E-mail absente");
  const col = th.indexOf("E-mail");
  const cell = nom => [...m.d.querySelectorAll("tbody tr")].find(r => r.textContent.includes(nom)).children[col].textContent.trim();
  assert.equal(cell("Boulangerie Ancienne"), "contact@ancienne.fr");
  assert.equal(cell("Boulangerie Récente"), "", "sans e-mail, la case reste vide");
  assert.deepEqual(m.errs, []);
});
