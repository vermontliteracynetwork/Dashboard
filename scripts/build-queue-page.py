# Builds the teacher's live Build Queue page (Build Queue 202, her words 2026-10-15: "keep queue updted and presentable to me so i can keep track")
# from docs/DEVELOPMENT_PLAN.md. Run: python3 scripts/build-queue-page.py <out.html>, then publish that file to the
# Build Queue artifact (https://claude.ai/artifact/Xj955Dv7fySwuXA4emGxAe) after every push (preview branch or main).
import re, html, datetime
SRC='/home/user/Dashboard/docs/DEVELOPMENT_PLAN.md'
import sys
OUT=sys.argv[1] if len(sys.argv)>1 else 'build-queue.html'
lines=open(SRC).read().split('\n')
start=next(i for i,l in enumerate(lines) if l.startswith('## 🧱 BUILD QUEUE'))
end=next(i for i,l in enumerate(lines) if i>start and l.startswith('## '))
items={}
for l in lines[start:end]:
    m=re.match(r'^(\d+)\. (.*)',l)
    if not m: continue
    n=int(m.group(1)); body=m.group(2)
    if n in items: continue
    items[n]=body
def strip_md(t):
    t=re.sub(r'~~(.*?)~~',r'\1',t); t=re.sub(r'\*\*(.*?)\*\*',r'\1',t); t=t.replace('`','')
    return t
def esc(t): return html.escape(strip_md(t))
def parse(n,b):
    m=re.search(r'\*\*(.+?)\*\*',b)
    title=m.group(1) if m else re.sub(r'~~','',b.split(' ')[0:8].__str__())
    if not m:
        mm=re.match(r'~~(.+?)~~',b); title=mm.group(1) if mm else b[:80]
    up=b.upper()
    if re.search(r'WAITING ON THE TEACHER',b): st='waiting'
    elif 'ON PREVIEW' in b and not b.startswith('~~'): st='preview'
    elif 'IN PROGRESS' in b and not b.startswith('~~'): st='progress'
    elif 'QUEUED' in b and not b.startswith('~~'): st='queued'
    elif b.startswith('~~') or re.search(r'\b(SHIPPED|DONE|DELIVERED|ANSWERED)\b',b): st='done'
    else: st='other'
    dm=re.search(r'(ON PREVIEW|SHIPPED|DONE|DELIVERED|ANSWERED|QUEUED|IN PROGRESS|WAITING ON THE TEACHER)[^0-9]{0,30}(20\d\d-\d\d-\d\d)',b)
    date=dm.group(2) if dm else ''
    q=re.search(r'verbatim[^)]*\):\s*(".*?")(?=\s*(\(|\*\*|$|\. \*\*|Also:|\. ))',b)
    words=q.group(1) if q else ''
    notes=[]
    for k in ['What shipped:','Status (in progress):','Status:','Her answers needed:',"Claudia's review (in the PDF):",'Proposed:','Next:']:
        mm=re.search(re.escape('**'+k+'**')+r'\s*(.*?)(?=\s\*\*[A-Z][^*]{2,40}:\*\*|$)',b)
        if mm: notes.append((k.rstrip(':'),mm.group(1)))
    return dict(n=n,title=title,st=st,date=date,words=words,notes=notes)
all_items=[parse(n,b) for n,b in sorted(items.items())]
today=datetime.date.today().isoformat()
show=[i for i in all_items if i['n']>=191 or i['st'] in ('progress','queued','waiting','preview')]
groups=[('progress','Working on now'),('preview','On the preview link: waiting for your OK to go to students'),('queued','Up next, in order'),('waiting','Waiting on you'),('done','Done today')]
counts={g:len([i for i in show if i['st']==g and (g!='done' or i['date']==today)]) for g,_ in groups}
def card(i):
    pill={'progress':'In progress','preview':'On preview','queued':'Queued','waiting':'Needs your answer','done':'Done'}.get(i['st'],'')
    notes=''.join(f'<p class="note"><b>{esc(k)}:</b> {esc(v)}</p>' for k,v in i['notes'])
    words=f'<details><summary>Your words</summary><p class="words">{esc(i["words"])}</p></details>' if i['words'] else ''
    return f'<article class="item {i["st"]}"><header><span class="num">#{i["n"]}</span><h3>{esc(i["title"])}</h3><span class="pill">{pill}</span></header>{notes}{words}</article>'
sections=''
for g,label in groups:
    lst=[i for i in show if i['st']==g and (g!='done' or i['date']==today)]
    if g=='done': lst=sorted(lst,key=lambda x:-x['n'])
    if not lst: continue
    sections+=f'<section><h2>{label} <span class="count">{len(lst)}</span></h2>{"".join(card(i) for i in lst)}</section>'
