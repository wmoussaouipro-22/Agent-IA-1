import { workflow, node, trigger, sticky, newCredential, expr } from '@n8n/workflow-sdk';

const SUPA = { supabaseApi: { id: 'GHUhaajY4ANuZ3iE', name: 'Supabase account 109' } };

const rdvEnregistre = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'RDV enregistré sur la plateforme',
    parameters: { httpMethod: 'POST', path: 'ecolocaux-rdv-brouillon', responseMode: 'onReceived' }
  },
  output: [{ body: { interaction_id: 120 } }]
});

const lireRdv = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Lire le rendez-vous',
    parameters: {
      resource: 'row', operation: 'get', tableId: 'interaction',
      filters: { conditions: [{ keyName: 'id', keyValue: expr('{{ $json.body?.interaction_id ?? $json.interaction_id }}') }] }
    },
    credentials: SUPA
  },
  output: [{ id: 120, commerce_id: 159, commercial_id: 2, rdv_date_heure: '2026-10-20T08:00:00+00:00', rdv_objet: 'Diagnostic', canal: 'Appel', commentaire: null }]
});

const lireCommerce = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Lire le commerce',
    parameters: {
      resource: 'row', operation: 'get', tableId: 'commerce',
      filters: { conditions: [{ keyName: 'id', keyValue: expr('{{ $("Lire le rendez-vous").first().json.commerce_id }}') }] }
    },
    credentials: SUPA
  },
  output: [{ id: 159, enseigne: 'La Ruche Gourmande', type_commerce: 'Boulangerie', nom_contact: null, email: 'contact@exemple.fr', adresse: '12 rue de Lille', code_postal: '59100', ville: 'Roubaix' }]
});

const lireCommercial = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Lire le commercial',
    parameters: {
      resource: 'row', operation: 'get', tableId: 'commercial',
      filters: { conditions: [{ keyName: 'id', keyValue: expr('{{ $("Lire le rendez-vous").first().json.commercial_id }}') }] }
    },
    credentials: SUPA
  },
  output: [{ id: 2, prenom: 'Wassila', nom: 'Moussaoui', telephone: '06 00 00 00 00', email: 'wmoussaoui.pro@gmail.com' }]
});

const lireModele = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Lire le modèle du RDV',
    parameters: {
      resource: 'row', operation: 'getAll', tableId: 'modele_mail', limit: 1,
      filterType: 'manual', matchType: 'allFilters',
      filters: { conditions: [{ keyName: 'objet_rdv', condition: 'eq', keyValue: expr('{{ $("Lire le rendez-vous").first().json.rdv_objet }}') }] }
    },
    credentials: SUPA
  },
  output: [{ id: 1, objet_rdv: 'Diagnostic', sujet: 'Confirmation de notre rendez-vous diagnostic du {date}', consignes: 'But : confirmer le rendez-vous…' }]
});

const contexte = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Préparer le contexte',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'x-date', name: 'date_txt', value: expr('{{ DateTime.fromISO($("Lire le rendez-vous").first().json.rdv_date_heure).setZone("Europe/Paris").setLocale("fr").toFormat("cccc d LLLL yyyy") }}'), type: 'string' },
          { id: 'x-heure', name: 'heure_txt', value: expr('{{ DateTime.fromISO($("Lire le rendez-vous").first().json.rdv_date_heure).setZone("Europe/Paris").toFormat("HH\'h\'mm") }}'), type: 'string' },
          { id: 'x-adr', name: 'adresse_txt', value: expr('{{ [$("Lire le commerce").first().json.adresse, $("Lire le commerce").first().json.code_postal, $("Lire le commerce").first().json.ville].filter(Boolean).join(" ") }}'), type: 'string' },
          { id: 'x-sujet', name: 'sujet', value: expr('{{ $json.sujet.replace("{date}", DateTime.fromISO($("Lire le rendez-vous").first().json.rdv_date_heure).setZone("Europe/Paris").setLocale("fr").toFormat("d LLLL")).replace("{heure}", DateTime.fromISO($("Lire le rendez-vous").first().json.rdv_date_heure).setZone("Europe/Paris").toFormat("HH\'h\'mm")).replace("{enseigne}", $("Lire le commerce").first().json.enseigne) }}'), type: 'string' },
          { id: 'x-signature', name: 'signature', value: expr('{{ [$("Lire le commercial").first().json.prenom + " " + $("Lire le commercial").first().json.nom, "Conseiller(e) Eco-Locaux", $("Lire le commercial").first().json.telephone].filter(Boolean).join("\\n") }}'), type: 'string' },
          { id: 'x-dest', name: 'destinataire', value: expr('{{ $("Lire le commerce").first().json.email || "" }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ date_txt: 'mardi 20 octobre 2026', heure_txt: '10h00', adresse_txt: '12 rue de Lille 59100 Roubaix', sujet: 'Confirmation de notre rendez-vous diagnostic du 20 octobre', signature: 'Wassila Moussaoui\nConseiller(e) Eco-Locaux', destinataire: 'contact@exemple.fr' }]
});

