import type { Draft, EntityRef, Event, SemanticFrame, Token } from './types';
import { analyze, type Analysis, type NP } from './analyze';
import { autoFixWords, defaultEndMark, expectedForms } from './compose';
import { normWord } from './grammar';
import { tenseOfForm } from './conjugate';
import { nounByWord } from '../data/wordbank';

// The SemanticFrame (plan 5.2): who did what to whom, how and where.
// Built straight from the machine's structure, no language AI needed.

export function buildFrame(draft: Draft, a: Analysis = analyze(draft.tokens)): SemanticFrame {
  const tokens: Token[] = draft.level === 'challenge' ? draft.tokens : autoFixWords(draft.tokens, a);
  const w = (i: number) => normWord(tokens[i].word ?? '');
  let nextId = 1;
  const entity = (np: NP): EntityRef => {
    const noun = np.noun !== undefined ? w(np.noun) : 'thing';
    const art = np.art !== undefined ? w(np.art) : null;
    return {
      id: `e${nextId++}`, noun, plural: !!nounByWord.get(noun)?.plural,
      adjectives: np.adjs.map(w), article: art === 'the' ? 'the' : art ? 'a' : null,
      tokens: [np.art, ...np.adjs, np.noun].filter((x): x is number => x !== undefined),
    };
  };
  const forms = expectedForms(draft, a);
  const events: Event[] = a.clauses.map((cl) => {
    let subject: EntityRef;
    if (cl.subjPron !== undefined) {
      const pron = w(cl.subjPron) as EntityRef['pronoun'];
      subject = { id: `e${nextId++}`, noun: pron!, plural: pron === 'we' || pron === 'they', adjectives: [], article: null, pronoun: pron, tokens: [cl.subjPron] };
    } else if (cl.subj.length > 1) {
      const parts = cl.subj.map(entity);
      subject = { id: `e${nextId++}`, noun: parts.map((x) => x.noun).join('+'), plural: true, adjectives: [], article: null, conjoined: parts, joinWord: cl.subjConj !== undefined ? w(cl.subjConj) : 'and', tokens: parts.flatMap((x) => x.tokens) };
    } else subject = entity(cl.subj[0] ?? { adjs: [] });
    let object: EntityRef | undefined;
    if (cl.obj) object = entity(cl.obj);
    else if (cl.objPron !== undefined) {
      const op = w(cl.objPron).toLowerCase();
      const sp = ({ me: 'I', him: 'he', her: 'she', us: 'we', them: 'they', you: 'you', it: 'it' } as Record<string, EntityRef['pronoun']>)[op];
      object = sp ? { id: `e${nextId++}`, noun: sp, plural: sp === 'we' || sp === 'they', adjectives: [], article: null, pronoun: sp, tokens: [cl.objPron] }
        : { id: `e${nextId++}`, noun: w(cl.objPron), plural: w(cl.objPron) === 'themselves', adjectives: [], article: null, reflexive: true, tokens: [cl.objPron] };
    }
    const ppPronoun = (): EntityRef => {
      const sp = ({ me: 'I', him: 'he', her: 'she', us: 'we', them: 'they', you: 'you', it: 'it' } as Record<string, EntityRef['pronoun']>)[w(cl.ppPron!).toLowerCase()] ?? 'it';
      return { id: `e${nextId++}`, noun: sp!, plural: sp === 'we' || sp === 'they', adjectives: [], article: null, pronoun: sp, tokens: [cl.ppPron!] };
    };
    const places = cl.pp ? [{ prep: w(cl.preps[0]), preps: cl.preps.map(w), ground: entity(cl.pp) }] : cl.ppPron !== undefined ? [{ prep: w(cl.preps[0]), preps: cl.preps.map(w), ground: ppPronoun() }] : [];
    // A linking verb: what the who is like shows on the who ("The magnet is strong").
    if (cl.comps?.length) subject = { ...subject, adjectives: [...subject.adjectives, ...cl.comps.map(w)] };
    const adverbs = [...(cl.open !== undefined ? [w(cl.open)] : []), ...cl.advs.map(w)];
    const tenseAt = (i: number) => {
      const f = draft.level === 'full' ? forms.get(i) : (tokens[i].form ?? forms.get(i));
      return f ? tenseOfForm(f) : draft.tense;
    };
    const mk = (vi: number): Event => ({
      verb: w(vi), subject, adverbs, places: [], tense: tenseAt(vi), verbToken: vi,
      ...(cl.advConj !== undefined ? { adverbJoin: w(cl.advConj) } : {}),
    });
    const first = mk(cl.verbs[0] ?? -1);
    if (cl.verbs.length > 1) {
      const second = mk(cl.verbs[1]);
      second.object = object; second.places = places;
      first.join = { word: cl.verbConj !== undefined ? w(cl.verbConj) : 'and', next: second };
      // "eats and drinks at the table": both actions happen there.
      if (!object) first.places = places;
    } else { first.object = object; first.places = places; }
    return first;
  });
  const opener = a.clauses[0]?.open !== undefined ? [w(a.clauses[0].open!)] : undefined;
  return {
    ...(a.shout !== undefined ? { shout: tokens[a.shout].word ?? undefined } : {}),
    ...(opener ? { opener } : {}),
    events,
    ...(a.clauseConj !== undefined ? { clauseJoin: w(a.clauseConj) } : {}),
    punctuation: draft.level === 'full' ? defaultEndMark(a) : (draft.marks?.endMark ?? defaultEndMark(a)),
  };
}
