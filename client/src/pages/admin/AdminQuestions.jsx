import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout.jsx';
import Loading from '../../components/Loading.jsx';
import { request } from '../../api.js';

function QuestionForm({ initial, onSubmit, onCancel, submitting }) {
  const [f, setF] = useState(initial || { question_type: 'mcq', question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: '', marks: 1, question_order: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const isMcq = f.question_type === 'mcq';
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(f);
      }}
    >
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Type</label>
          <select className="input" value={f.question_type} onChange={(e) => set('question_type', e.target.value)}>
            <option value="mcq">Multiple Choice</option>
            <option value="text">Short Answer</option>
            <option value="code">Code / Debug</option>
          </select>
        </div>
        <div>
          <label className="label">Marks</label>
          <input className="input" type="number" step="0.5" min="0" value={f.marks} onChange={(e) => set('marks', e.target.value)} />
        </div>
        <div>
          <label className="label">Order</label>
          <input className="input" type="number" min="1" placeholder="auto" value={f.question_order} onChange={(e) => set('question_order', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Question text</label>
        <textarea className="input font-mono text-[13px]" rows={f.question_type === 'code' ? 7 : 3} value={f.question_text}
          onChange={(e) => set('question_text', e.target.value)} placeholder="Question statement (code questions: paste the code/program)" required />
      </div>
      {isMcq ? (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            {['A', 'B', 'C', 'D'].map((k) => (
              <div key={k}>
                <label className="label">Option {k}</label>
                <input className="input" value={f[`option_${k.toLowerCase()}`] || ''} onChange={(e) => set(`option_${k.toLowerCase()}`, e.target.value)} />
              </div>
            ))}
          </div>
          <div>
            <label className="label">Correct answer (A–D)</label>
            <select className="input max-w-[160px]" value={f.correct_answer || ''} onChange={(e) => set('correct_answer', e.target.value)}>
              <option value="">— none —</option>
              {['A', 'B', 'C', 'D'].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </>
      ) : (
        <div>
          <label className="label">Correct answer {f.question_type === 'code' && '(accepted lines)'}</label>
          <textarea className="input font-mono text-[13px]" rows={4} value={f.correct_answer || ''} onChange={(e) => set('correct_answer', e.target.value)}
            placeholder="The expected answer — never shown to students" />
        </div>
      )}
      <div className="flex gap-3 pt-1">
        <button className="btn-primary" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function AdminQuestions() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  async function loadQuestions(id) {
    setQuestions(null);
    try {
      const d = await request(`/admin/tests/${id}/questions`);
      setTest(d.test);
      setQuestions(d.questions);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    request('/admin/tests').then((d) => {
      setTests(d.tests);
      if (!testId && d.tests.length) navigate(`/admin/questions/${d.tests[0].id}`, { replace: true });
    }).catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (testId) loadQuestions(testId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  async function create(f) {
    setSubmitting(true);
    try {
      await request(`/admin/tests/${testId}/questions`, 'POST', f);
      setAdding(false);
      loadQuestions(testId);
    } catch (e) {
      alert(e.message);
    } finally { setSubmitting(false); }
  }
  async function update(f) {
    setSubmitting(true);
    try {
      await request(`/admin/tests/${testId}/questions/${editing.id}`, 'PUT', f);
      setEditing(null);
      loadQuestions(testId);
    } catch (e) {
      alert(e.message);
    } finally { setSubmitting(false); }
  }
  async function remove(q) {
    if (!confirm(`Delete question ${q.question_order}: "${(q.question_text || '').slice(0, 60)}…"`)) return;
    try {
      await request(`/admin/tests/${testId}/questions/${q.id}`, 'DELETE');
      loadQuestions(testId);
    } catch (e) { alert(e.message); }
  }

  return (
    <AdminLayout title="Question Bank" subtitle="View, add, edit or delete questions for any examination.">
      {err && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">{err}</div>}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {tests.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/admin/questions/${t.id}`)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${String(t.id) === String(testId) ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-brand-300'}`}
            >
              {t.name}{t.round ? ` R${t.round}` : ''}
            </button>
          ))}
        </div>
        <button className="btn-primary ml-auto" onClick={() => { setAdding(true); setEditing(null); }}>+ Add Question</button>
      </div>

      {!questions && !err && <Loading />}
      {questions && (
        <>
          {adding && (
            <div className="card p-6 mb-6 border-l-4 border-l-brand-500">
              <h3 className="font-bold text-ink mb-4">Add question — {test && (test.name + (test.round ? ` R${test.round}` : ''))}</h3>
              <QuestionForm onSubmit={create} onCancel={() => setAdding(false)} submitting={submitting} />
            </div>
          )}
          <div className="space-y-3">
            {questions.length === 0 && <div className="card p-10 text-center text-slate-400">No questions yet. Add the first question above.</div>}
            {questions.map((q) => (
              <div key={q.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="badge-gray">Q{q.question_order}</span>
                      <span className={q.question_type === 'mcq' ? 'badge-blue' : q.question_type === 'code' ? 'badge-amber' : 'badge-gray'}>{q.question_type.toUpperCase()}</span>
                      <span className="text-xs text-slate-400">{q.marks} mark{q.marks > 1 ? 's' : ''}</span>
                      {q.correct_answer && <span className="badge-green text-[11px]">correct: {String(q.correct_answer).slice(0, 20)}{String(q.correct_answer).length > 20 ? '…' : ''}</span>}
                    </div>
                    <div className="text-sm text-ink whitespace-pre-wrap line-clamp-4">{q.question_text}</div>
                    {q.question_type === 'mcq' && (
                      <div className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1">
                        {['A', 'B', 'C', 'D'].map((k) => q[`option_${k.toLowerCase()}`] && (
                          <div key={k} className="text-xs text-slate-500"><span className="font-semibold text-slate-400">{k}.</span> {q[`option_${k.toLowerCase()}`]}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button className="btn-soft px-3 py-1.5" onClick={() => { setEditing(q); setAdding(false); }}>Edit</button>
                    <button className="btn-danger px-3 py-1.5" onClick={() => remove(q)}>Delete</button>
                  </div>
                </div>
                {editing && editing.id === q.id && (
                  <div className="mt-5 pt-5 border-t border-slate-100">
                    <h4 className="font-bold text-ink mb-3">Edit question</h4>
                    <QuestionForm initial={{
                      question_type: q.question_type, question_text: q.question_text,
                      option_a: q.option_a || '', option_b: q.option_b || '', option_c: q.option_c || '', option_d: q.option_d || '',
                      correct_answer: q.correct_answer || '', marks: q.marks, question_order: q.question_order,
                    }} onSubmit={update} onCancel={() => setEditing(null)} submitting={submitting} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  );
}