const rediger = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Rédiger l’e-mail (IA)',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-4o-mini' },
      responses: {
        values: [
          {
            type: 'text',
            role: 'user',
            content: expr('{{ "Objet du rendez-vous : " + $("Lire le modèle du RDV").first().json.objet_rdv + "\\nConsignes :\\n" + $("Lire le modèle du RDV").first().json.consignes + "\\n\\nInformations :\\n- Commerce : " + $("Lire le commerce").first().json.enseigne + " (" + ($("Lire le commerce").first().json.type_commerce || "commerce de proximité") + ")\\n- Gérant : " + ($("Lire le commerce").first().json.nom_contact || "inconnu, écrire « Madame, Monsieur »") + "\\n- Date : " + $json.date_txt + " à " + $json.heure_txt + "\\n- Adresse : " + ($json.adresse_txt || "à l’adresse du commerce") + "\\n- Note du commercial : " + ($("Lire le rendez-vous").first().json.commentaire || "aucune") + "\\n\\nSignature à reprendre telle quelle :\\n" + $json.signature }}')
          }
        ]
      },
      simplify: true,
      options: {
        instructions: 'Tu rédiges, pour un commercial de la société Eco-Locaux (audit énergétique et mise en conformité des locaux de petits commerces), l’e-mail envoyé au commerçant après la prise d’un rendez-vous. Français, vouvoiement, ton professionnel et chaleureux, 90 à 150 mots, phrases courtes, pas de jargon. Suis strictement les consignes. N’invente aucun chiffre, prix, délai ni aide financière. Pas de formule creuse. Texte brut sans mise en forme Markdown. Termine par la signature fournie, telle quelle. Réponds uniquement par un objet JSON : {"corps": "<texte complet de l’e-mail, salutation et signature comprises>"}.',
        maxTokens: 600,
        temperature: 0.4,
        textFormat: { textOptions: { type: 'json_object' } }
      }
    },
    credentials: { openAiApi: { id: 'c1wYj8G3gMrvqH5B', name: 'OpenAI account 47' } }
  },
  output: [{ output: [{ content: [{ text: '{"corps":"Madame, Monsieur,\\n…"}' }] }] }]
});

const creerBrouillon = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Créer le brouillon',
    parameters: {
      resource: 'row', operation: 'create', tableId: 'mail', dataToSend: 'defineBelow',
      fieldsUi: {
        fieldValues: [
          { fieldId: 'objet', fieldValue: expr('{{ $("Préparer le contexte").first().json.sujet }}') },
          { fieldId: 'corps', fieldValue: expr('{{ (() => { const t = $json.output_text ?? $json.text ?? $json.output?.[0]?.content?.[0]?.text ?? $json.message?.content ?? (typeof $json.content === "string" ? $json.content : $json.content?.[0]?.text) ?? ""; try { return JSON.parse(t).corps || t; } catch (e) { return t; } })() }}') },
          { fieldId: 'type_mail', fieldValue: expr('{{ "RDV · " + $("Lire le rendez-vous").first().json.rdv_objet }}') },
          { fieldId: 'statut', fieldValue: 'Brouillon IA' },
          { fieldId: 'canal', fieldValue: 'E-mail' },
          { fieldId: 'commerce_id', fieldValue: expr('{{ $("Lire le rendez-vous").first().json.commerce_id }}') },
          { fieldId: 'commercial_id', fieldValue: expr('{{ $("Lire le rendez-vous").first().json.commercial_id }}') },
          { fieldId: 'interaction_id', fieldValue: expr('{{ $("Lire le rendez-vous").first().json.id }}') },
          { fieldId: 'e_mails', fieldValue: expr('{{ $("Préparer le contexte").first().json.destinataire || null }}') }
        ]
      }
    },
    credentials: SUPA
  },
  output: [{ id: 40, code: 'Mail-040', statut: 'Brouillon IA' }]
});