older=[i for i in all_items if i['st']=='done' and i['date']!=today and i['n']>=150]
older_html=''.join(f'<li><span class="num">#{i["n"]}</span> {esc(i["title"])} <span class="d">{i["date"]}</span></li>' for i in sorted(older,key=lambda x:-x['n']))
stamp=datetime.datetime.now().strftime('%B %-d, %Y, %-I:%M %p UTC')
page=f'''<title>Dashboard Build Queue</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;600;800&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<style>
/* Layout: one readable column of status groups, newest work first, each request a card with its status pill. */
:root{{--bg:#f6f4fb;--panel:#ffffff;--ink:#1f1147;--soft:#5b5480;--line:#e3dcf5;--accent:#7c3aed;--prog:#2563eb;--queue:#7c3aed;--wait:#c2410c;--done:#15803d;--display:'Lexend',system-ui,sans-serif;--body:'Atkinson Hyperlegible',system-ui,sans-serif}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#16112b;--panel:#211a3d;--ink:#efeaff;--soft:#b6addb;--line:#3a3163;--accent:#b18cff;--prog:#7fb0ff;--queue:#c4a5ff;--wait:#ffab7a;--done:#6fdc9a;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#16112b;--panel:#211a3d;--ink:#efeaff;--soft:#b6addb;--line:#3a3163;--accent:#b18cff;--prog:#7fb0ff;--queue:#c4a5ff;--wait:#ffab7a;--done:#6fdc9a;color-scheme:dark}}
body{{background:var(--bg);color:var(--ink);font:16px/1.5 var(--body)}}
.wrap{{max-width:860px;margin:0 auto;padding-block:28px 48px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
h1{{font:800 clamp(1.6rem,4vw,2.2rem)/1.15 var(--display);margin:0 0 4px;text-wrap:balance}}
.sub{{color:var(--soft);margin:0 0 18px}}
.tally{{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px}}
.tally span{{font:600 .9rem var(--display);padding:6px 12px;border-radius:999px;border:2px solid var(--line);background:var(--panel)}}
.tally b{{font-variant-numeric:tabular-nums}}
h2{{font:800 1.15rem var(--display);margin:26px 0 10px;display:flex;align-items:center;gap:8px}}
.count{{font:600 .8rem var(--display);color:var(--soft);border:2px solid var(--line);border-radius:999px;padding:0 8px}}
.item{{background:var(--panel);border:2px solid var(--line);border-left:6px solid var(--c);border-radius:14px;padding:12px 14px;margin:0 0 10px}}
.item.progress{{--c:var(--prog)}}.item.preview{{--c:#0e7490}}.item.queued{{--c:var(--queue)}}.item.waiting{{--c:var(--wait)}}.item.done{{--c:var(--done)}}
.item header{{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}}
.num{{font:800 .85rem var(--display);color:var(--soft);font-variant-numeric:tabular-nums}}
h3{{font:600 1.02rem/1.3 var(--display);margin:0;flex:1 1 260px;min-width:0}}
.pill{{font:600 .75rem var(--display);color:var(--c);border:2px solid var(--c);border-radius:999px;padding:1px 9px;white-space:nowrap}}
.note{{margin:8px 0 0;color:var(--ink)}}.note b{{color:var(--soft)}}
details{{margin-top:8px}}summary{{cursor:pointer;color:var(--accent);font:600 .85rem var(--display);min-height:32px}}
summary:focus-visible{{outline:3px solid var(--accent);outline-offset:2px;border-radius:6px}}
.words{{font-style:italic;color:var(--soft);margin:4px 0 0}}
ul.older{{list-style:none;padding:0;margin:0;columns:2 280px;column-gap:24px}}ul.older li{{break-inside:avoid;padding:3px 0;border-bottom:1px solid var(--line)}}
.d{{color:var(--soft);font-size:.85rem;font-variant-numeric:tabular-nums}}
</style>
<div class="wrap">
<h1>Dashboard Build Queue</h1>
<p class="sub">Every request in the order you sent it. Updated {stamp}, with each push to the live site.</p>
<div class="tally"><span>Working on now: <b>{counts["progress"]}</b></span><span>Up next: <b>{counts["queued"]}</b></span><span>Waiting on you: <b>{counts["waiting"]}</b></span><span>Done today: <b>{counts["done"]}</b></span></div>
{sections}
<section><h2>Done earlier</h2><ul class="older">{older_html}</ul></section>
</div>'''
open(OUT,'w').write(page)
print(OUT, {g:counts[g] for g in counts})
