import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const SUPA = { supabaseApi: { id: 'GHUhaajY4ANuZ3iE', name: 'Supabase account 109' } };

const demande = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Extraction demandée sur la plateforme',
    parameters: { httpMethod: 'POST', path: 'ecolocaux-extraction-energie', responseMode: 'onReceived' }
  },
  output: [{ body: { commerce_id: 159, interaction_id: 107, mail_id: null, source: "Compte rendu d'échange", texte: 'Le gérant a deux vitrines réfrigérées et une chambre froide. Facture d’électricité autour de 850 € par mois.' } }]
});

const texte = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Texte à analyser',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 't-com', name: 'commerce_id', value: expr('{{ Number($json.body?.commerce_id ?? $json.commerce_id) }}'), type: 'number' },
          { id: 't-int', name: 'interaction_id', value: expr('{{ $json.body?.interaction_id ?? $json.interaction_id ?? null }}'), type: 'number' },
          { id: 't-mail', name: 'mail_id', value: expr('{{ $json.body?.mail_id ?? $json.mail_id ?? null }}'), type: 'number' },
          { id: 't-src', name: 'source', value: expr('{{ $json.body?.source ?? $json.source ?? "Compte rendu d\'échange" }}'), type: 'string' },
          { id: 't-txt', name: 'texte', value: expr('{{ String($json.body?.texte ?? $json.texte ?? "").slice(0, 4000) }}'), type: 'string' }
        ]
      },
      options: { ignoreConversionErrors: true }
    }
  },
  output: [{ commerce_id: 159, interaction_id: 107, mail_id: null, source: "Compte rendu d'échange", texte: 'Le gérant a deux vitrines réfrigérées…' }]
});

const extraire = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Extraire les informations (IA)',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-4o-mini' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ "Texte du commercial ou du gérant :\\n" + $json.texte }}') }] },
      simplify: true,
      options: {
        instructions: 'Tu extrais d’un texte écrit par un commercial Eco-Locaux (ou d’un e-mail de commerçant) les informations utiles au pré-diagnostic énergétique d’un petit commerce. Rubriques autorisées, à recopier exactement : Froid (vitrines, chambres froides) | Cuisson (fours, plaques) | Chauffage / climatisation | Éclairage | Facture d\'énergie | Consommation annuelle | Surface du local | Autre. N’extrais que ce qui est écrit explicitement : n’invente, ne déduis et ne calcule rien. Reprends les chiffres tels quels avec leur unité. Si rien d’utile, renvoie une liste vide. Réponds uniquement par un objet JSON : {"infos": [{"rubrique": "<une des rubriques>", "valeur": "<information courte, telle qu’écrite>", "unite": "<unité ou null>"}]}.',
        maxTokens: 500,
        temperature: 0,
        textFormat: { textOptions: { type: 'json_object' } }
      }
    },
    credentials: { openAiApi: { id: 'c1wYj8G3gMrvqH5B', name: 'OpenAI account 47' } }
  },
  output: [{ output: [{ content: [{ text: { infos: [{ rubrique: 'Froid (vitrines, chambres froides)', valeur: '2 vitrines réfrigérées et 1 chambre froide', unite: null }] } }] }] }]
});

const lister = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Lister les informations',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'l-infos', name: 'infos', value: expr('{{ (() => { const RUB = ["Froid (vitrines, chambres froides)", "Cuisson (fours, plaques)", "Chauffage / climatisation", "Éclairage", "Facture d\'énergie", "Consommation annuelle", "Surface du local", "Autre"]; let t = $json.output?.[0]?.content?.[0]?.text ?? $json.output_text ?? $json.text ?? ""; if (typeof t === "string") { try { t = JSON.parse(t); } catch (e) { t = {}; } } const l = Array.isArray(t?.infos) ? t.infos : []; return l.filter(x => x && x.valeur).map(x => ({ rubrique: RUB.includes(x.rubrique) ? x.rubrique : "Autre", valeur: String(x.valeur).slice(0, 300), unite: x.unite && x.unite !== "null" ? String(x.unite).slice(0, 40) : null })); })() }}'), type: 'array' }
        ]
      }
    }
  },
  output: [{ infos: [{ rubrique: 'Froid (vitrines, chambres froides)', valeur: '2 vitrines réfrigérées et 1 chambre froide', unite: null }] }]
});

const unParUn = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: {
    name: 'Une information par ligne',
    parameters: { fieldToSplitOut: 'infos' }
  },
  output: [{ rubrique: 'Froid (vitrines, chambres froides)', valeur: '2 vitrines réfrigérées et 1 chambre froide', unite: null }]
});

const deposer = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Déposer « À confirmer »',
    parameters: {
      resource: 'row', operation: 'create', tableId: 'info_energetique', dataToSend: 'defineBelow',
      fieldsUi: {
        fieldValues: [
          { fieldId: 'commerce_id', fieldValue: expr('{{ $("Texte à analyser").first().json.commerce_id }}') },
          { fieldId: 'rubrique', fieldValue: expr('{{ $json.rubrique }}') },
          { fieldId: 'valeur', fieldValue: expr('{{ $json.valeur }}') },
          { fieldId: 'unite', fieldValue: expr('{{ $json.unite || null }}') },
          { fieldId: 'source', fieldValue: expr('{{ $("Texte à analyser").first().json.source }}') },
          { fieldId: 'interaction_id', fieldValue: expr('{{ $("Texte à analyser").first().json.interaction_id || null }}') },
          { fieldId: 'mail_id', fieldValue: expr('{{ $("Texte à analyser").first().json.mail_id || null }}') },
          { fieldId: 'extrait_par_ia', fieldValue: 'true' },
          { fieldId: 'statut_validation', fieldValue: 'À confirmer' },
          { fieldId: 'commentaire', fieldValue: 'Extrait par l’IA : à confirmer par le commercial.' }
        ]
      }
    },
    credentials: SUPA
  },
  output: [{ id: 1, statut_validation: 'À confirmer' }]
});

const note = sticky(
  '## Extraction IA des informations énergétiques\n' +
  'Lancé par le bouton « Extraire avec l’IA » d’un échange de la fiche prospect.\n' +
  'Entrée : `{ "commerce_id": 159, "interaction_id": 107, "source": "Compte rendu d\'échange", "texte": "…" }`.\n\n' +
  'OpenAI ne fait qu’extraire ce qui est écrit (rien d’inventé). Chaque information arrive dans `info_energetique` au statut « À confirmer » (garanti aussi par Supabase) : le commercial la valide ou la rejette sur la fiche. Seules les informations validées alimentent le pré-diagnostic.',
  [demande, texte],
  { color: 7 }
);

export default workflow('ecolocaux-extraction-energie', 'CLAUDE Eco-Locaux · Extraction IA des informations énergétiques')
  .add(demande)
  .to(texte)
  .to(extraire)
  .to(lister)
  .to(unParUn)
  .to(deposer)
  .add(note)
  .group('Préparer le texte', [texte], { description: 'Commerce, échange ou e-mail d’origine et texte à analyser.' })
  .group('Extraire et déposer', [extraire, lister, unParUn, deposer], { description: 'OpenAI repère les informations ; chacune est déposée « À confirmer » avec sa source.' });
