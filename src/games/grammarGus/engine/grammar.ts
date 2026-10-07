import type { Pos, Token } from './types';
import '../data/extraNouns'; // names and weird-plural nouns join the dictionary
import '../data/timeWords'; // time words and "then" are how words
import {
  adjByWord, adverbSet, CONJ_POOLS, interjectionSet, nounByWord, prepSet, reflexiveSet, subjectPronounSet, verbByBase,
} from '../data/wordbank';

// The sandbox grammar (plan section 17.4) as a small automaton over the
// parts of speech. One source of truth for:
//   - completeness: is this a whole sentence?
//   - legalNext: which parts can be inserted at a position (the Shape
//     Palette only ever offers these)
//   - the role of every token (WHO, WHAT THEY DID, ...) for the validator,
//     the checklist, the semantic frame and the director
//   - what is missing, found as the cheapest set of insertions that would
//     finish the sentence (drives the steam-leak hints, plan 3.5)
//
// Sentence  := Interj? OpenAdv? Clause ( ClauseConj OpenAdv? Clause )?
// Clause    := Subject Predicate
// Subject   := Pron | NP ( and|or NP )?
// NP        := Art Adj{0,2} Noun
// Predicate := Verb ( and|or Verb )? ( Obj | Adv? (AdvConj Adv)? PP? )
// PP        := Prep ( and|or Prep )? NP
// Words matter too: a verb that needs an object (chop, kick, mix) can only
// take the object branch, an intransitive verb (run, jump) never can, and
// each joining word only fits where its pool allows (plan section 12).

type Test = (word: string) => boolean;
interface Edge { to: number; pos?: Pos; role?: string; test?: Test }

class Builder {
  edges: Edge[][] = [];
  state() { this.edges.push([]); return this.edges.length - 1; }
  link(from: number, e: Edge) { this.edges[from].push(e); }
}
interface Frag { s: number; e: number }

const isArt: Test = (w) => w === 'a' || w === 'an' || w === 'the';
const isAdj: Test = (w) => adjByWord.has(w);
const isNoun: Test = (w) => nounByWord.has(w) && !nounByWord.get(w)!.proper;
const isName: Test = (w) => !!nounByWord.get(w)?.proper;
const isBareNoun: Test = (w) => { const n = nounByWord.get(w); return !!n && !n.proper && (!!n.plural || !!n.noA); };
// A noun that owns something (Possessive Tag Gun): the dog's, the cats', Mia's.
const possBase = (w: string) => (w.endsWith("'s") ? w.slice(0, -2) : w.endsWith("'") ? w.slice(0, -1) : null);
const isPoss: Test = (w) => { const b = possBase(w); return !!b && nounByWord.has(b); };
// Joining words that make one idea depend on the other (Because Seesaw).
// (Claudia's audit: "so" joins two whole ideas like and/but, with a comma.)
export const SUBORD = ['because', 'when', 'after', 'before', 'while', 'if'];
// Joining words for two whole ideas: they take a comma before them.
export const COORD = ['and', 'but', 'or', 'so', 'yet', 'for'];
export const OBJECT_PRONOUNS = ['me', 'him', 'her', 'us', 'them', 'you', 'it'];
const isObjPron: Test = (w) => OBJECT_PRONOUNS.includes(w);
const isSubjPron: Test = (w) => subjectPronounSet.has(w);
const isReflexive: Test = (w) => reflexiveSet.has(w);
const isAdv: Test = (w) => adverbSet.has(w);
const isPrep: Test = (w) => prepSet.has(w);
const isInterj: Test = (w) => interjectionSet.has(w) || interjectionSet.has(w.charAt(0).toUpperCase() + w.slice(1));
const inPool = (pool: readonly string[]): Test => (w) => pool.includes(w);
const verbTakes = (uses: string): Test => (w) => { const v = verbByBase.get(w); return !!v && uses.includes(v.objectUse); };

