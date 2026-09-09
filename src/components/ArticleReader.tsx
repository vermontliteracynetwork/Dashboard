import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { makeId } from '../lib/id';
import type { ArticleTaskContent, Highlight, TTSSettings } from '../types';

interface Props {
  studentId: string;
  taskId: string;
  content: ArticleTaskContent;
  ttsSettings?: TTSSettings;
  onDone: () => void;
}

// One color per open tab, so highlights from different articles are always
// visually distinguishable when a student is comparing more than one.
const TAB_COLORS = ['#fff59d', '#a5d8ff', '#b2f2bb'];
const FONT_SIZES = [16, 19, 23, 27];
const LINE_HEIGHTS = [1.5, 1.9, 2.3];

// Walks all text nodes under `root` in document order, summing lengths,
// to turn a DOM (node, offset) pair from a Selection into a single
// character offset into the plain text the container renders — this only
// works because the container's rendered text nodes are guaranteed to
// concatenate to exactly the article's textContent (see renderSegments).
function textOffsetWithin(root: Node, targetNode: Node, targetOffset: number): number {
  let offset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node === targetNode) return offset + targetOffset;
    offset += node.textContent?.length ?? 0;
  }
  return offset;
}

function renderSegments(text: string, highlights: Highlight[], onClick: (h: Highlight) => void) {
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((h) => {
    if (h.start < cursor || h.end > text.length) return; // skip anything stale/overlapping
    if (h.start > cursor) nodes.push(<span key={`p-${cursor}`}>{text.slice(cursor, h.start)}</span>);
    nodes.push(
      <mark
        key={h.id}
        onClick={() => onClick(h)}
        style={{ background: h.color, cursor: 'pointer', borderRadius: 3, padding: '0 1px' }}
        title={h.note ? h.note : 'Tap to add a note or remove this highlight'}
      >
        {text.slice(h.start, h.end)}
        {h.note && <sup style={{ fontSize: '0.65em' }}> 💬</sup>}
      </mark>,
    );
    cursor = h.end;
  });
  if (cursor < text.length) nodes.push(<span key={`p-${cursor}`}>{text.slice(cursor)}</span>);
  return nodes;
}

