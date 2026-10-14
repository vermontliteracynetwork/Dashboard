import { useEffect, useMemo, useRef, useState } from 'react';
import { geoArea, geoCentroid, geoContains, geoDistance, geoGraticule10, geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { REGIONS, SN, snSound } from '../../lib/supernature';
import { CREATURES as ALL_CREATURES, shown, STARTERS, art, byId, madeList, type Creature } from '../../lib/supernatureCreatures';
import { Icon } from './SupernatureWriting';
// Her locks (Build Queue 107): creatures she set to Hidden never show.
const visibleCreatures = () => ALL_CREATURES.filter(shown);

// The interactive Globe (Build Queue 112; her words: "make globe fully interactive, spining/rotating,
// zoomable, labels for countries, tappable to see things"). A real world map (Natural Earth through
// world-atlas, public domain) drawn as a pixel globe: drag to spin it, pinch, scroll or use + and -
// to zoom, and it turns slowly on its own until touched. Continent and ocean names show from far
// away, country names as you zoom in. Tap a country or an ocean to see it and its creatures; every
// creature has a pin where its story comes from (a ? until it is found).

type BarOpts = { back?: () => void; backLabel?: string; extra?: React.ReactNode };
type CountryF = Feature<Geometry, { name: string }>;
const LOW = 300, HIGH = 600;
const LISTEN = 'M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8';

const CONT: Record<string, string[]> = {
  europe: ['Albania', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herz.', 'Bulgaria', 'Croatia', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Kosovo', 'Latvia', 'Lithuania', 'Luxembourg', 'Macedonia', 'Moldova', 'Montenegro', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'Russia', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom', 'Cyprus', 'N. Cyprus'],
  africa: ['Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroon', 'Central African Rep.', 'Chad', 'Congo', "Côte d'Ivoire", 'Dem. Rep. Congo', 'Djibouti', 'Egypt', 'Eq. Guinea', 'Eritrea', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'S. Sudan', 'Senegal', 'Sierra Leone', 'Somalia', 'Somaliland', 'South Africa', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'W. Sahara', 'Zambia', 'Zimbabwe', 'eSwatini'],
  northamerica: ['Bahamas', 'Belize', 'Canada', 'Costa Rica', 'Cuba', 'Dominican Rep.', 'El Salvador', 'Greenland', 'Guatemala', 'Haiti', 'Honduras', 'Jamaica', 'Mexico', 'Nicaragua', 'Panama', 'Puerto Rico', 'Trinidad and Tobago', 'United States of America'],
  southamerica: ['Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Falkland Is.', 'Guyana', 'Paraguay', 'Peru', 'Suriname', 'Uruguay', 'Venezuela'],
  oceania: ['Australia', 'Fiji', 'New Caledonia', 'New Zealand', 'Papua New Guinea', 'Solomon Is.', 'Vanuatu'],
  antarctica: ['Antarctica', 'Fr. S. Antarctic Lands'],
};
const continentOf = (name: string) => Object.keys(CONT).find((k) => CONT[k].includes(name)) ?? 'asia';
const NICE: Record<string, string> = {
  'Dem. Rep. Congo': 'Democratic Republic of the Congo', 'Central African Rep.': 'Central African Republic', 'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Dominican Rep.': 'Dominican Republic', 'Eq. Guinea': 'Equatorial Guinea', 'Falkland Is.': 'Falkland Islands', 'Fr. S. Antarctic Lands': 'French Southern Lands',
  'N. Cyprus': 'Cyprus', 'S. Sudan': 'South Sudan', 'Solomon Is.': 'Solomon Islands', 'W. Sahara': 'Western Sahara', Macedonia: 'North Macedonia',
  'United States of America': 'United States',
};
const nice = (n: string) => NICE[n] ?? n;
const COLOR: Record<string, string> = { europe: '#c78be0', asia: '#f2c14e', africa: '#f2a35a', northamerica: '#7cc25a', southamerica: '#57d3b8', oceania: '#e0457a', antarctica: '#e8f4ff' };
const CENTER: Record<string, [number, number]> = {
  europe: [15, 50], asia: [90, 40], africa: [20, 5], northamerica: [-100, 45], southamerica: [-60, -15], oceania: [135, -25], antarctica: [0, -80],
  atlantic: [-30, 20], pacific: [-150, 5], indian: [78, -20], arctic: [0, 80], southern: [60, -62],
};
function oceanAt(lon: number, lat: number) {
  if (lat > 66) return 'arctic';
  if (lat < -55) return 'southern';
  if (lon > 20 && lon < 120 && lat < 25) return 'indian';
  if (lon > -80 && lon < 20) return 'atlantic';
  return 'pacific';
}
// Where each creature's story comes from (longitude, latitude).
const PIN: Record<string, [number, number]> = {
  zeus: [22.35, 40.08], athena: [23.73, 37.98], poseidon: [25, 38.4], artemis: [22, 37.4], jupiter: [12.48, 41.89], mars: [12.6, 41.7], janus: [12.3, 42.1],
  ra: [31.3, 30.13], anubis: [31, 28.6], isis: [32.88, 24.02], bastet: [31.51, 30.56], cerberus: [22.48, 36.39], cyclops: [14.9, 37.6], ogre: [2.35, 46.8],
  minotaur: [25.16, 35.3], medusa: [-14, 29], demon: [10, 51], jinn: [45, 24], wisp: [-1.5, 52.4], unicorn: [-4.2, 56.8], dragon: [-3.8, 52.3],
  longdragon: [113, 34], fairy: [-8, 53.3], pixie: [-4.8, 50.4], golem: [14.42, 50.09], troll: [8.5, 61.5], raven: [-132, 53.3], thunderbird: [-100, 46],
  siren: [14.6, 40.6], pegasus: [22.9, 37.9], phoenix: [31.6, 29.7], hydra: [22.72, 37.55], kraken: [5, 70], nessie: [-4.5, 57.3], champ: [-73.3, 44.5],
  kappa: [139.5, 36.2], umibozu: [150, 30], mermaid: [72, -8], bunyip: [144.5, -36.8], sphinx: [31.13, 29.98], centaur: [23.05, 39.4], chimera: [30.46, 36.43],
  griffin: [26, 40.5], jackalope: [-105.38, 42.76], werewolf: [10.5, 48.5], selkie: [-5.5, 59], curupira: [-60, -3.5], kitsune: [135.77, 34.97],
  anansi: [-1.6, 6.7], yeti: [86.9, 28], bigfoot: [-122, 46],
};
const pinFor = (c: Creature, i: number): [number, number] => PIN[c.id] ?? (() => { const [x, y] = CENTER[c.region] ?? [0, 0]; return [x + (i % 4) * 3, y + Math.floor(i / 4) * 3] as [number, number]; })();

export default function SupernatureGlobe({ bar, say, found, onFind, openPage }: {
  bar: (o?: BarOpts) => React.ReactNode; say: (t: string) => void; found: string[]; onFind: (id: string) => void; openPage: (id: string) => void;
}) {
  const low = useRef<HTMLCanvasElement | null>(null);
  const high = useRef<HTMLCanvasElement | null>(null);
  const [countries, setCountries] = useState<CountryF[]>([]);
  const view = useRef({ lon: -20, lat: -15, zoom: 1, spin: true, target: null as null | { lon: number; lat: number; t: number; from: { lon: number; lat: number } } });
  const [spin, setSpin] = useState(true);
  const [zoomShow, setZoomShow] = useState(1);
  const [country, setCountry] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const imgs = useRef<Record<string, HTMLImageElement>>({});
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; lon: number; lat: number; moved: boolean; dist?: number; zoom?: number } | null>(null);
  const dirty = useRef(true);
  const all = useMemo(() => [...visibleCreatures(), ...madeList().map((m) => byId(m.id)!)], []);
  const pins = useMemo(() => all.map((c, i) => ({ c, at: pinFor(c, i) })), [all]);

  useEffect(() => {
    let live = true;
    fetch(`${SN}geo/countries-110m.json`).then((r) => r.json()).then((topo: Topology) => {
      if (!live) return;
      const fc = feature(topo, topo.objects.countries as GeometryCollection<{ name: string }>) as unknown as FeatureCollection<Geometry, { name: string }>;
      setCountries(fc.features); dirty.current = true;
    }).catch(() => undefined);
    return () => { live = false; };
  }, []);

  const proj = (size: number) => {
    const v = view.current;
    return geoOrthographic().scale((size / 2 - 4) * v.zoom).translate([size / 2, size / 2]).rotate([-v.lon, -v.lat]).clipAngle(90);
  };

  // Draw the globe (low resolution, scaled up for the pixel look) and its labels and pins (sharp).
  useEffect(() => {
    let raf = 0; let lastT = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      const v = view.current;
      if (v.target) {
        const k = Math.min(1, (now - v.target.t) / 900); const e = 1 - (1 - k) ** 3;
        let dl = v.target.lon - v.target.from.lon; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
        v.lon = v.target.from.lon + dl * e; v.lat = v.target.from.lat + (v.target.lat - v.target.from.lat) * e;
        if (k >= 1) v.target = null; dirty.current = true;
      } else if (v.spin && !drag.current) { v.lon = (v.lon + 6 * dt) % 360; dirty.current = true; }
      if (dirty.current && countries.length) { dirty.current = false; draw(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries, country, region, found]);
  useEffect(() => { dirty.current = true; }, [country, region, found]);

  const draw = () => {
    const lc = low.current?.getContext('2d'); const hc = high.current?.getContext('2d');
    if (!lc || !hc) return;
    const v = view.current;
    const p = proj(LOW); const path = geoPath(p, lc);
    lc.clearRect(0, 0, LOW, LOW);
    lc.beginPath(); path({ type: 'Sphere' } as GeoPermissibleObjects);
    const g = lc.createRadialGradient(LOW / 2 - 40, LOW / 2 - 40, 10, LOW / 2, LOW / 2, (LOW / 2) * v.zoom);
    g.addColorStop(0, '#5a8fe0'); g.addColorStop(1, '#2c4f9e'); lc.fillStyle = g; lc.fill();
    lc.beginPath(); path(geoGraticule10()); lc.strokeStyle = 'rgba(255,255,255,0.12)'; lc.lineWidth = 0.6; lc.stroke();
    for (const f of countries) {
      const cont = continentOf(f.properties.name);
      lc.beginPath(); path(f);
      lc.fillStyle = f.properties.name === country ? '#fff6a0' : region && cont === region ? '#ffe9a8' : COLOR[cont];
      lc.fill(); lc.strokeStyle = 'rgba(36,31,69,0.7)'; lc.lineWidth = 0.6; lc.stroke();
    }
    lc.beginPath(); path({ type: 'Sphere' } as GeoPermissibleObjects); lc.strokeStyle = '#241f45'; lc.lineWidth = 2; lc.stroke();

    // labels and pins, sharp
    const ph = proj(HIGH); const center: [number, number] = [v.lon, v.lat];
    hc.clearRect(0, 0, HIGH, HIGH);
    const visible = (ll: [number, number], lim = 1.35) => geoDistance(ll, center) < lim;
    const label = (text: string, ll: [number, number], size: number, color: string, italic = false) => {
      const xy = ph(ll); if (!xy || !visible(ll)) return;
      hc.font = `${italic ? 'italic ' : ''}700 ${size}px Lexend, sans-serif`; hc.textAlign = 'center'; hc.textBaseline = 'middle';
      hc.lineWidth = 4; hc.strokeStyle = 'rgba(36,31,69,0.85)'; hc.strokeText(text, xy[0], xy[1]); hc.fillStyle = color; hc.fillText(text, xy[0], xy[1]);
    };
    if (v.zoom < 1.8) {
      for (const r of REGIONS) label(r.label, CENTER[r.id], r.kind === 'ocean' ? 14 : 16, r.kind === 'ocean' ? '#cfe6ff' : '#fff', r.kind === 'ocean');
    } else {
      const minArea = 0.004 / (v.zoom * v.zoom);
      for (const f of countries) if (geoArea(f) > minArea || f.properties.name === country) label(nice(f.properties.name), geoCentroid(f) as [number, number], 12, f.properties.name === country ? '#ffd970' : '#fff');
      for (const r of REGIONS) if (r.kind === 'ocean') label(r.label, CENTER[r.id], 14, '#cfe6ff', true);
    }
    for (const { c, at } of pins) {
      if (!visible(at, 1.5)) continue;
      const xy = ph(at); if (!xy) continue;
      const f = found.includes(c.id) || c.chapter === 'mine';
      const r = 15 + Math.min(8, v.zoom * 2);
      hc.beginPath(); hc.arc(xy[0], xy[1], r, 0, Math.PI * 2); hc.fillStyle = f ? '#f6f1ff' : '#ffd970'; hc.fill(); hc.lineWidth = 3; hc.strokeStyle = '#241f45'; hc.stroke();
      if (f) {
        let im = imgs.current[c.id];
        if (!im) { im = new Image(); im.src = art(c.id); im.onload = () => { dirty.current = true; }; imgs.current[c.id] = im; }
        if (im.complete) { hc.imageSmoothingEnabled = false; hc.drawImage(im, xy[0] - r + 3, xy[1] - r + 3, (r - 3) * 2, (r - 3) * 2); }
      } else { hc.font = `700 ${r}px Lexend, sans-serif`; hc.fillStyle = '#241f45'; hc.textAlign = 'center'; hc.textBaseline = 'middle'; hc.fillText('?', xy[0], xy[1] + 1); }
    }
  };

  const toPoint = (e: React.PointerEvent) => { const r = high.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * HIGH, y: ((e.clientY - r.top) / r.height) * HIGH }; };
  const setZoom = (z: number) => { view.current.zoom = Math.max(1, Math.min(7, z)); setZoomShow(view.current.zoom); dirty.current = true; };
  const stopSpin = () => { view.current.spin = false; setSpin(false); };
  const flyTo = (ll: [number, number], zoom?: number) => { const v = view.current; v.target = { lon: ll[0], lat: Math.max(-70, Math.min(70, ll[1])), t: performance.now(), from: { lon: v.lon, lat: v.lat } }; if (zoom) setZoom(Math.max(v.zoom, zoom)); stopSpin(); };

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, toPoint(e));
    const v = view.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { x: 0, y: 0, lon: v.lon, lat: v.lat, moved: true, dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: v.zoom };
    } else { const pt = toPoint(e); drag.current = { x: pt.x, y: pt.y, lon: v.lon, lat: v.lat, moved: false }; }
  };
  const move = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !drag.current) return;
    pointers.current.set(e.pointerId, toPoint(e));
    const d = drag.current; const v = view.current;
    if (pointers.current.size === 2 && d.dist) {
      const [a, b] = [...pointers.current.values()];
      setZoom((d.zoom ?? 1) * (Math.hypot(a.x - b.x, a.y - b.y) / d.dist)); return;
    }
    const pt = toPoint(e); const dx = pt.x - d.x, dy = pt.y - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) { d.moved = true; stopSpin(); }
    if (d.moved) { const k = 90 / (HIGH / 2) / v.zoom; v.lon = d.lon - dx * k; v.lat = Math.max(-80, Math.min(80, d.lat + dy * k)); v.target = null; dirty.current = true; }
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current; const pt = pointers.current.get(e.pointerId) ?? toPoint(e);
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) return;
    drag.current = null;
    if (!d || d.moved) return;
    // a tap: a pin first, then a country, then the ocean
    const ph = proj(HIGH); const center: [number, number] = [view.current.lon, view.current.lat];
    const hit = pins.find(({ at }) => { const xy = ph(at); return xy && geoDistance(at, center) < 1.5 && Math.hypot(xy[0] - pt.x, xy[1] - pt.y) < 22; });
    if (hit) { pickCreature(hit.c); return; }
    const ll = ph.invert?.([pt.x, pt.y]);
    if (!ll || Math.hypot(pt.x - HIGH / 2, pt.y - HIGH / 2) > (HIGH / 2 - 4) * view.current.zoom) return;
    const f = countries.find((x) => geoContains(x, ll));
    stopSpin();
    if (f) { snSound('tap'); setCountry(f.properties.name); setRegion(continentOf(f.properties.name)); setLast(null); say(nice(f.properties.name)); }
    else { const o = oceanAt(ll[0], ll[1]); snSound('tap'); setCountry(null); setRegion(o); setLast(null); say(REGIONS.find((r) => r.id === o)!.label); }
  };
  const pickCreature = (c: Creature) => {
    snSound('tap'); stopSpin(); setRegion(c.region); setCountry(null);
    if (found.includes(c.id) || c.chapter === 'mine') { setLast(c.id); say(`${c.name}. ${c.story}`); }
    else { setLast(null); say(`A creature is hiding here, in a story from ${c.from}. Tap Explore to find it.`); }
  };

  const r = REGIONS.find((x) => x.id === region);
  const here = visibleCreatures().filter((c) => c.region === region).sort((a, b) => Number(STARTERS.includes(b.id)) - Number(STARTERS.includes(a.id)));
  const nextHidden = here.find((c) => !found.includes(c.id));
  const inCountry = country ? pins.filter(({ c, at }) => c.chapter !== 'mine' && countries.find((f) => f.properties.name === country && geoContains(f, at))).map((p) => p.c) : [];
  const shown = last ? byId(last) : undefined;
  const explore = () => { if (!nextHidden) return; onFind(nextHidden.id); setLast(nextHidden.id); flyTo(pinFor(nextHidden, 0)); say(`You found the ${nextHidden.name}! ${nextHidden.story}`); };

  return (
    <div className="sn-room">
      {bar({ extra: <span className="sn-chip">{found.length} of {visibleCreatures().length} creatures found</span> })}
      <div className="sn-globe2">
        <canvas ref={low} width={LOW} height={LOW} className="sn-globe2-low" aria-hidden="true" />
        <canvas ref={high} width={HIGH} height={HIGH} className="sn-globe2-high" aria-label="Globe. Drag to spin, pinch to zoom, tap a place."
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          onWheel={(e) => { setZoom(view.current.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); stopSpin(); }} />
        {!countries.length && <p className="sn-globe2-wait">Loading the world...</p>}
        <div className="sn-globe2-tools">
          <button type="button" className="sn-ib light" onClick={() => setZoom(view.current.zoom * 1.4)} aria-label="Zoom in"><Icon d="M11 5v12 M5 11h12 M19 19l-3-3" />Zoom in</button>
          <button type="button" className="sn-ib light" onClick={() => setZoom(view.current.zoom / 1.4)} aria-label="Zoom out"><Icon d="M5 11h12 M19 19l-3-3" />Zoom out</button>
          <button type="button" className="sn-ib light" onClick={() => { setZoom(1); view.current.spin = true; setSpin(true); }}><Icon d="M4 12a8 8 0 1 0 3-6 M4 4v4h4" />Fit</button>
          <button type="button" className={`sn-ib light${spin ? ' on' : ''}`} aria-pressed={spin} onClick={() => { view.current.spin = !spin; setSpin(!spin); }}><Icon d="M12 3a9 9 0 1 0 9 9 M21 3v6h-6" />{spin ? 'Stop' : 'Spin'}</button>
          <span className="sn-zoomchip">×{zoomShow.toFixed(1)}</span>
        </div>
      </div>
      <aside className="sn-globe2-side">
        <div className="sn-region-chips">
          {REGIONS.map((x) => {
            const allHere = visibleCreatures().filter((c) => c.region === x.id);
            const n = allHere.filter((c) => found.includes(c.id)).length;
            return (
              <button key={x.id} type="button" className={`sn-region2 ${x.kind}${region === x.id ? ' on' : ''}`} onClick={() => { snSound('tap'); setRegion(x.id); setCountry(null); setLast(null); flyTo(CENTER[x.id], x.kind === 'land' ? 1.6 : undefined); say(x.label); }}>
                <b>{x.label}</b><small>{x.frontier ? 'frontier' : `${n}/${allHere.length}`}</small>
              </button>
            );
          })}
        </div>
        <div className="sn-globe2-card">
          {!r && !shown && <p>Drag the globe to spin it. Pinch or use Zoom in to see countries. Tap a country, an ocean or a pin. Each ? pin is a creature still hiding!</p>}
          {country && (
            <div className="sn-country">
              <div className="sn-row between"><h2>{nice(country)}</h2><button type="button" className="sn-listen" onClick={() => say(`${nice(country)}, in ${country === 'Russia' ? 'Europe and Asia' : REGIONS.find((x) => x.id === continentOf(country))!.label}.`)} aria-label="Listen"><Icon d={LISTEN} /></button></div>
              <small>A country in {country === 'Russia' ? 'Europe and Asia' : REGIONS.find((x) => x.id === continentOf(country))!.label}</small>
              {inCountry.length > 0
                ? <div className="sn-row">{inCountry.map((c) => <button key={c.id} type="button" className="sn-mini2" onClick={() => pickCreature(c)}>{found.includes(c.id) ? <><img src={art(c.id)} alt="" />{c.name}</> : '??? hiding here'}</button>)}</div>
                : <p className="sn-small">No creature stories in this collection come from here yet.</p>}
            </div>
          )}
          {r && r.frontier && <p>{r.label}: no people lived here long ago to tell creature stories. This is your frontier: make a creature for it in the Creature Maker.</p>}
          {r && !r.frontier && (
            <div className="sn-row between">
              <b>{r.label}: {here.filter((c) => found.includes(c.id)).length} of {here.length} found</b>
              {nextHidden ? <button type="button" className="sn-btn" onClick={explore}>Explore {r.label}</button> : <span className="sn-small">All found here!</span>}
            </div>
          )}
          {shown && (
            <div className="sn-found-card">
              <div className="sn-row"><img src={art(shown.id)} alt="" className="sn-found-art" /><div><h3>{shown.name}</h3><small>say it: {shown.say} · from {shown.from}</small></div></div>
              <p>{shown.story}</p>
              {shown.ingredient && <div className="sn-row"><img src={shown.ingredient.img} alt="" className="sn-ing" /><span>Earned: {shown.ingredient.name}</span></div>}
              <div className="sn-row">
                <button type="button" className="sn-btn2 small" onClick={() => say(`${shown.name}. ${shown.story}`)}>Listen</button>
                <button type="button" className="sn-btn2 small" onClick={() => openPage(shown.id)}>Open its page</button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
