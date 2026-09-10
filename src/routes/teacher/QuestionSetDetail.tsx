import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store/store';
import ImageUploadField from '../../components/ImageUploadField';
import TeacherNav from '../../components/TeacherNav';
import QuizEditor from './QuizEditor';
import DrillEditor from './DrillEditor';

// Full-page editor for one saved question/drill set, opened by clicking
// its button on the Activities tab's Question Sets list. Editing here
// only changes the saved set, not any activity that already copied its
// questions in (same "copy, not a live link" rule as everywhere else).
export default function QuestionSetDetail() {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();
  const questionSets = useStore((s) => s.questionSets);
  const updateQuestionSet = useStore((s) => s.updateQuestionSet);
  const duplicateQuestionSet = useStore((s) => s.duplicateQuestionSet);
  const deleteQuestionSet = useStore((s) => s.deleteQuestionSet);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = questionSets.find((qs) => qs.id === setId);

  if (!set) {
    return (
      <div className="app-shell">
        <TeacherNav />
        <div className="container stack">
          <p>That question set couldn't be found — it may have been deleted.</p>
          <Link className="btn btn-sm" to="/teacher/activities">← Back to Activities</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <Link className="btn btn-sm" to="/teacher/activities">← Back to Activities</Link>

        <div className="space-between">
          <div>
            <span className="tag-pill">{set.subject === 'math' ? '🔢 Math' : '📚 Literacy'}</span>
            <h1 style={{ margin: '6px 0 0' }}>{set.name}</h1>
          </div>
          <div className="row-wrap">
            <button
              className="btn btn-sm"
              onClick={() => {
                const newId = duplicateQuestionSet(set.id);
                if (newId) navigate(`/teacher/question-sets/${newId}`);
              }}
            >
              📄 Duplicate
            </button>
            {confirmDelete ? (
              <>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    deleteQuestionSet(set.id);
                    navigate('/teacher/activities');
                  }}
                >
                  Confirm delete
                </button>
                <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </>
            ) : (
              <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>🗑️ Delete</button>
            )}
          </div>
        </div>

        <div className="content-well stack">
          <strong>Set name</strong>
          <input
            className="input"
            value={set.name}
            onChange={(e) => updateQuestionSet(set.id, { name: e.target.value })}
          />
        </div>

        <div className="content-well stack">
          <strong>Cover image</strong>
          <ImageUploadField
            label="Cover image"
            value={set.coverImageUrl}
            onChange={(url) => updateQuestionSet(set.id, { coverImageUrl: url || undefined })}
          />
        </div>

        <div className="content-well stack">
          <strong>{set.kind === 'quiz' ? '🧠 Questions' : '🗂️ Cards'}</strong>
          {set.kind === 'quiz' ? (
            <QuizEditor
              subject={set.subject}
              questions={set.questions}
              onChange={(questions) => updateQuestionSet(set.id, { questions })}
            />
          ) : (
            <DrillEditor
              subject={set.subject}
              cards={set.cards}
              onChange={(cards) => updateQuestionSet(set.id, { cards })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
