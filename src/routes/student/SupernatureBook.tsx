import { useEffect, useRef, useState } from 'react';
import { ENERGY_FACE, REGIONS, SN, snSound } from '../../lib/supernature';
import { CHAPTERS, CREATURES, art, byId, type ChapterId, type Creature } from '../../lib/supernatureCreatures';
import SupernatureWriting, { Icon } from './SupernatureWriting';

// The Encyclopedia (her requests, 2026-10-13): a pixel book reached from the bookshelf. It opens on
// a working table of contents; every chapter also has its own ribbon tab on the right edge, so any
// chapter is one tap away. A chapter is a grid of creatures (a silhouette until found) on the left
// page, and the picked creature on the right page with two sides: Facts and Story. Back always goes
// up one level (creature page to Contents, Contents to Home), Home sits in the top right.

type View = 'toc' | ChapterId;
type Bar = (o?: { back?: () => void; backLabel?: string; extra?: React.ReactNode }) => React.ReactNode;
const READ_KEY = 'supernature.readstory';
const LISTEN = 'M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8';
const inChapter = (id: ChapterId) => CREATURES.filter((c) => c.chapter === id);
const regionLabel = (id: string) => REGIONS.find((r) => r.id === id)?.label ?? id;

export default function SupernatureBook({ bar, say, found, start, goGlobe, goHome }: {
  bar: Bar; say: (t: string) => void; found: string[]; start: string | null; goGlobe: () => void; goHome: () => void;
}) {
  const first = start ? byId(start) : undefined;
  const [view, setView] = useState<View>(first ? first.chapter : 'toc');
  const [pick, setPick] = useState(first ? Math.max(0, inChapter(first.chapter).findIndex((c) => c.id === first.id)) : 0);
  const [side, setSide] = useState<'facts' | 'story'>('facts');
  const [readToMe, setReadToMe] = useState(() => { try { return localStorage.getItem(READ_KEY) !== 'off'; } catch { return true; } });
  const [write, setWrite] = useState(false);
  const swipe = useRef<number | null>(null);
  const list = view === 'toc' ? [] : inChapter(view);
  const c: Creature | undefined = list[pick];
  const isFound = !!c && found.includes(c.id);
  const chapterIdx = CHAPTERS.findIndex((ch) => ch.id === view);
  const chapter = CHAPTERS[chapterIdx];

  // Stories read themselves aloud (her rule for storytelling screens), with a switch to stop it.
  useEffect(() => {
    if (side === 'story' && c && isFound && readToMe) say(`${c.name}. ${c.tale}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, c?.id, readToMe]);

  const openChapter = (id: ChapterId, idx = 0) => { snSound('page'); setView(id); setPick(idx); setSide('facts'); };
  const toToc = () => { snSound('close'); setView('toc'); };
  const flip = (d: number) => {
    if (view === 'toc') { if (d > 0) openChapter(CHAPTERS[0].id); return; }
    const n = pick + d;
    if (n >= 0 && n < list.length) { snSound('page'); setPick(n); setSide('facts'); return; }
    const next = CHAPTERS[chapterIdx + d];
    if (!next) { toToc(); return; }
    openChapter(next.id, d > 0 ? 0 : inChapter(next.id).length - 1);
  };
  const setRead = (on: boolean) => { setReadToMe(on); try { localStorage.setItem(READ_KEY, on ? 'on' : 'off'); } catch { /* fine */ } };
  const foundIn = (id: ChapterId) => inChapter(id).filter((x) => found.includes(x.id)).length;

  const tocRow = (ch: typeof CHAPTERS[number], n: number) => (
    <button key={ch.id} type="button" className="sn-toc-row" onClick={() => openChapter(ch.id)}>
      <span className="sn-toc-icon" style={{ background: ch.color }}><img src={art(ch.icon)} alt="" /></span>
      <span className="sn-toc-num">{n}</span>
      <span className="sn-toc-title">{ch.title}</span>
      <span className="sn-toc-count">{foundIn(ch.id)} / {inChapter(ch.id).length}</span>
    </button>
  );

  return (
    <div className="sn-room">
      {bar(view === 'toc'
        ? { back: goHome, backLabel: 'Home' }
        : { back: toToc, backLabel: 'Contents' })}
      <div className="sn-book2" onPointerDown={(e) => { swipe.current = e.clientX; }}
        onPointerUp={(e) => { const s = swipe.current; swipe.current = null; if (s !== null && Math.abs(e.clientX - s) > 70) flip(e.clientX < s ? 1 : -1); }}>
        <img src={`${SN}ui/${view === 'toc' ? 'book-blank' : 'book-chapter'}.png`} alt="" className="sn-book2-img" />

        {view === 'toc' && (
          <>
            <div className="sn-page left">
              <h2 className="sn-page-title">Contents</h2>
              <p className="sn-page-sub">Tap a chapter, or use the ribbons on the side.</p>
              <div className="sn-toc-gods">
                {tocRow(CHAPTERS[0], 1)}
                <div className="sn-toc-groups">
                  {(['Greek', 'Egyptian', 'Roman'] as const).map((g) => (
                    <button key={g} type="button" className="sn-chip-btn" onClick={() => openChapter('gods', inChapter('gods').findIndex((x) => x.group === g))}>{g}</button>
                  ))}
                </div>
              </div>
              {CHAPTERS.slice(1, 4).map((ch, i) => tocRow(ch, i + 2))}
            </div>
            <div className="sn-page right">
              {CHAPTERS.slice(4).map((ch, i) => tocRow(ch, i + 5))}
              <p className="sn-toc-total">You found {found.length} of {CREATURES.length} creatures.</p>
            </div>
          </>
        )}

        {view !== 'toc' && chapter && (
          <>
            {list.map((x, i) => {
              const f = found.includes(x.id);
              return (
                <button key={x.id} type="button" className={`sn-slot2${i === pick ? ' on' : ''}`}
                  style={{ left: 52 + (i % 4) * 96, top: 44 + Math.floor(i / 4) * 96 }}
                  onClick={() => { snSound('page'); setPick(i); setSide('facts'); }} aria-label={f ? x.name : 'Not found yet'}>
                  <img src={art(x.id)} alt="" className={f ? '' : 'sn-shadow'} />
                  <span>{f ? x.name : '???'}</span>
                </button>
              );
            })}
            <div className="sn-chapter-box">
              <b>Chapter {chapterIdx + 1}: {chapter.title}</b>
              <span>{chapter.blurb}</span>
              <span className="sn-chapter-found">{foundIn(chapter.id)} of {list.length} found</span>
              {chapter.id === 'gods' && (
                <div className="sn-toc-groups">
                  {(['Greek', 'Egyptian', 'Roman'] as const).map((g) => (
                    <button key={g} type="button" className={`sn-chip-btn${c?.group === g ? ' on' : ''}`} onClick={() => { snSound('page'); setPick(list.findIndex((x) => x.group === g)); setSide('facts'); }}>{g}</button>
                  ))}
                </div>
              )}
            </div>

            {c && (
              <div className="sn-page right sn-entry">
                <div className="sn-entry-head">
                  <span className="sn-entry-art"><img src={art(c.id)} alt={isFound ? c.name : 'A hidden creature'} className={isFound ? '' : 'sn-shadow'} /></span>
                  <div className="sn-entry-name">
                    <h2>{isFound ? c.name : '???'}</h2>
                    {isFound && <small>say it: {c.say}</small>}
                    <small>{c.group ? `${c.group} · ` : ''}{chapter.title}</small>
                  </div>
                  {isFound && <button type="button" className="sn-listen" onClick={() => say(side === 'story' ? `${c.name}. ${c.tale}` : `${c.name}. ${c.story}`)} aria-label="Listen"><Icon d={LISTEN} /></button>}
                </div>
                {isFound ? (
                  <>
                    <div className="sn-seg" role="tablist">
                      <button type="button" role="tab" aria-selected={side === 'facts'} className={side === 'facts' ? 'on' : ''} onClick={() => { snSound('page'); setSide('facts'); }}>Facts</button>
                      <button type="button" role="tab" aria-selected={side === 'story'} className={side === 'story' ? 'on' : ''} onClick={() => { snSound('page'); setSide('story'); }}>Story</button>
                    </div>
                    <div className="sn-entry-body">
                      {side === 'facts' ? (
                        <dl className="sn-facts2">
                          <dt>Origin</dt><dd>{c.from}</dd>
                          <dt>Lives</dt><dd>{c.home}</dd>
                          <dt>Size</dt><dd>{c.size}</dd>
                          <dt>Power</dt><dd>{c.power}</dd>
                          <dt>Energy</dt><dd className="sn-energy"><img src={ENERGY_FACE[c.energy]} alt="" className="sn-smooth" />{c.energy}</dd>
                          <dt>Traits</dt><dd className="sn-traits">{c.traits.map((t) => <span key={t}>{t}</span>)}</dd>
                          <dt>Name</dt><dd>{c.nameParts && <>{c.nameParts.map((p, i) => <span key={i}>{i > 0 && ' + '}<b>{p.text}</b> ({p.meaning})</span>)}. </>}{c.nameNote}</dd>
                          {c.respect && <><dt>Respect</dt><dd className="sn-respect">{c.respect}</dd></>}
                        </dl>
                      ) : (
                        <p className="sn-tale">{c.tale}</p>
                      )}
                    </div>
                    <div className="sn-entry-foot">
                      {side === 'story'
                        ? <button type="button" className="sn-btn2 small" aria-pressed={readToMe} onClick={() => setRead(!readToMe)}>{readToMe ? 'Read to me: on' : 'Read to me: off'}</button>
                        : <span />}
                      <button type="button" className="sn-btn2 small" onClick={() => setWrite(true)}>Write its name</button>
                    </div>
                  </>
                ) : (
                  <div className="sn-entry-body hidden">
                    <p>This creature is still hiding in {c.region.endsWith('ic') || ['atlantic', 'pacific', 'indian', 'southern'].includes(c.region) ? 'the ' : ''}{regionLabel(c.region)}.</p>
                    <p>Explore the Globe to find it. Then its facts and its story will appear here.</p>
                    <button type="button" className="sn-btn" onClick={goGlobe}>Go to the Globe</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <nav className="sn-ribbons" aria-label="Chapters">
        <button type="button" className={`sn-ribbon toc${view === 'toc' ? ' on' : ''}`} onClick={toToc}>
          <span className="sn-ribbon-icon"><Icon d="M5 5h14 M5 10h14 M5 15h14 M5 20h9" /></span>Contents
        </button>
        {CHAPTERS.map((ch) => (
          <button key={ch.id} type="button" className={`sn-ribbon${view === ch.id ? ' on' : ''}`} style={{ ['--rib' as string]: ch.color }} onClick={() => openChapter(ch.id)}>
            <span className="sn-ribbon-icon"><img src={art(ch.icon)} alt="" /></span>{ch.tab}
          </button>
        ))}
      </nav>

      <div className="sn-book-nav">
        <button type="button" className="sn-btn2" onClick={() => flip(-1)} disabled={view === 'toc'}><Icon d="M15 5l-7 7 7 7" />Previous</button>
        <span className="sn-book-where">{view === 'toc' ? `${CREATURES.length} creatures in ${CHAPTERS.length} chapters` : `${chapter?.title} · ${pick + 1} of ${list.length}`}</span>
        <button type="button" className="sn-btn2" onClick={() => flip(1)}>Next<Icon d="M9 5l7 7-7 7" /></button>
      </div>
      {write && c && <SupernatureWriting word={c.name} title="Write the name" onListen={() => say(c.name)} onClose={() => setWrite(false)} onDone={() => setWrite(false)} />}
    </div>
  );
}
