import type { Draft, RubricResult, RubricSettings, SemanticFrame } from './types';
import { DEFAULT_RUBRIC_SETTINGS } from './types';
import { validateSentence, type Validation } from './validate';
import { compose, type Composed } from './compose';
import { buildFrame } from './semantic';
import { evaluate } from './rubric';
import { resolveCast, type CastMember, type Resolution } from '../director/cast';
import { direct, type SceneScript } from '../director/director';

// Build -> checklist gate -> frame -> cast -> rubric (plan 3.18 diagram).
export interface Run {
  validation: Validation; composed: Composed;
  frame?: SemanticFrame; resolution?: Resolution; rubric?: RubricResult; script?: SceneScript | null;
}

export function runSentence(draft: Draft, castBefore: CastMember[] = [], sentenceId = 's1', settings: RubricSettings = DEFAULT_RUBRIC_SETTINGS): Run {
  const validation = validateSentence(draft);
  const composed = compose(draft);
  if (!validation.ok) return { validation, composed };
  const frame = buildFrame(draft, validation.analysis);
  const resolution = resolveCast(frame, castBefore, sentenceId);
  const rubric = evaluate(draft, frame, resolution, settings);
  const script = direct(frame, resolution, rubric, { sentenceId, caption: composed.text });
  return { validation, composed, frame, resolution, rubric, script };
}