// extended: the Workboard's newer sentence shapes (Claudia's Phase 1). The
// classic machine's random sentence maker keeps the original shapes.
function build(extended: boolean) {
  const b = new Builder();
  const term = (pos: Pos, role: string, test: Test): Frag => { const s = b.state(); const e = b.state(); b.link(s, { to: e, pos, role, test }); return { s, e }; };
  const empty = (): Frag => { const s = b.state(); const e = b.state(); b.link(s, { to: e }); return { s, e }; };
  const seq = (...fs: Frag[]): Frag => { for (let i = 0; i < fs.length - 1; i++) b.link(fs[i].e, { to: fs[i + 1].s }); return { s: fs[0].s, e: fs[fs.length - 1].e }; };
  const alt = (...fs: Frag[]): Frag => { const s = b.state(); const e = b.state(); for (const f of fs) { b.link(s, { to: f.s }); b.link(f.e, { to: e }); } return { s, e }; };
  const opt = (f: Frag): Frag => alt(f, empty());

  // A name (Mia, Vermont) needs no article (Proper Name Stamp, 2026-10-07).
  const adjs = (r: string) => opt(seq(term('J', `${r}.adj`, isAdj), opt(term('J', `${r}.adj`, isAdj))));
  const np = (r: string) => alt(
    seq(term('A', `${r}.art`, isArt), adjs(r), term('N', `${r}.noun`, isNoun)),
    term('N', `${r}.noun`, isName),
    // "the dog's bone", "Mia's fuzzy hat" (Possessive Tag Gun)
    seq(opt(term('A', `${r}.art`, isArt)), adjs(r), term('N', `${r}.poss`, isPoss), adjs(r), term('N', `${r}.noun`, isNoun)),
    // More than one, or stuff you cannot count, needs no article: "Cats purr.",
    // "they want food" (Read and Respond, teacher 2026-10-07: "Cats purr because").
    ...(extended ? [seq(adjs(r), term('N', `${r}.noun`, isBareNoun))] : []),
  );
  const subject = (c: string) => alt(
    term('R', `${c}.subj.pron`, isSubjPron),
    // Two, or a list of three (Comma List Train): the cat, the dog, and the frog.
    seq(np(`${c}.subj`), opt(seq(opt(np(`${c}.subjm`)), term('C', `${c}.subj.conj`, inPool(CONJ_POOLS.subject)), np(`${c}.subj2`)))),
  );
  // After a where word: a noun, or an object pronoun ("with her", Claudia's Expansion Rig).
  const pp = (c: string) => seq(term('P', `${c}.prep`, isPrep), opt(seq(term('C', `${c}.prepconj`, inPool(CONJ_POOLS.prep)), term('P', `${c}.prep2`, isPrep))), (extended ? alt(np(`${c}.pp`), term('R', `${c}.pp.pron`, isObjPron)) : np(`${c}.pp`)));
  const mods = (c: string) => seq(opt(seq(term('D', `${c}.adv`, isAdv), opt(seq(term('C', `${c}.advconj`, inPool(CONJ_POOLS.adverb)), term('D', `${c}.adv2`, isAdv))))), opt(pp(c)));
  // Object pronouns too (Subject and Object Turnstile): the cat saw him.
  const obj = (c: string) => alt(np(`${c}.obj`), term('R', `${c}.obj.pron`, (w) => isReflexive(w) || isObjPron(w)));
  const pred = (c: string) => alt(
    seq(term('V', `${c}.verb`, verbTakes('IB')), opt(seq(term('C', `${c}.verbconj`, inPool(CONJ_POOLS.verb)), term('V', `${c}.verb2`, verbTakes('IB')))), mods(c)),
    // How and where words can come after the object too: "chased the ball quickly under the bed".
    extended ? seq(term('V', `${c}.verb`, verbTakes('TB')), obj(c), mods(c)) : seq(term('V', `${c}.verb`, verbTakes('TB')), obj(c)),
    // A linking verb and what the who is like: "is strong", "was cold and wet" (Equals Sign Machine).
    ...(extended ? [seq(term('V', `${c}.verb`, verbTakes('L')), term('J', `${c}.comp`, isAdj), opt(seq(term('C', `${c}.compconj`, inPool(CONJ_POOLS.adverb)), term('J', `${c}.comp`, isAdj))))] : []),
    seq(term('V', `${c}.verb`, verbTakes('IB')), term('C', `${c}.verbconj`, inPool(CONJ_POOLS.verb)), term('V', `${c}.verb2`, verbTakes('TB')), obj(c)),
  );
  const clause = (c: string) => seq(subject(c), pred(c));
  // A command has a hidden "you" as its who (Procedure Conveyor).
  const sentence = alt(
    seq(
      opt(term('I', 'shout', isInterj)),
      opt(term('D', 'c1.open', isAdv)),
      clause('c1'),
      opt(seq(term('C', 'clauseconj', (w) => (CONJ_POOLS.clause as readonly string[]).includes(w) || COORD.includes(w) || SUBORD.includes(w)), opt(term('D', 'c2.open', isAdv)), clause('c2'))),
    ),
    // The depending idea first, then a comma: "When the gear spins, the lamp glows." (Logic Gate)
    ...(extended ? [seq(opt(term('I', 'shout', isInterj)), term('C', 'clauseconj', inPool(SUBORD)), clause('c2'), opt(term('D', 'c1.open', (w) => w === 'then')), clause('c1'))] : []),
  );
  return { edges: b.edges, start: sentence.s, accept: sentence.e };
}

const NFA_FULL = build(true);
const NFA_CLASSIC = build(false);

// Word tiles are lower case except I and the shout words.
export const normWord = (w: string) => (w === 'I' || w === 'i' ? 'I' : interjectionSet.has(w) ? w : w.toLowerCase());

