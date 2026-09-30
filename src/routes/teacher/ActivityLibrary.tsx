import { useState } from 'react';
import { useStore } from '../../store/store';
import QuizEditor, { validateQuizQuestions, sanitizeQuizQuestions } from './QuizEditor';
import DrillEditor from './DrillEditor';
import ImageUploadField from '../../components/ImageUploadField';
import { AvatarGlyph } from '../../components/AvatarGlyph';
import { makeId } from '../../lib/id';
import { DEFAULT_TASK_REWARD_CENTS } from '../../lib/money';
import { PART_COLORS, ORGANIZER_PRESETS } from '../../lib/sentenceOrganizers';
import { extractYouTubeId, youtubeThumbnailUrl } from '../../lib/youtube';
import type { Subject, Task, TaskType, ActivityLibraryItem, ArticleSnapshot, SentencePart, LinkChoiceContent, LinkChoiceOption } from '../../types';
import { TASK_TYPE_LABELS, TASK_TYPE_ICONS } from '../../types';

const MAX_ARTICLES_PER_TASK = 3;

// Teacher-side: paste a URL, fetch the clean article text server-side
// (Mozilla Readability strips ads/nav), and keep the result as a frozen
// snapshot. Up to 3 slots so a task can hold multiple articles for a
// student to compare in tabs.
function ArticleEditor({ articles, onChange }: { articles: ArticleSnapshot[]; onChange: (articles: ArticleSnapshot[]) => void }) {
  const [urls, setUrls] = useState<string[]>(articles.length ? articles.map((a) => a.sourceUrl) : ['']);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});

  const fetchArticle = async (i: number) => {
    const url = urls[i]?.trim();
    if (!url) return;
    setLoadingIndex(i);
    setErrors((e) => ({ ...e, [i]: '' }));
    try {
      const res = await fetch(`/api/extract-article?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not fetch that article.');
      const snapshot: ArticleSnapshot = {
        id: makeId(),
        sourceUrl: url,
        title: data.title || url,
        byline: data.byline,
        siteName: data.siteName,
        contentHtml: data.contentHtml,
        textContent: data.textContent,
        fetchedAt: new Date().toISOString(),
      };
      const next = [...articles];
      next[i] = snapshot;
      onChange(next.filter(Boolean));
    } catch (err) {
      setErrors((e) => ({ ...e, [i]: err instanceof Error ? err.message : 'Something went wrong.' }));
    } finally {
      setLoadingIndex(null);
    }
  };

  return (
    <div className="stack">
      {urls.map((url, i) => {
        const fetched = articles[i];
        return (
          <div key={i} className="content-well stack" style={{ gap: 6 }}>
            <div className="row-wrap">
              <input
                style={{ flex: 1, minWidth: 220 }}
                placeholder="https://kids.nationalgeographic.com/... or any article URL"
                value={url}
                onChange={(e) => setUrls((prev) => prev.map((u, idx) => (idx === i ? e.target.value : u)))}
              />
              <button className="btn btn-sm btn-primary" disabled={loadingIndex === i || !url.trim()} onClick={() => fetchArticle(i)}>
                {loadingIndex === i ? 'Fetching…' : fetched ? '🔄 Re-fetch' : '📥 Fetch Article'}
              </button>
              {urls.length > 1 && (
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    setUrls((prev) => prev.filter((_, idx) => idx !== i));
                    onChange(articles.filter((_, idx) => idx !== i));
                  }}
                >
                  Remove
                </button>
              )}
            </div>
            {errors[i] && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: 0 }}>⚠️ {errors[i]}</p>}
            {fetched && (
              <div className="row" style={{ gap: 8 }}>
                <span className="tag-pill" style={{ background: 'var(--success)', color: '#fff' }}>✓ Ready</span>
                <strong style={{ fontSize: '0.85rem' }}>{fetched.title}</strong>
                {fetched.siteName && <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>({fetched.siteName})</span>}
              </div>
            )}
          </div>
        );
      })}
      {urls.length < MAX_ARTICLES_PER_TASK && (
        <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setUrls((prev) => [...prev, ''])}>
          ➕ Add another article to compare
        </button>
      )}
      <p style={{ fontSize: '0.78rem', opacity: 0.7, margin: 0 }}>
        The student sees a clean, ad-free reader with adjustable text size/spacing, read-aloud, and highlighting, never the live website.
      </p>
    </div>
  );
}

const MAX_ORGANIZER_PARTS = 5;

// Teacher-side builder for a sentence-level graphic organizer: a row of
// colored blanks (and optional fixed connector words, e.g. "because")
// that the student fills in on the other end. Presets give a fast start
// for the scaffolds that actually get used with early sentence writers;
// everything stays fully editable after picking one.
function SentenceBuilderEditor({ parts, onChange }: { parts: SentencePart[]; onChange: (parts: SentencePart[]) => void }) {
  const updatePart = (id: string, patch: Partial<SentencePart>) => {
    onChange(parts.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const removePart = (id: string) => onChange(parts.filter((p) => p.id !== id));
  const addBlank = () => {
    if (parts.length >= MAX_ORGANIZER_PARTS) return;
    const color = PART_COLORS[parts.filter((p) => p.kind === 'blank').length % PART_COLORS.length].value;
    onChange([...parts, { id: makeId(), kind: 'blank', label: 'New part', color, placeholder: '' }]);
  };
  const addConnector = () => {
    if (parts.length >= MAX_ORGANIZER_PARTS) return;
    onChange([...parts, { id: makeId(), kind: 'connector', text: 'and' }]);
  };

  return (
    <div className="stack">
      <div>
        <label>Start from a preset</label>
        <div className="row-wrap">
          {ORGANIZER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className="btn btn-sm"
              title={preset.description}
              onClick={() => onChange(preset.build())}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {parts.map((part) => (
          <div key={part.id} className="content-well row-wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
            {part.kind === 'blank' ? (
              <>
                <div>
                  <label>Label</label>
                  <input
                    style={{ width: 130 }}
                    value={part.label ?? ''}
                    onChange={(e) => updatePart(part.id, { label: e.target.value })}
                    placeholder="e.g. Who?"
                  />
                </div>
                <div>
                  <label>Color</label>
                  <select value={part.color} onChange={(e) => updatePart(part.id, { color: e.target.value })}>
                    {PART_COLORS.map((c) => <option key={c.value} value={c.value}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Example text (shown faded)</label>
                  <input
                    style={{ width: 160 }}
                    value={part.placeholder ?? ''}
                    onChange={(e) => updatePart(part.id, { placeholder: e.target.value })}
                    placeholder="e.g. the dog"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label>Word bank (optional, comma-separated)</label>
                  <input
                    style={{ width: '100%' }}
                    value={(part.wordBank ?? []).join(', ')}
                    onChange={(e) =>
                      updatePart(part.id, {
                        wordBank: e.target.value.split(',').map((w) => w.trim()).filter(Boolean),
                      })
                    }
                    placeholder="e.g. dog, cat, bird"
                  />
                </div>
              </>
            ) : (
              <div>
                <label>Connecting word</label>
                <input
                  style={{ width: 160 }}
                  value={part.text ?? ''}
                  onChange={(e) => updatePart(part.id, { text: e.target.value })}
                  placeholder="e.g. because"
                />
              </div>
            )}
            <button className="btn btn-sm btn-danger" onClick={() => removePart(part.id)}>Remove</button>
          </div>
        ))}
      </div>

      {parts.length < MAX_ORGANIZER_PARTS && (
        <div className="row-wrap">
          <button className="btn btn-sm" onClick={addBlank}>➕ Add a colored blank</button>
          <button className="btn btn-sm" onClick={addConnector}>➕ Add a connecting word</button>
        </div>
      )}
      <p style={{ fontSize: '0.78rem', opacity: 0.7, margin: 0 }}>
        The student sees these in order, left to right, as colored boxes they fill in, with a live sentence preview underneath.
      </p>
    </div>
  );
}

const MIN_LINK_CHOICE_OPTIONS = 2;
const MAX_LINK_CHOICE_OPTIONS = 4;

function blankLinkChoiceOption(): LinkChoiceOption {
  return { id: makeId(), label: '', url: '' };
}

// Teacher-side builder for a "pick one" task — 2-4 links (typically
// YouTube videos) a student freely chooses between instead of a whole-
// subject choice board. A YouTube URL auto-fills a real cover thumbnail
// (no API key needed — every video has one at a fixed URL); duration is
// free-text since there's no equivalent no-key way to fetch the real one.
function LinkChoiceEditor({ content, onChange }: { content: LinkChoiceContent; onChange: (content: LinkChoiceContent) => void }) {
  const options = content.options.length > 0 ? content.options : [blankLinkChoiceOption(), blankLinkChoiceOption()];

  const updateOption = (id: string, patch: Partial<LinkChoiceOption>) => {
    onChange({ ...content, options: options.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  };
  const removeOption = (id: string) => onChange({ ...content, options: options.filter((o) => o.id !== id) });
  const addOption = () => {
    if (options.length >= MAX_LINK_CHOICE_OPTIONS) return;
    onChange({ ...content, options: [...options, blankLinkChoiceOption()] });
  };

  return (
    <div className="stack">
      <div>
        <label>Instructions shown above the options (optional)</label>
        <input
          style={{ width: '100%' }}
          placeholder="e.g. Pick the one that sounds most interesting to you!"
          value={content.prompt ?? ''}
          onChange={(e) => onChange({ ...content, prompt: e.target.value })}
        />
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {options.map((opt, i) => {
          const videoId = extractYouTubeId(opt.url);
          return (
            <div key={opt.id} className="content-well row-wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
              <div>
                <label>Option {i + 1} title</label>
                <input
                  style={{ width: 160 }}
                  value={opt.label}
                  onChange={(e) => updateOption(opt.id, { label: e.target.value })}
                  placeholder="e.g. Ocean Animals"
                />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label>Link (YouTube or any URL)</label>
                <input
                  style={{ width: '100%' }}
                  value={opt.url}
                  onChange={(e) => updateOption(opt.id, { url: e.target.value })}
                  onBlur={() => {
                    if (videoId && !opt.thumbnailUrl) updateOption(opt.id, { thumbnailUrl: youtubeThumbnailUrl(videoId) });
                  }}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                {!videoId && opt.url && (
                  <label className="row" style={{ gap: 6, fontSize: '0.72rem', marginTop: 4 }}>
                    <input type="checkbox" checked={opt.embed ?? false} onChange={(e) => updateOption(opt.id, { embed: e.target.checked })} />
                    📺 Play right here (only sites built for embedding, like Scratch's <code>/embed</code> links)
                  </label>
                )}
              </div>
              <div>
                <label>Duration (optional)</label>
                <input
                  style={{ width: 90 }}
                  value={opt.durationLabel ?? ''}
                  onChange={(e) => updateOption(opt.id, { durationLabel: e.target.value })}
                  placeholder="4:32"
                />
              </div>
              <div>
                <label>Cover image</label>
                {opt.thumbnailUrl ? (
                  <img src={opt.thumbnailUrl} alt="" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                ) : (
                  <span style={{ fontSize: '0.72rem', opacity: 0.6 }}>{videoId ? 'Auto-fills on save' : 'None (paste a YouTube link, or leave blank)'}</span>
                )}
              </div>
              {options.length > MIN_LINK_CHOICE_OPTIONS && (
                <button className="btn btn-sm btn-danger" onClick={() => removeOption(opt.id)}>Remove</button>
              )}
            </div>
          );
        })}
      </div>

      {options.length < MAX_LINK_CHOICE_OPTIONS && (
        <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addOption}>➕ Add another option</button>
      )}
      <p style={{ fontSize: '0.78rem', opacity: 0.7, margin: 0 }}>
        The student sees these as cards with the cover image and duration, and picks just one. They're never asked to do all of them.
      </p>
    </div>
  );
}

// A small tag-chip editor: type + Enter (or tap a suggestion) to add,
// tap a chip to remove. `suggestions` is normally every tag already used
// elsewhere in the library, so a teacher reuses "Baamboozle Game" instead
// of accidentally typing a slightly different spelling each time.
function TagsEditor({ tags, onChange, suggestions }: { tags: string[]; onChange: (tags: string[]) => void; suggestions: string[] }) {
  const [draft, setDraft] = useState('');
  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
    setDraft('');
  };
  const unused = suggestions.filter((s) => !tags.includes(s));

  return (
    <div className="stack" style={{ gap: 6 }}>
      <label>Tags (activity type, e.g. "YouTube Video", "Baamboozle Game")</label>
      <div className="row-wrap">
        {tags.map((t) => (
          <button key={t} className="tag-pill" style={{ cursor: 'pointer' }} onClick={() => onChange(tags.filter((x) => x !== t))} title="Tap to remove">
            {t} ✕
          </button>
        ))}
        <input
          style={{ minWidth: 160 }}
          placeholder="Type a tag, press Enter"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addTag(draft); }
          }}
        />
      </div>
      {unused.length > 0 && (
        <div className="row-wrap">
          {unused.slice(0, 10).map((s) => (
            <button key={s} className="btn btn-sm" style={{ minHeight: 32, fontSize: '0.75rem' }} onClick={() => addTag(s)}>
              ➕ {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const blankTask = (): Task => ({
  id: makeId(),
  title: '',
  icon: TASK_TYPE_ICONS.quiz,
  type: 'quiz',
  quiz: { questions: [] },
  link: { url: '' },
  offscreen: { instructions: '' },
  video: { youtubeUrl: '' },
  passage: { title: '', text: '' },
  drill: { cards: [] },
  wordchain: { startWord: '', steps: [] },
  sentenceEdit: { original: '', corrected: '' },
  sentenceBuilder: { parts: ORGANIZER_PRESETS[0].build() },
  linkChoice: { options: [] },
  customSteps: [],
  referenceLinkUrl: '',
  referenceLinkLabel: '',
  rewardCents: DEFAULT_TASK_REWARD_CENTS,
});

// Turns a library item into a fresh, independent Task snapshot — used
// anywhere an activity is copied into a plan/backlog entry so later edits
// or deletes in the library never reach back into what was already handed out.
export const activityToTaskSnapshot = (a: ActivityLibraryItem): Task => ({
  id: makeId(),
  title: a.title,
  icon: a.icon,
  type: a.type,
  quiz: a.quiz,
  link: a.link,
  offscreen: a.offscreen,
  video: a.video,
  passage: a.passage,
  drill: a.drill,
  wordchain: a.wordchain,
  sentenceEdit: a.sentenceEdit,
  customSteps: a.customSteps,
  referenceLinkUrl: a.referenceLinkUrl,
  referenceLinkLabel: a.referenceLinkLabel,
  studentTitle: a.studentTitle,
  studentDescription: a.studentDescription,
  isDaily: a.isDaily,
  rewardCents: a.rewardCents,
  reward: a.reward,
  article: a.article,
  sentenceBuilder: a.sentenceBuilder,
  linkChoice: a.linkChoice,
});

// The four types a teacher can pick when creating a brand-new activity —
// direct teacher instruction to cut the Type list down from 12 to just
// these. 'platformer' is relabeled "Native Game" here since it's the one
// existing type that's already a real native-gameplay-plus-quiz shape
// (Blooket-style), the closest match to "native games" in the ask; the
// other 8 legacy types (offscreen, passage, drill, wordchain, sentenceEdit,
// article, sentenceBuilder, linkChoice) are simply not offered for new
// activities anymore, matching how the SEL/finance Focus lanes were
// retired — existing activities/assignments of those types keep working
// exactly as before, nothing is deleted or migrated.
const CREATABLE_TASK_TYPES: TaskType[] = ['quiz', 'link', 'video', 'platformer'];
const CREATABLE_TASK_TYPE_LABELS: Partial<Record<TaskType, string>> = {
  platformer: '🎮 Native Game (in-game quiz, e.g. Platformer)',
};

export function TaskEditor({
  initial,
  subject,
  onSave,
  onCancel,
  matchExisting,
  tagsSlot,
}: {
  initial: Task;
  subject: Subject;
  onSave: (t: Task) => void;
  onCancel: () => void;
  matchExisting?: (title: string) => Task | undefined;
  // Rendered right after Title, inside this same card — direct teacher
  // ask to move Tags up next to Title instead of sitting in its own
  // section above the whole editor. Optional: the small inline edit panel
  // (updateLibraryActivity's own "Editing ..." card) still manages its
  // own tags state and passes its TagsEditor element in here.
  tagsSlot?: React.ReactNode;
}) {
  const [task, setTask] = useState<Task>(initial);
  const [matchedNotice, setMatchedNotice] = useState<string | null>(null);

  // Reward is decided at assignment time now, not here — direct teacher
  // instruction: "rewards should never be assigned during the creation of
  // activities, but rather only when an assignment is being created." See
  // RewardPicker in NewDailyPlanBuilder.tsx, the per-task control shown
  // once an activity is actually on a plan. Task.reward/rewardCents still
  // exist and are still what completeTask reads — this form just no
  // longer offers a way to set them.

  // Only a student-facing title/description live in More options now —
  // direct teacher instruction removed cover image, reference link,
  // daily/Final-Check, and the custom step-guide editor entirely from
  // this form. Their underlying fields on Task still exist and still
  // work (an activity already marked Final Check, already daily, already
  // carrying a reference link or a custom step guide keeps behaving
  // exactly as before) — there is simply no authoring UI left here to set
  // or change them going forward. Auto-open only when editing an activity
  // that already has student-facing copy set.
  const [showMore, setShowMore] = useState(Boolean(initial.studentTitle || initial.studentDescription));

  return (
    <div className="content-well stack">
      <div className="row-wrap">
        <div style={{ flex: 1, minWidth: 220 }}>
          <label>Title</label>
          <input
            style={{ width: '100%' }}
            value={task.title}
            onChange={(e) => setTask({ ...task, title: e.target.value })}
            onBlur={() => {
              if (!matchExisting) return;
              const trimmed = task.title.trim();
              if (!trimmed) return;
              const match = matchExisting(trimmed);
              if (match && match.id !== initial.id) {
                setTask({ ...match, id: task.id, title: trimmed });
                setMatchedNotice(`Filled in from your existing "${trimmed}" activity. Directions, links, and settings all matched. Change anything you need for this one.`);
              }
            }}
            placeholder="e.g. Sound Drill Review"
          />
          {matchedNotice && (
            <p style={{ fontSize: '0.78rem', color: 'var(--purple-dark)', margin: '4px 0 0' }}>↩️ {matchedNotice}</p>
          )}
        </div>
        <div>
          <label>Type</label>
          <select
            value={task.type}
            onChange={(e) => {
              const type = e.target.value as TaskType;
              setTask({ ...task, type, icon: TASK_TYPE_ICONS[type] });
            }}
          >
            {/* The current type always appears, even if it's a legacy type
                outside the 4 now offered — editing an existing activity
                must never silently show the wrong type selected. */}
            {[...new Set([...CREATABLE_TASK_TYPES, task.type])].map((t) => (
              <option key={t} value={t}>{CREATABLE_TASK_TYPE_LABELS[t] ?? TASK_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>
      {tagsSlot}

      {(task.type === 'quiz' || task.type === 'platformer') && (
        <div className="stack">
          {task.type === 'platformer' && (
            <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
              🎮 These are the questions that pop up during the game, every time the character gets hit, or every
              minute if they haven't been hit yet. Add at least one. Pull in a saved set below to reuse questions
              from a regular quiz.
            </p>
          )}
          <QuizEditor
            subject={subject}
            questions={task.quiz?.questions ?? []}
            onChange={(questions) => setTask({ ...task, quiz: { ...task.quiz, questions } })}
            simplified={task.type === 'quiz'}
          />
          {/* Shuffle question order and shuffle multiple-choice answer
              order are the fixed, silent default now (direct teacher
              instruction) — no teacher-facing toggle. See the onSave
              cleanup below, which stamps both true regardless of what
              this task's quiz content already carried. */}
        </div>
      )}

      {task.type === 'link' && (
        <div>
          <label>Link URL</label>
          <input
            style={{ width: '100%' }}
            placeholder="https://..."
            value={task.link?.url ?? ''}
            onChange={(e) => setTask({ ...task, link: { url: e.target.value, embed: task.link?.embed } })}
          />
          <label className="row" style={{ gap: 6, fontSize: '0.8rem', marginTop: 6 }}>
            <input
              type="checkbox"
              checked={task.link?.embed ?? false}
              onChange={(e) => setTask({ ...task, link: { url: task.link?.url ?? '', embed: e.target.checked } })}
            />
            📺 Play right here in the app (only works for sites built for it, like Scratch's{' '}
            <code>/embed</code> project links, most sites block this and will show a blank box)
          </label>
        </div>
      )}

      {task.type === 'article' && (
        <ArticleEditor
          articles={task.article?.articles ?? []}
          onChange={(articles) => setTask({ ...task, article: { articles } })}
        />
      )}

      {task.type === 'sentenceBuilder' && (
        <SentenceBuilderEditor
          parts={task.sentenceBuilder?.parts ?? ORGANIZER_PRESETS[0].build()}
          onChange={(parts) => setTask({ ...task, sentenceBuilder: { parts } })}
        />
      )}

      {task.type === 'linkChoice' && (
        <LinkChoiceEditor
          content={task.linkChoice ?? { options: [] }}
          onChange={(linkChoice) => setTask({ ...task, linkChoice })}
        />
      )}

      {task.type === 'offscreen' && (
        <div className="stack">
          <div>
            <label>Instructions for the student</label>
            <textarea
              style={{ width: '100%' }}
              rows={3}
              value={task.offscreen?.instructions ?? ''}
              onChange={(e) => setTask({ ...task, offscreen: { ...task.offscreen, instructions: e.target.value } })}
              placeholder="What should the student do?"
            />
          </div>
          <label>
            <input
              type="checkbox"
              checked={task.offscreen?.photoRequired ?? false}
              onChange={(e) => setTask({ ...task, offscreen: { instructions: task.offscreen?.instructions ?? '', photoRequired: e.target.checked } })}
              style={{ marginRight: 6 }}
            />
            📸 Require a photo of their work before they can check this off
          </label>
        </div>
      )}

      {task.type === 'video' && (
        <div className="stack">
          <div>
            <label>YouTube URL</label>
            <input
              style={{ width: '100%' }}
              placeholder="https://www.youtube.com/watch?v=..."
              value={task.video?.youtubeUrl ?? ''}
              onChange={(e) => setTask({ ...task, video: { ...task.video, youtubeUrl: e.target.value } })}
            />
          </div>
          <div>
            <label>Note for the student (optional)</label>
            <input
              style={{ width: '100%' }}
              value={task.video?.note ?? ''}
              onChange={(e) => setTask({ ...task, video: { youtubeUrl: task.video?.youtubeUrl ?? '', note: e.target.value } })}
            />
          </div>
        </div>
      )}

      {task.type === 'passage' && (
        <div className="stack">
          <div>
            <label>Passage title</label>
            <input
              style={{ width: '100%' }}
              value={task.passage?.title ?? ''}
              onChange={(e) => setTask({ ...task, passage: { ...task.passage!, title: e.target.value } })}
            />
          </div>
          <div>
            <label>Passage text</label>
            <textarea
              style={{ width: '100%' }}
              rows={6}
              value={task.passage?.text ?? ''}
              onChange={(e) => setTask({ ...task, passage: { ...task.passage!, text: e.target.value } })}
            />
          </div>
          <ImageUploadField
            label="Image (optional)"
            value={task.passage?.imageUrl}
            onChange={(imageUrl) => setTask({ ...task, passage: { ...task.passage!, imageUrl: imageUrl || undefined } })}
          />
          <hr className="divider" />
          <strong>Comprehension questions (optional)</strong>
          <QuizEditor
            subject={subject}
            questions={task.quiz?.questions ?? []}
            onChange={(questions) => setTask({ ...task, quiz: { ...task.quiz, questions } })}
          />
          <div className="row-wrap">
            <label className="row" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={task.quiz?.shuffleQuestions ?? true}
                onChange={(e) =>
                  setTask({ ...task, quiz: { questions: task.quiz?.questions ?? [], shuffleAnswers: task.quiz?.shuffleAnswers, shuffleQuestions: e.target.checked } })
                }
              />
              🔀 Shuffle question order each time
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={task.quiz?.shuffleAnswers ?? false}
                onChange={(e) =>
                  setTask({ ...task, quiz: { questions: task.quiz?.questions ?? [], shuffleQuestions: task.quiz?.shuffleQuestions, shuffleAnswers: e.target.checked } })
                }
              />
              🔀 Shuffle multiple-choice answer order
            </label>
          </div>
        </div>
      )}

      {task.type === 'drill' && (
        <DrillEditor
          subject={subject}
          cards={task.drill?.cards ?? []}
          onChange={(cards) => setTask({ ...task, drill: { cards } })}
        />
      )}

      {task.type === 'wordchain' && (
        <div className="stack">
          <div>
            <label>Starting word</label>
            <input value={task.wordchain?.startWord ?? ''} onChange={(e) => setTask({ ...task, wordchain: { startWord: e.target.value, steps: task.wordchain?.steps ?? [] } })} />
          </div>
          <label>Chain steps</label>
          {(task.wordchain?.steps ?? []).map((step, i) => (
            <div key={step.id} className="content-well row-wrap">
              <div>
                <label>Clue</label>
                <input
                  value={step.hint}
                  placeholder="e.g. Change one letter to mean 'a place to sleep'"
                  onChange={(e) => {
                    const steps = [...(task.wordchain?.steps ?? [])];
                    steps[i] = { ...steps[i], hint: e.target.value };
                    setTask({ ...task, wordchain: { startWord: task.wordchain?.startWord ?? '', steps } });
                  }}
                  style={{ minWidth: 260 }}
                />
              </div>
              <div>
                <label>Answer word</label>
                <input
                  value={step.answer}
                  onChange={(e) => {
                    const steps = [...(task.wordchain?.steps ?? [])];
                    steps[i] = { ...steps[i], answer: e.target.value };
                    setTask({ ...task, wordchain: { startWord: task.wordchain?.startWord ?? '', steps } });
                  }}
                />
              </div>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  const steps = (task.wordchain?.steps ?? []).filter((_, idx) => idx !== i);
                  setTask({ ...task, wordchain: { startWord: task.wordchain?.startWord ?? '', steps } });
                }}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              const steps = [...(task.wordchain?.steps ?? []), { id: makeId(), hint: '', answer: '' }];
              setTask({ ...task, wordchain: { startWord: task.wordchain?.startWord ?? '', steps } });
            }}
          >
            ➕ Add step
          </button>
        </div>
      )}

      {task.type === 'sentenceEdit' && (
        <div className="stack">
          <div>
            <label>Original (flawed) sentence</label>
            <input
              style={{ width: '100%' }}
              value={task.sentenceEdit?.original ?? ''}
              onChange={(e) => setTask({ ...task, sentenceEdit: { original: e.target.value, corrected: task.sentenceEdit?.corrected ?? '' } })}
            />
          </div>
          <div>
            <label>Corrected sentence (exact answer)</label>
            <input
              style={{ width: '100%' }}
              value={task.sentenceEdit?.corrected ?? ''}
              onChange={(e) => setTask({ ...task, sentenceEdit: { original: task.sentenceEdit?.original ?? '', corrected: e.target.value, hint: task.sentenceEdit?.hint } })}
            />
          </div>
          <div>
            <label>Hint (optional, shown after a couple tries)</label>
            <input
              style={{ width: '100%' }}
              value={task.sentenceEdit?.hint ?? ''}
              onChange={(e) => setTask({ ...task, sentenceEdit: { original: task.sentenceEdit?.original ?? '', corrected: task.sentenceEdit?.corrected ?? '', hint: e.target.value } })}
            />
          </div>
        </div>
      )}


      <details className="task-editor-more" open={showMore} onToggle={(e) => setShowMore((e.target as HTMLDetailsElement).open)}>
        <summary>More options — student-facing title &amp; description</summary>
        <div className="stack" style={{ paddingTop: 12 }}>
          <div>
            <label>Student-facing title (optional, shown to the student instead of the title above)</label>
            <input
              style={{ width: '100%' }}
              value={task.studentTitle ?? ''}
              onChange={(e) => setTask({ ...task, studentTitle: e.target.value })}
              placeholder="e.g. Let's practice our sounds!"
            />
          </div>
          <div>
            <label>Student-facing description (optional)</label>
            <textarea
              style={{ width: '100%' }}
              rows={2}
              value={task.studentDescription ?? ''}
              onChange={(e) => setTask({ ...task, studentDescription: e.target.value })}
              placeholder="A sentence or two telling the student what this activity is."
            />
          </div>
        </div>
      </details>

      {(() => {
        const quizIssues = (task.type === 'quiz' || task.type === 'passage' || task.type === 'platformer') ? validateQuizQuestions(task.quiz?.questions ?? []) : [];
        if (task.type === 'platformer' && (task.quiz?.questions ?? []).length === 0) {
          quizIssues.unshift('Add at least one question, that\'s what pops up during the game.');
        }
        return (
          <div className="stack">
            {quizIssues.length > 0 && (
              <div className="content-well" style={{ background: '#fdecea', color: 'var(--danger)' }}>
                <strong style={{ fontSize: '0.85rem' }}>⚠️ Fix before saving:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: '0.8rem' }}>
                  {quizIssues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </div>
            )}
            <div className="row">
              <button
                className="btn btn-primary"
                disabled={!task.title.trim() || quizIssues.length > 0}
                onClick={() => {
                  // Shuffle question order and shuffle multiple-choice
                  // answer order are the fixed, silent default now (no
                  // teacher-facing toggle) — stamped true here regardless
                  // of what this quiz's content already carried.
                  const cleaned = task.quiz
                    ? { ...task, quiz: { ...task.quiz, questions: sanitizeQuizQuestions(task.quiz.questions), shuffleQuestions: true, shuffleAnswers: true } }
                    : task;
                  onSave(cleaned);
                }}
              >
                💾 Save Activity
              </button>
              <button className="btn" onClick={onCancel}>Cancel</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Just the "make a brand-new activity" form — its own standalone, full-width section.
// When `subject` is omitted, a small inline picker lets the teacher choose
// it per activity instead of the whole page being locked to one subject.
export function CreateActivityForm({ subject }: { subject?: Subject }) {
  const activityLibrary = useStore((s) => s.activityLibrary);
  const addLibraryActivity = useStore((s) => s.addLibraryActivity);
  const [creating, setCreating] = useState(false);
  const [pickedSubject, setPickedSubject] = useState<Subject>(subject ?? 'math');
  const [tags, setTags] = useState<string[]>([]);
  const effectiveSubject = subject ?? pickedSubject;

  const allForSubject = activityLibrary.filter((a) => a.subject === effectiveSubject);
  const allTags = [...new Set(activityLibrary.flatMap((a) => a.tags ?? []))].sort();

  return (
    <div className="zone zone-create stack">
      <div className="zone-header-bar">Create an Activity</div>
      <div style={{ padding: 14 }} className="stack">
        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
          {subject
            ? `Build a ${subject === 'math' ? 'Math' : 'Literacy'} activity here. It lands in the Activity Library for every student.`
            : 'Build an activity here. It lands in the Activity Library for every student.'}
          {' '}Typing a title that matches an existing activity auto-fills the rest for you.
        </p>
        {!subject && creating && (
          <div className="subject-tabs">
            <button className={`subject-tab-btn tab-math ${pickedSubject === 'math' ? 'active' : ''}`} onClick={() => setPickedSubject('math')}>🔢 Math</button>
            <button className={`subject-tab-btn tab-literacy ${pickedSubject === 'literacy' ? 'active' : ''}`} onClick={() => setPickedSubject('literacy')}>📚 Literacy</button>
          </div>
        )}
        {!creating && <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => setCreating(true)}>➕ New Activity</button>}
        {creating && (
          <>
            <TaskEditor
              initial={blankTask()}
              subject={effectiveSubject}
              matchExisting={(title) => allForSubject.find((a) => a.title.trim().toLowerCase() === title.toLowerCase())}
              tagsSlot={<TagsEditor tags={tags} onChange={setTags} suggestions={allTags} />}
              onSave={(t) => {
                addLibraryActivity({ ...t, subject: effectiveSubject, tags });
                setTags([]);
                setCreating(false);
              }}
              onCancel={() => {
                setTags([]);
                setCreating(false);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

// The searchable grid of existing activities — browse, edit, delete,
// toggle daily, and add to any student(s)' plan (or, when onAddActivity is
// given, to the in-progress plan builder as well — that's the default/top
// choice there, students are the secondary option below it).
export function ActivityLibraryBrowse({
  subject,
  tasks,
  defaultStudentId,
  onAddActivity,
  compact,
}: {
  subject?: Subject; // omit to browse every subject at once
  tasks?: Task[];
  defaultStudentId?: string;
  onAddActivity?: (activityId: string) => void;
  compact?: boolean;
}) {
  const students = useStore((s) => s.students);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const updateLibraryActivity = useStore((s) => s.updateLibraryActivity);
  const deleteLibraryActivity = useStore((s) => s.deleteLibraryActivity);
  const addActivityToPlanForStudents = useStore((s) => s.addActivityToPlanForStudents);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [activeTypeFilters, setActiveTypeFilters] = useState<TaskType[]>([]);
  const [addTargetId, setAddTargetId] = useState<string | null>(null);
  const [addToIds, setAddToIds] = useState<string[]>([]);

  const allForSubject = subject ? activityLibrary.filter((a) => a.subject === subject) : activityLibrary;
  const allTags = [...new Set(allForSubject.flatMap((a) => a.tags ?? []))].sort();
  // Only offer type filter chips for types actually present, so an empty
  // library or one that only ever uses 2-3 types doesn't show a dozen
  // filters for nothing — direct teacher ask: filter by activity type.
  const allTypes = [...new Set(allForSubject.map((a) => a.type))] as TaskType[];
  const searchLower = search.trim().toLowerCase();
  const activities = allForSubject.filter((a) => {
    const matchesSearch = !searchLower || a.title.toLowerCase().includes(searchLower) || (a.tags ?? []).some((t) => t.toLowerCase().includes(searchLower));
    const matchesTags = activeTagFilters.length === 0 || activeTagFilters.every((t) => (a.tags ?? []).includes(t));
    const matchesType = activeTypeFilters.length === 0 || activeTypeFilters.includes(a.type);
    return matchesSearch && matchesTags && matchesType;
  });
  const editingActivity = activities.find((a) => a.id === editingId);
  const titlesOnTodaysPlan = new Set((tasks ?? []).map((t) => t.title.trim().toLowerCase()));

  const toggleAddTarget = (id: string) =>
    setAddToIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <div className="zone zone-library stack">
      <div className="zone-header-bar">Activity Library — build it once, use it everywhere</div>
      <div style={{ padding: 14 }} className="stack">
        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
          Tap "Add" to send a card into a plan (or drag it, on a larger screen). ⭐ marks daily activities, set from Edit.
        </p>
        <input
          placeholder={subject ? "🔍 Search this subject's activities…" : '🔍 Search activities…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%' }}
        />
        {allTypes.length > 1 && (
          <div className="row-wrap" style={{ gap: 4 }}>
            <span style={{ fontSize: '0.78rem', opacity: 0.7, alignSelf: 'center' }}>Type:</span>
            {allTypes.map((t) => (
              <button
                key={t}
                className={`btn btn-sm ${activeTypeFilters.includes(t) ? 'btn-primary' : ''}`}
                style={{ minHeight: 32, fontSize: '0.75rem' }}
                onClick={() => setActiveTypeFilters((f) => (f.includes(t) ? f.filter((x) => x !== t) : [...f, t]))}
                title={TASK_TYPE_LABELS[t]}
              >
                {TASK_TYPE_ICONS[t]} {TASK_TYPE_LABELS[t].split(' (')[0]}
              </button>
            ))}
            {activeTypeFilters.length > 0 && (
              <button className="btn btn-sm" style={{ minHeight: 32, fontSize: '0.75rem' }} onClick={() => setActiveTypeFilters([])}>
                ✕ Clear
              </button>
            )}
          </div>
        )}
        {allTags.length > 0 && (
          <div className="row-wrap" style={{ gap: 4 }}>
            <span style={{ fontSize: '0.78rem', opacity: 0.7, alignSelf: 'center' }}>Tag:</span>
            {allTags.map((t) => (
              <button
                key={t}
                className={`btn btn-sm ${activeTagFilters.includes(t) ? 'btn-primary' : ''}`}
                style={{ minHeight: 32, fontSize: '0.75rem' }}
                onClick={() => setActiveTagFilters((f) => (f.includes(t) ? f.filter((x) => x !== t) : [...f, t]))}
              >
                🏷️ {t}
              </button>
            ))}
            {activeTagFilters.length > 0 && (
              <button className="btn btn-sm" style={{ minHeight: 32, fontSize: '0.75rem' }} onClick={() => setActiveTagFilters([])}>
                ✕ Clear
              </button>
            )}
          </div>
        )}

        {editingActivity && (
          <div className="content-well stack" style={{ background: '#faf9ff' }}>
            <div className="space-between">
              <strong>Editing "{editingActivity.title || '(untitled)'}"</strong>
              <button className="btn btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
            </div>
            <TaskEditor
              initial={editingActivity}
              subject={editingActivity.subject}
              matchExisting={(title) => allForSubject.find((x) => x.title.trim().toLowerCase() === title.toLowerCase())}
              tagsSlot={<TagsEditor tags={editingTags} onChange={setEditingTags} suggestions={allTags} />}
              onSave={(t) => {
                updateLibraryActivity(editingActivity.id, { ...t, tags: editingTags });
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
            />
          </div>
        )}

        {activities.length === 0 ? (
          <p style={{ opacity: 0.7 }}>{search ? 'No activities match your search.' : 'No activities in the library yet.'}</p>
        ) : (
          <div className={`library-card-grid ${compact ? 'library-card-grid-compact' : ''}`}>
            {activities.map((a) => {
              const onTodaysPlan = titlesOnTodaysPlan.has(a.title.trim().toLowerCase());
              return (
                <div
                  key={a.id}
                  className={`library-card ${compact ? 'library-card-compact' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', a.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                >
                  <div className="library-card-thumb">
                    <span>{a.icon}</span>
                    <span className="library-card-type-badge" title={TASK_TYPE_LABELS[a.type]}>{TASK_TYPE_ICONS[a.type]}</span>
                  </div>
                  <div className="library-card-body">
                        <div className="row-wrap" style={{ gap: 4 }}>
                          {!subject && <span className="tag-pill">{a.subject === 'math' ? '🔢 Math' : '📚 Literacy'}</span>}
                          {a.isDaily && <span className="badge-pill badge-daily">⭐ Daily</span>}
                          {onTodaysPlan && <span className="badge-pill badge-onplan">📌 On today's plan</span>}
                        </div>
                        <div className="set-card-title">{a.title || '(untitled)'}</div>
                        {!compact && <div className="set-card-meta">{TASK_TYPE_LABELS[a.type]}</div>}
                        {!compact && (a.tags?.length ?? 0) > 0 && (
                          <div className="row-wrap" style={{ gap: 3 }}>
                            {a.tags!.map((t) => (
                              <span key={t} className="tag-pill" style={{ fontSize: '0.62rem', padding: '2px 8px' }}>🏷️ {t}</span>
                            ))}
                          </div>
                        )}

                        {addTargetId === a.id ? (
                          <div className="content-well stack" style={{ background: '#faf9ff' }}>
                            <strong style={{ fontSize: '0.8rem' }}>Add to a student's live plan:</strong>
                            <div className="row-wrap">
                              {students.map((st) => (
                                <label key={st.id} className="row" style={{ gap: 4, fontWeight: 700, fontSize: '0.85rem' }}>
                                  <input type="checkbox" checked={addToIds.includes(st.id)} onChange={() => toggleAddTarget(st.id)} />
                                  <AvatarGlyph value={st.avatar} size={18} /> {st.name}
                                </label>
                              ))}
                            </div>
                            <div className="row-wrap">
                              <button
                                className="btn btn-sm btn-success"
                                disabled={addToIds.length === 0}
                                onClick={() => {
                                  addActivityToPlanForStudents(addToIds, a.subject, a.id);
                                  setAddTargetId(null);
                                }}
                              >
                                Add
                              </button>
                              <button className="btn btn-sm" onClick={() => setAddTargetId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className={compact ? 'library-card-actions-compact' : 'row-wrap'}>
                            {/* Daily status shows as the badge above
                                already — editing it lives in Edit now, not
                                as a duplicate toggle button here. */}
                            <button
                              className="btn btn-sm"
                              onClick={() => { setEditingId(a.id); setEditingTags(a.tags ?? []); }}
                              title="Edit"
                            >
                              {compact ? '✏️' : 'Edit'}
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => deleteLibraryActivity(a.id)} title="Delete">
                              {compact ? '🗑️' : 'Delete'}
                            </button>
                            <button
                              className="btn btn-sm btn-success library-card-add-btn"
                              onClick={() => {
                                if (onAddActivity) {
                                  onAddActivity(a.id);
                                  return;
                                }
                                setAddTargetId(a.id);
                                setAddToIds(defaultStudentId ? [defaultStudentId] : []);
                              }}
                            >
                              Add
                            </button>
                          </div>
                        )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Convenience wrapper: create-form + browse grid stacked together, for
// pages that show one subject at a time in a single column.
export function ActivityLibraryPanel({
  subject,
  tasks,
  defaultStudentId,
}: {
  subject: Subject;
  tasks?: Task[];
  defaultStudentId?: string;
}) {
  return (
    <div className="stack">
      <CreateActivityForm subject={subject} />
      <ActivityLibraryBrowse subject={subject} tasks={tasks} defaultStudentId={defaultStudentId} />
    </div>
  );
}
