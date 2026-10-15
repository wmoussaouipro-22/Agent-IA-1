import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SUPA = { supabaseApi: { id: 'GHUhaajY4ANuZ3iE', name: 'Supabase account 109' } };

const toutesLes30min = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Toutes les 30 minutes',
    parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 30 }] } }
  }
});

const enAttente = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Invitations en attente',
    parameters: {
      resource: 'row',
      operation: 'getAll',
      tableId: 'interaction',
      returnAll: true,
      filterType: 'string',
      filterString: 'rdv_invitation_envoyee=eq.true&rdv_statut=eq.$1&rdv_reponse_invitation=eq.$2&rdv_id_evenement_agenda=not.is.null&rdv_date_heure=gte.$3',
      filterStringParameters: { values: [{ value: 'Confirmé' }, { value: 'En attente' }, { value: expr('{{ $now.toUTC().toISO() }}') }] }
    },
    credentials: SUPA
  },
  output: [{ id: 107, commerce_id: 159, commercial_id: 2, rdv_id_evenement_agenda: 'obm2qvdrdmkk7j6c86bk6jkftc', rdv_reponse_invitation: 'En attente' }]
});

const lireEvenement = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Lire l’événement Google',
    parameters: {
      resource: 'event',
      operation: 'get',
      calendar: { __rl: true, mode: 'id', value: 'wmoussaoui.pro@gmail.com' },
      eventId: expr('{{ $json.rdv_id_evenement_agenda }}')
    },
    credentials: { googleCalendarOAuth2Api: { id: '8TAQcojKgjcNN83j', name: 'Google Calendar wmoussaoui.pro perso' } },
    onError: 'continueRegularOutput'
  },
  output: [{ id: 'obm2qvdrdmkk7j6c86bk6jkftc', attendees: [{ email: 'wmoussaoui.pro@gmail.com', organizer: true, self: true, responseStatus: 'needsAction' }, { email: 'wmoussaoui@edu.oreegami.com', responseStatus: 'accepted' }] }]
});

const lireReponse = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Lire la réponse du gérant',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'r-int', name: 'interaction_id', value: expr('{{ $("Invitations en attente").item.json.id }}'), type: 'number' },
          { id: 'r-com', name: 'commerce_id', value: expr('{{ $("Invitations en attente").item.json.commerce_id }}'), type: 'number' },
          { id: 'r-cial', name: 'commercial_id', value: expr('{{ $("Invitations en attente").item.json.commercial_id }}'), type: 'number' },
          { id: 'r-rep', name: 'reponse', value: expr('{{ (() => { const invites = ($json.attendees || []).filter(a => !a.organizer && !a.self); if (invites.some(a => a.responseStatus === "accepted")) return "Acceptée"; if (invites.some(a => a.responseStatus === "declined")) return "Refusée"; return "En attente"; })() }}'), type: 'string' },
          { id: 'r-ech', name: 'echeance', value: expr('{{ (() => { const d = $now.setZone("Europe/Paris"); const w = d.weekday; return d.plus({ days: w === 5 ? 3 : w === 6 ? 2 : 1 }).toISODate(); })() }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ interaction_id: 107, commerce_id: 159, commercial_id: 2, reponse: 'Acceptée', echeance: '2026-10-16' }]
});

const reponseRecue = node({
  type: 'n8n-nodes-base.filter',
  version: 2.2,
  config: {
    name: 'Réponse reçue ?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.reponse }}'), operator: { type: 'string', operation: 'notEquals' }, rightValue: 'En attente' }],
        combinator: 'and'
      }
    }
  },
  output: [{ interaction_id: 107, commerce_id: 159, commercial_id: 2, reponse: 'Acceptée', echeance: '2026-10-16' }]
});

const noterReponse = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Noter la réponse',
    parameters: {
      resource: 'row',
      operation: 'update',
      tableId: 'interaction',
      filterType: 'manual',
      matchType: 'allFilters',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.interaction_id }}') }] },
      dataToSend: 'defineBelow',
      fieldsUi: { fieldValues: [{ fieldId: 'rdv_reponse_invitation', fieldValue: expr('{{ $json.reponse }}') }] }
    },
    credentials: SUPA
  },
  output: [{ id: 107, rdv_reponse_invitation: 'Acceptée' }]
});

const refusee = ifElse({
  version: 2.2,
  config: {
    name: 'Invitation refusée ?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $("Réponse reçue ?").item.json.reponse }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'Refusée' }],
        combinator: 'and'
      }
    }
  }
});

const recontacter = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Tâche « Recontacter le gérant »',
    parameters: {
      resource: 'row',
      operation: 'create',
      tableId: 'tache',
      dataToSend: 'defineBelow',
      fieldsUi: {
        fieldValues: [
          { fieldId: 'commerce_id', fieldValue: expr('{{ $("Réponse reçue ?").item.json.commerce_id }}') },
          { fieldId: 'commercial_id', fieldValue: expr('{{ $("Réponse reçue ?").item.json.commercial_id }}') },
          { fieldId: 'interaction_origine_id', fieldValue: expr('{{ $("Réponse reçue ?").item.json.interaction_id }}') },
          { fieldId: 'type', fieldValue: 'Appel' },
          { fieldId: 'libelle', fieldValue: 'Recontacter le gérant (invitation refusée)' },
          { fieldId: 'echeance', fieldValue: expr('{{ $("Réponse reçue ?").item.json.echeance }}') },
          { fieldId: 'source', fieldValue: 'Règle J+X' },
          { fieldId: 'regle', fieldValue: 'invitation refusée → J+1 ouvré' }
        ]
      }
    },
    credentials: SUPA
  },
  output: [{ id: 1, libelle: 'Recontacter le gérant (invitation refusée)' }]
});

const note = sticky(
  '## Réponse du gérant à l’invitation Google Agenda\n' +
  'Toutes les 30 minutes : relit les RDV confirmés dont l’invitation est « En attente ».\n\n' +
  'Gérant « Oui » → Acceptée ; « Non » → Refusée et tâche « Recontacter le gérant » à J+1 ouvré. Sans réponse : rien ne change. Le commercial peut toujours corriger la réponse sur la fiche.',
  [toutesLes30min, enAttente],
  { color: 7 }
);

export default workflow('ecolocaux-reponse-invitation', 'CLAUDE Eco-Locaux · Réponse à l’invitation (Google Agenda)')
  .add(toutesLes30min)
  .to(enAttente)
  .to(lireEvenement)
  .to(lireReponse)
  .to(reponseRecue)
  .to(noterReponse)
  .to(refusee.onTrue(recontacter))
  .add(note)
  .group('Lire les réponses', [enAttente, lireEvenement, lireReponse], { description: 'Invitations en attente et réponse du gérant dans Google Agenda.' })
  .group('Enregistrer', [reponseRecue, noterReponse, refusee, recontacter], { description: 'Réponse notée dans Supabase ; invitation refusée → tâche de relance.' });