export interface Parse {
  viable: boolean; // can more parts be added to make a whole sentence?
  cost: number; // how many parts are missing (0 = structurally whole)
  roles: (string | null)[]; // role of each token on the cheapest path
  inserted: { role: string; at: number; pos: Pos }[]; // what is missing, and where
}

// Cheapest path through the automaton where a token is either consumed by
// a matching edge (cost 0) or an edge is "skipped" as a missing part
// (cost 1). 0-1 BFS over (token index, state). Empty sockets (word null)
// match any word of their part of speech.
export function parse(tokens: Token[], classic = false): Parse {
  const NFA = classic ? NFA_CLASSIC : NFA_FULL;
  const n = tokens.length;
  const S = NFA.edges.length;
  const key = (i: number, s: number) => i * S + s;
  const dist = new Int32Array((n + 1) * S).fill(-1);
  const prev = new Int32Array((n + 1) * S).fill(-1);
  const via = new Array<{ edge: Edge; kind: 'eps' | 'eat' | 'skip' } | null>((n + 1) * S).fill(null);
  const deque: number[] = [];
  let head = 0;
  // A simple 0-1 BFS: cost-0 moves go to the front, cost-1 to the back.
  const front: number[] = [];
  const startK = key(0, NFA.start);
  dist[startK] = 0; front.push(startK);
  while (front.length || head < deque.length) {
    const cur = front.length ? front.pop()! : deque[head++];
    const i = Math.floor(cur / S); const s = cur % S; const d = dist[cur];
    if (s === NFA.accept && i === n) break;
    for (const edge of NFA.edges[s]) {
      if (!edge.pos) {
        const k = key(i, edge.to);
        if (dist[k] === -1 || dist[k] > d) { dist[k] = d; prev[k] = cur; via[k] = { edge, kind: 'eps' }; front.push(k); }
        continue;
      }
      if (i < n) {
        const t = tokens[i];
        if (t.pos === edge.pos && (t.word === null || edge.test!(normWord(t.word)))) {
          const k = key(i + 1, edge.to);
          if (dist[k] === -1 || dist[k] > d) { dist[k] = d; prev[k] = cur; via[k] = { edge, kind: 'eat' }; front.push(k); }
        }
      }
      const k = key(i, edge.to);
      if (dist[k] === -1 || dist[k] > d + 1) { dist[k] = d + 1; prev[k] = cur; via[k] = { edge, kind: 'skip' }; deque.push(k); }
    }
  }
  const end = key(n, NFA.accept);
  if (dist[end] === -1) return { viable: false, cost: Infinity, roles: tokens.map(() => null), inserted: [] };
  const roles: (string | null)[] = tokens.map(() => null);
  const inserted: Parse['inserted'] = [];
  for (let k = end; k !== startK; k = prev[k]) {
    const v = via[k]!;
    const i = Math.floor(k / S);
    if (v.kind === 'eat') roles[i - 1] = v.edge.role!;
    else if (v.kind === 'skip') inserted.unshift({ role: v.edge.role!, at: i, pos: v.edge.pos! });
  }
  return { viable: true, cost: dist[end], roles, inserted };
}

export const ALL_POS: Pos[] = ['A', 'J', 'N', 'R', 'V', 'D', 'P', 'C', 'I'];

// Parts that may be inserted at `index` so the sentence can still be
// finished (the Shape Palette, plan 17.3). Words are left empty.
export function legalNext(tokens: Token[], index: number): Pos[] {
  return ALL_POS.filter((pos) => parse([...tokens.slice(0, index), { pos, word: null }, ...tokens.slice(index)]).viable);
}

export interface Completeness { clause: number; subject: boolean; predicate: boolean; ok: boolean }

// The two lamps per clause (plan 17.3): WHO or WHAT, and WHAT THEY DID.
export function completeness(tokens: Token[]): Completeness[] {
  const p = parse(tokens);
  const missing = (c: string, parts: string[]) =>
    p.inserted.some((x) => x.role.startsWith(c) && parts.some((q) => x.role.includes(q)))
    || tokens.some((t, i) => t.word === null && (p.roles[i] ?? '').startsWith(c) && parts.some((q) => (p.roles[i] ?? '').includes(q)));
  const clauses = [1];
  if (p.roles.some((r) => r?.startsWith('c2')) || p.inserted.some((x) => x.role.startsWith('c2'))) clauses.push(2);
  return clauses.map((c) => {
    const subject = p.viable && !missing(`c${c}`, ['.subj']);
    const predicate = p.viable && !missing(`c${c}`, ['.verb', '.obj', '.pp', '.prep', '.adv']);
    return { clause: c, subject, predicate, ok: subject && predicate && p.viable && p.cost === 0 && tokens.every((t) => t.word !== null) };
  });
}