export default function ArticleReader({ studentId, taskId, content, ttsSettings, onDone }: Props) {
  const articleAnnotations = useStore((s) => s.articleAnnotations);
  const addHighlight = useStore((s) => s.addHighlight);
  const removeHighlight = useStore((s) => s.removeHighlight);
  const setHighlightNote = useStore((s) => s.setHighlightNote);

  const [tab, setTab] = useState(0);
  const [fontStep, setFontStep] = useState(1);
  const [lineStep, setLineStep] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [selectionBtn, setSelectionBtn] = useState<{ top: number; left: number; start: number; end: number } | null>(null);
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  const article = content.articles[tab];
  const key = `${studentId}:${taskId}:${tab}`;
  const highlights = articleAnnotations[key]?.highlights ?? [];
  const tabColor = TAB_COLORS[tab % TAB_COLORS.length];

  useEffect(() => {
    setSelectionBtn(null);
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, [tab]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  if (!article) return <p style={{ opacity: 0.7 }}>No article has been added to this activity yet.</p>;

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !contentRef.current) {
      setSelectionBtn(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!contentRef.current.contains(range.commonAncestorContainer)) return;
    const start = textOffsetWithin(contentRef.current, range.startContainer, range.startOffset);
    const end = textOffsetWithin(contentRef.current, range.endContainer, range.endOffset);
    if (end <= start) return;
    const overlaps = highlights.some((h) => start < h.end && end > h.start);
    if (overlaps) {
      setSelectionBtn(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const containerRect = contentRef.current.getBoundingClientRect();
    setSelectionBtn({ top: rect.top - containerRect.top - 40, left: rect.left - containerRect.left, start, end });
  };

  const confirmHighlight = () => {
    if (!selectionBtn) return;
    const h: Highlight = { id: makeId(), start: selectionBtn.start, end: selectionBtn.end, color: tabColor };
    addHighlight(studentId, taskId, tab, h);
    setSelectionBtn(null);
    window.getSelection()?.removeAllRanges();
  };

  const toggleReadAloud = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(article.textContent);
    utter.rate = ttsSettings?.rate ?? 1;
    utter.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      {content.articles.length > 1 && (
        <div className="row-wrap">
          {content.articles.map((a, i) => (
            <button
              key={a.id}
              className={`btn btn-sm ${i === tab ? 'btn-primary' : ''}`}
              style={{ minHeight: 44, borderBottom: `4px solid ${TAB_COLORS[i % TAB_COLORS.length]}` }}
              onClick={() => setTab(i)}
            >
              {a.title.length > 26 ? a.title.slice(0, 26) + '…' : a.title}
            </button>
          ))}
        </div>
      )}

      <div className="row-wrap" style={{ gap: 8 }}>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} disabled={fontStep === 0} onClick={() => setFontStep((s) => Math.max(0, s - 1))} aria-label="Smaller text">
            A-
          </button>
          <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} disabled={fontStep === FONT_SIZES.length - 1} onClick={() => setFontStep((s) => Math.min(FONT_SIZES.length - 1, s + 1))} aria-label="Bigger text">
            A+
          </button>
        </div>
        <button
          className="btn btn-sm"
          style={{ minHeight: 44 }}
          onClick={() => setLineStep((s) => (s + 1) % LINE_HEIGHTS.length)}
          aria-label="Change line spacing"
        >
          ↕️ Spacing
        </button>
        <button className="btn btn-sm btn-blue" style={{ minHeight: 44 }} onClick={toggleReadAloud} aria-label="Read aloud">
          {speaking ? '⏸ Stop' : '🔈 Read Aloud'}
        </button>
        <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setShowNotes(true)} aria-label="My notes">
          💬 Notes {highlights.filter((h) => h.note).length > 0 && `(${highlights.filter((h) => h.note).length})`}
        </button>
        {article.sourceUrl && (
          <a className="btn btn-sm" style={{ minHeight: 44 }} href={article.sourceUrl} target="_blank" rel="noopener noreferrer">
            🔗 Original site
          </a>
        )}
      </div>

      <div className="content-well stack" style={{ gap: 4 }}>
        <h3 style={{ margin: 0 }}>{article.title}</h3>
        {(article.byline || article.siteName) && (
          <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0 }}>
            {article.byline ? `${article.byline} — ` : ''}
            {article.siteName ?? ''}
          </p>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        {selectionBtn && (
          <button
            className="btn btn-sm btn-primary"
            style={{ position: 'absolute', top: Math.max(0, selectionBtn.top), left: selectionBtn.left, zIndex: 5, minHeight: 44 }}
            onClick={confirmHighlight}
          >
            🖍️ Highlight
          </button>
        )}
        <div
          ref={contentRef}
          className="content-well"
          onMouseUp={handleMouseUp}
          style={{
            fontSize: FONT_SIZES[fontStep],
            lineHeight: LINE_HEIGHTS[lineStep],
            whiteSpace: 'pre-wrap',
            userSelect: 'text',
          }}
        >
          {renderSegments(article.textContent, highlights, (h) => {
            setEditingHighlight(h);
            setNoteDraft(h.note ?? '');
          })}
        </div>
      </div>

      <button className="btn btn-primary btn-lg" style={{ minHeight: 44, alignSelf: 'center' }} onClick={() => onDone()}>
        ✅ I'm done reading
      </button>

      {editingHighlight && (
        <div className="overlay-backdrop" onClick={() => setEditingHighlight(null)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <h3 style={{ margin: 0 }}>📝 Note</h3>
              <textarea
                rows={3}
                style={{ width: '100%' }}
                placeholder="What do you want to remember about this part?"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              <div className="row-wrap">
                <button
                  className="btn btn-sm btn-primary"
                  style={{ minHeight: 44 }}
                  onClick={() => {
                    setHighlightNote(studentId, taskId, tab, editingHighlight.id, noteDraft.trim());
                    setEditingHighlight(null);
                  }}
                >
                  Save Note
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  style={{ minHeight: 44 }}
                  onClick={() => {
                    removeHighlight(studentId, taskId, tab, editingHighlight.id);
                    setEditingHighlight(null);
                  }}
                >
                  Remove Highlight
                </button>
                <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setEditingHighlight(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNotes && (
        <div className="overlay-backdrop" onClick={() => setShowNotes(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <h3 style={{ margin: 0 }}>💬 My Notes — {article.title}</h3>
              {highlights.length === 0 ? (
                <p style={{ opacity: 0.7 }}>Select some text in the article and tap 🖍️ Highlight to start taking notes!</p>
              ) : (
                <div className="stack" style={{ gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                  {highlights
                    .sort((a, b) => a.start - b.start)
                    .map((h) => (
                      <div key={h.id} className="content-well" style={{ borderLeft: `6px solid ${h.color}` }}>
                        <p style={{ margin: 0, fontStyle: 'italic', fontSize: '0.85rem' }}>"{article.textContent.slice(h.start, h.end)}"</p>
                        {h.note && <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>💬 {h.note}</p>}
                      </div>
                    ))}
                </div>
              )}
              <button className="btn btn-sm" style={{ minHeight: 44, alignSelf: 'center' }} onClick={() => setShowNotes(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