const agenda = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Ajouter à Google Agenda',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'event',
      operation: 'create',
      calendar: { __rl: true, mode: 'id', value: 'primary' },
      start: expr('{{ $("Lire le rendez-vous").first().json.rdv_date_heure }}'),
      end: expr('{{ DateTime.fromISO($("Lire le rendez-vous").first().json.rdv_date_heure).plus({ minutes: $("Lire le rendez-vous").first().json.rdv_objet === "Diagnostic" ? 60 : 45 }).toISO() }}'),
      useDefaultReminders: true,
      additionalFields: {
        summary: expr('{{ $("Lire le rendez-vous").first().json.rdv_objet + " · " + $("Lire le commerce").first().json.enseigne }}'),
        location: expr('{{ $("Préparer le contexte").first().json.adresse_txt }}'),
        description: expr('{{ "RDV Eco-Locaux : " + $("Lire le rendez-vous").first().json.rdv_objet + "\\nCommerce : " + $("Lire le commerce").first().json.enseigne + " (" + ($("Lire le commerce").first().json.type_commerce || "") + ")\\nTéléphone : " + ($("Lire le commerce").first().json.telephone || "—") }}'),
        sendUpdates: 'none'
      }
    },
    credentials: { googleCalendarOAuth2Api: newCredential('Google Agenda (wmoussaoui.pro)') }
  },
  output: [{ id: 'evt123', htmlLink: 'https://calendar.google.com/…', status: 'confirmed' }]
});

const lierAgenda = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Noter l’événement sur le RDV',
    parameters: {
      resource: 'row', operation: 'update', tableId: 'interaction',
      filterType: 'manual', matchType: 'allFilters',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $("Lire le rendez-vous").first().json.id }}') }] },
      dataToSend: 'defineBelow',
      fieldsUi: { fieldValues: [{ fieldId: 'rdv_id_evenement_agenda', fieldValue: expr('{{ $json.id || null }}') }] }
    },
    credentials: SUPA
  },
  output: [{ id: 120, rdv_id_evenement_agenda: 'evt123' }]
});

const note = sticky(
  '## RDV → brouillon d’e-mail IA + Google Agenda\n' +
  'Lancé par la plateforme quand un commercial enregistre un « RDV pris » (objet Diagnostic, Présentation devis ou Signature).\n' +
  'Entrée : `{ "interaction_id": 120 }`.\n\n' +
  'Le texte est rédigé par OpenAI à partir du modèle de la table `modele_mail` (un par objet de RDV, modifiable dans Supabase). Le brouillon arrive dans `mail` au statut « Brouillon IA » : le commercial le relit, le modifie et l’envoie depuis la plateforme (workflow « Envoyer l’e-mail validé »).',
  [rdvEnregistre, lireRdv],
  { color: 7 }
);

export default workflow('ecolocaux-rdv-brouillon', 'CLAUDE Eco-Locaux · RDV → brouillon e-mail IA + agenda')
  .add(rdvEnregistre)
  .to(lireRdv)
  .to(lireCommerce)
  .to(lireCommercial)
  .to(lireModele)
  .to(contexte)
  .to(rediger)
  .to(creerBrouillon)
  .to(agenda)
  .to(lierAgenda)
  .add(note)
  .group('Rassembler les informations', [lireRdv, lireCommerce, lireCommercial, lireModele, contexte], { description: 'RDV, commerce, commercial et modèle d’e-mail correspondant à l’objet du RDV.' })
  .group('Rédiger et ranger le brouillon', [rediger, creerBrouillon], { description: 'OpenAI rédige l’e-mail ; il est enregistré en « Brouillon IA » pour validation par le commercial.' })
  .group('Agenda du commercial', [agenda, lierAgenda], { description: 'Le RDV est ajouté au Google Agenda du commercial et l’identifiant de l’événement est noté sur le RDV.' });
