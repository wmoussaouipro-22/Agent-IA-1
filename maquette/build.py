import json
d=json.load(open('data.json')); d.pop('objections',None)
for c in d['commerciaux']:
    if c[0]==2: c[3]='Nord'  # Com-02 (Wassila) passe en zone Nord
demo={k:d[k] for k in ('commerces','interactions','commerciaux')}
# Illustration : quelques rendez-vous à venir en zone Nord (commercial 2)
import copy; demo=copy.deepcopy(demo)
out={c[0] for c in demo['commerces'] if c[10]=='Pas intéressé'}
demo['commerces']=[c for c in demo['commerces'] if c[0] not in out]
demo['interactions']=[i for i in demo['interactions'] if i[1] not in out]
sud=[c for c in demo['commerces'] if c[6]=='Nord' and c[10] in ('Contacté','À rappeler','Nouveau')][:4]
nid=max(i[0] for i in demo['interactions'])+1
for k,(c,(j,h,st,obj)) in enumerate(zip(sud,[('2026-10-14','15:00','Confirmé','Diagnostic énergétique'),('2026-10-15','09:30','Confirmé','Diagnostic'),('2026-10-19','14:00','Planifié','Présentation de l\'offre'),('2026-10-22','10:00','Planifié','Visite technique')])):
    rel={'2026-10-14':'2026-10-14','2026-10-15':'2026-10-14'}.get(j)  # RDV du jour ; confirmation la veille du RDV de demain
    demo['interactions'].append([nid+k,c[0],2,'2026-10-0'+str(k+5),'Appel','RDV pris','Rendez-vous fixé avec le gérant.',rel,f'{j}T{h}:00+02:00',st,obj])
    c[10]='RDV pris'
# Illustration conforme aux règles de relance (jours ouvrés) : chaque prochaine étape est recalculée
import datetime as dt
def ouvres(iso,n):
    d=dt.date.fromisoformat(iso[:10]); k=0
    while k<n:
        d+=dt.timedelta(days=1)
        if d.weekday()<5: k+=1
    return d.isoformat()
def jours(iso,n): return (dt.date.fromisoformat(iso[:10])+dt.timedelta(days=n)).isoformat()
for i in demo['interactions']+d['interactions']:
    if i[4]=='SMS': i[4]='Appel'   # canal SMS retiré de la plateforme
par={}
for i in demo['interactions']: par.setdefault(i[1],[]).append(i)
statut={c[0]:c for c in demo['commerces']}
futur=iter([d for d in (jours('2026-10-16',k) for k in range(60)) if dt.date.fromisoformat(d).weekday()<5])
heures=iter(['10:00','14:30','11:00','16:00']*30)
for cid,h in par.items():
    h.sort(key=lambda i:(i[3] or '',i[0]),reverse=True); last=h[0]; c=statut.get(cid)
    if not c or c[10] in ('Signé','Pas intéressé'): continue
    r=last[5]
    if r=='Intéressé': last[7]=ouvres(last[3],1)                      # présentation par e-mail à J+1
    elif r=='Sans réponse':
        k=0
        for i in h:
            if i[5]=='Sans réponse': k+=1
            else: break
        if k>=5 or c[10]=='Injoignable': last[7]=jours(last[3],90); c[10]='Injoignable'   # injoignable : nouvel essai à J+90
        elif k>=3: last[7]=ouvres(last[3],5)                            # visite sur place à J+5
        else: last[7]=ouvres(last[3],2)                                 # nouvel appel à J+2
    elif r=='À rappeler' and not last[7]: last[7]=ouvres(last[3],7)     # rappel à J+7 (sauf date convenue)
    elif r=='RDV pris' and (not last[8] or last[8][:10]<'2026-10-14'):
        j=next(futur); last[8]=f'{j}T{next(heures)}:00+02:00'; last[9]='Planifié'; last[7]=jours(j,-1)   # RDV à venir, confirmation la veille
# Nouveaux statuts et résultats (15/10/2026) : mêmes correspondances que dans Supabase
ST={'À rappeler':'Contacté','RDV pris':'Rendez-vous confirmé','Pas intéressé':'Non intéressé'}
for base in (demo,d):
    for c in base['commerces']: c[10]=ST.get(c[10],c[10])
    for i in base['interactions']:
        if i[5]=='RDV pris': i[5]='Rendez-vous pris'
# Illustration du pipeline (zone Nord de la commerciale) : un prospect à chaque étape de l'audit, les autres restent « Contacté »
pool=[c for c in sorted(demo['commerces'],key=lambda c:c[0]) if c[6]=='Nord' and c[10]=='Contacté']
for c,st in zip(pool,['En qualification','Audit en préparation','Audit prêt','En qualification']): c[10]=st
g=json.load(open('google.json'))
gids={r[0] for r in d['recherches'] if r[3]=='Google Maps'}
d['recherches']=[r for r in d['recherches'] if r[0] in gids]
d['candidats']=[c for c in d['candidats'] if c[1] in gids]
KEEP={6,10,14,18,34,46,103,70,101,33}
d['commerces']=[c for c in d['commerces'] if c[0] in KEEP and c[10]!='Pas intéressé']
d['interactions']=[i for i in d['interactions'] if i[1] in KEEP]
d['gx']={str(c[0]):c[1:] for c in g['c']}
d['gr']={str(r[0]):r[1] for r in g['r']}
t=open('template.html').read()
sql=open('live.sql').read().strip()
t=t.replace('__DEMO__',json.dumps(demo,ensure_ascii=False,separators=(',',':')).replace('</','<\\/'))
t=t.replace('__SQL__',json.dumps(sql,ensure_ascii=False).replace('</','<\\/'))
open('eco-locaux-crm.html','w').write(t.replace('__DATA__',json.dumps(d,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')))
print('recherches',len(d['recherches']),'candidats',len(d['candidats']))
