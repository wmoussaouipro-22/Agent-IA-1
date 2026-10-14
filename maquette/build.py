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
