import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { request, getStudentToken } from '../../api.js';
import { Logo } from '../../components/Logo.jsx';
import Loading from '../../components/Loading.jsx';

const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${String(m).padStart(2, '0')}:${ss}`;
};

// Pre-fill the code editor with the C program embedded in the question text
// (drop the prose prompt that precedes the snippet).
function extractCode(text) {
  const s = String(text || '');
  const inc = s.indexOf('#include');
  if (inc !== -1) return s.slice(inc).trim();
  const main = s.indexOf('int main');
  if (main !== -1) return s.slice(main).trim();
  return s.trim();
}

// The prose instruction that precedes the embedded code snippet.
function extractPrompt(text) {
  const s = String(text || '');
  let cut = -1;
  const inc = s.indexOf('#include');
  const main = s.indexOf('int main');
  if (inc !== -1) cut = inc;
  if (main !== -1 && (cut === -1 || main < cut)) cut = main;
  return cut > -1 ? s.slice(0, cut).trim() : s.trim();
}

// Human labels for the console error kinds returned by the Run endpoint.
// Deliberately describes only the *type* of error, never the exact line.
const CONSOLE_LABELS = {
  compilation: 'Compilation error',
  runtime: 'Runtime error',
  logical: 'Logical error',
  output: 'Output',
};

function questionOptions(q) {
  return [
    { k: 'A', v: q.option_a },
    { k: 'B', v: q.option_b },
    { k: 'C', v: q.option_c },
    { k: 'D', v: q.option_d },
  ].filter((o) => o.v && String(o.v).trim() !== '');
}

function QuestionBlock({ q, index, answer, onChange, runState, runConsole, onRun }) {
  const { letter = '', value = '' } = answer || {};
  if (q.question_type === 'mcq') {
    const opts = questionOptions(q);
    return (
      <div>
        <div className="flex gap-2 text-sm font-semibold text-brand-700 mb-2">
          <span className="bg-brand-50 rounded px-2 py-0.5">Q{index + 1}</span>
          <span className="text-slate-400 font-normal">[{q.marks} mark{q.marks > 1 ? 's' : ''}]</span>
        </div>
        <div className="text-[15px] leading-relaxed text-ink whitespace-pre-wrap mb-4">{q.question_text}</div>
        <div className="space-y-2">
          {opts.map((o) => (
            <label
              key={o.k}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all ${
                letter === o.k
                  ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/30'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name={`q${q.id}`}
                checked={letter === o.k}
                onChange={() => onChange(o.k)}
                className="mt-0.5 accent-brand-600"
              />
              <span className="flex items-start gap-2 text-sm">
                <span className={`font-bold ${letter === o.k ? 'text-brand-700' : 'text-slate-400'}`}>{o.k}.</span>
                <span className="text-slate-700">{o.v}</span>
              </span>
              {letter === o.k && (
                <span className="ml-auto h-5 w-5 rounded-full bg-brand-600 text-white text-[11px] flex items-center justify-center shrink-0">✓</span>
              )}
            </label>
          ))}
        </div>
      </div>
    );
  }
  if (q.question_type === 'code') {
    const busy = runState === 'running';
    return (
      <div>
        <div className="flex gap-2 text-sm font-semibold text-brand-700 mb-2">
          <span className="bg-brand-50 rounded px-2 py-0.5">Q{index + 1}</span>
          <span className="text-slate-400 font-normal">[{q.marks} marks]</span>
        </div>
        <div className="text-[15px] leading-relaxed text-ink whitespace-pre-wrap mb-4">
          {extractPrompt(q.question_text) || 'Correct the errors in the C program below.'}
        </div>
        <label className="label">Edit the code here (fix it in place)</label>
        <textarea
          rows={14}
          spellCheck={false}
          className={`input font-mono text-[12.5px] leading-relaxed focus:bg-white resize-y ${
            runState === 'Correct' ? 'ring-2 ring-emerald-400 border-emerald-400'
            : runState === 'Error' ? 'ring-2 ring-red-300 border-red-300'
            : ''
          }`}
          placeholder="Fix the C code here…"
          value={value}
          onChange={(e) => onChange({ letter: '', value: e.target.value })}
        />
        <div className="flex items-center gap-3 pt-3">
          <button type="button" className="btn-primary px-5 py-2" disabled={busy || value.trim() === ''} onClick={() => onRun(q, value)}>
            {busy ? 'Checking…' : 'Run'}
          </button>
          {runState === 'Correct' && (
            <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-sm font-semibold">Correct</span>
          )}
          {runState === 'Error' && (
            <span className="rounded-full bg-red-50 text-red-600 border border-red-200 px-3 py-1 text-sm font-semibold">Error</span>
          )}
        </div>
        {runConsole && (
          <div className={`mt-3 rounded-lg border overflow-hidden ${runState === 'Correct' ? 'border-emerald-200' : 'border-red-200'}`}>
            <div className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${runState === 'Correct' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {runState === 'Correct' ? 'Output console' : 'Error console'}
            </div>
            <pre className={`bg-slate-900 text-[12px] leading-relaxed font-mono px-3 py-2.5 whitespace-pre-wrap max-h-56 overflow-auto ${runState === 'Correct' ? 'text-emerald-300' : 'text-red-300'}`}>
              {runState === 'Correct'
                ? runConsole.text
                : `${CONSOLE_LABELS[runConsole.kind] || 'Error'}: ${runConsole.text}`}
            </pre>
          </div>
        )}
      </div>
    );
  }
  return (
    <div>
      <div className="flex gap-2 text-sm font-semibold text-brand-700 mb-2">
        <span className="bg-brand-50 rounded px-2 py-0.5">Q{index + 1}</span>
        <span className="text-slate-400 font-normal">[{q.marks} mark{q.marks > 1 ? 's' : ''}]</span>
      </div>
      <div className="text-[15px] leading-relaxed text-ink whitespace-pre-wrap mb-4">{q.question_text}</div>
      <label className="label">Your answer</label>
      {q.question_type === 'text' ? (
        <input className="input" value={value} placeholder="Type your answer…" onChange={(e) => onChange({ letter: '', value: e.target.value })} />
      ) : (
        <textarea rows={5} className="input" value={value} placeholder="Type your answer…" onChange={(e) => onChange({ letter: '', value: e.target.value })} />
      )}
    </div>
  );
}

export default function StudentTest() {
  const { testId } = useParams();
  const { student } = useAuth();
  const [phase, setPhase] = useState('loading'); // loading | blocked | running | completed
  const [blockMsg, setBlockMsg] = useState('');
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [totalMarks, setTotalMarks] = useState(0);
  const [answers, setAnswers] = useState({}); // qid -> {letter, value}
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saveState, setSaveState] = useState(''); // '' | saving | saved | error
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [runStates, setRunStates] = useState({}); // qid -> '' | running | Correct | Error
  const [runConsoles, setRunConsoles] = useState({}); // qid -> {kind, text}
  const answersRef = useRef(answers);
  const saveTimer = useRef(null);
  const submittedRef = useRef(null);
  answersRef.current = answers;

  const setAnswerFor = useCallback((qid, v) => {
    setAnswers((prev) => ({ ...prev, [qid]: v }));
  }, []);

  const persistAnswers = useCallback(async (payload) => {
    try {
      setSaveState('saving');
      await request(`/student/tests/${testId}/answers`, 'PUT', { answers: payload });
      setSaveState('saved');
    } catch (_) {
      setSaveState('error');
    }
  }, [testId]);

  const scheduleSave = useCallback(() => {
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const payload = Object.entries(answersRef.current).map(([qid, v]) => ({
        question_id: Number(qid),
        answer: v.letter || v.value || '',
      }));
      persistAnswers(payload);
    }, 900);
  }, [persistAnswers]);

  const doRun = useCallback(async (q, code) => {
    setRunStates((prev) => ({ ...prev, [q.id]: 'running' }));
    setRunConsoles((prev) => ({ ...prev, [q.id]: null }));
    try {
      const res = await request(`/student/tests/${testId}/run`, 'POST', { question_id: q.id, code });
      setRunStates((prev) => ({ ...prev, [q.id]: res.result === 'Correct' ? 'Correct' : 'Error' }));
      setRunConsoles((prev) => ({ ...prev, [q.id]: res.console || null }));
    } catch (_) {
      setRunStates((prev) => ({ ...prev, [q.id]: 'Error' }));
      setRunConsoles((prev) => ({ ...prev, [q.id]: { kind: 'runtime', text: 'Could not run the program.' } }));
    }
  }, [testId]);

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const payload = Object.entries(answersRef.current).map(([qid, v]) => ({
        question_id: Number(qid),
        answer: v.letter || v.value || '',
      }));
      const res = await request(`/student/tests/${testId}/submit`, 'POST', { answers: payload });
      setSubmitted(res);
      setPhase('completed');
    } catch (e) {
      submittedRef.current = false;
      setSubmitting(false);
      alert('Submission failed: ' + e.message + '\nPlease try again.');
    }
  }, [testId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let data = await request(`/student/tests/${testId}/attempt`);
        if (!alive) return;
        if (data.no_attempt) {
          if (data.test && data.test.status !== 'ACTIVE') {
            setBlockMsg('This test has not been started by the administrator yet. Please wait.');
            setPhase('blocked');
            return;
          }
          const started = await request(`/student/tests/${testId}/start`, 'POST');
          if (!alive) return;
          if (started.already_completed) {
            setSubmitted({ attempt: started.attempt });
            setPhase('completed');
            return;
          }
          data = started;
        }
        const att = data.attempt;
        if (att.status === 'SUBMITTED' || att.status === 'EXPIRED') {
          setSubmitted({ score: att.score, attempt: att });
          setPhase('completed');
          return;
        }
        setTest(data.test);
        setQuestions(data.questions || []);
        setTotalMarks((data.questions || []).reduce((s, qq) => s + Number(qq.marks || 0), 0));
        setRemaining(att.remaining_seconds ?? Number(data.test.duration_seconds));
        const seed = {};
        (data.questions || []).forEach((q) => {
          const val = data.answers ? data.answers[q.id] : undefined;
          if (val) {
            seed[q.id] = q.question_type === 'mcq'
              ? { letter: val.trim().toUpperCase(), value: '' }
              : { letter: '', value: val };
          } else if (q.question_type === 'code') {
            seed[q.id] = { letter: '', value: extractCode(q.question_text) };
          } else {
            seed[q.id] = { letter: '', value: '' };
          }
        });
        setAnswers(seed);
        setPhase('running');
      } catch (e) {
        if (!alive) return;
        setBlockMsg(e.message);
        setPhase('blocked');
      }
    })();
    return () => { alive = false; };
  }, [testId]);

  // countdown
  useEffect(() => {
    if (phase !== 'running') return;
    if (remaining <= 0) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          doSubmit();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, remaining > 0, doSubmit]);

  // before unload
  useEffect(() => {
    const onBefore = () => {
      if (phase === 'running' && saveTimer.current) clearTimeout(saveTimer.current);
      const payload = Object.entries(answersRef.current).map(([qid, v]) => ({
        question_id: Number(qid),
        answer: v.letter || v.value || '',
      }));
      fetch(`/api/student/tests/${testId}/answers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getStudentToken() },
        body: JSON.stringify({ answers: payload }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [phase, testId]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  if (phase === 'loading') return <div className="min-h-screen"><Loading label="Preparing your test…" /></div>;

  if (phase === 'blocked') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-8 max-w-md text-center">
          <div className="text-4xl mb-3">⏳</div>
          <h1 className="text-lg font-bold text-ink mb-2">Test Not Available</h1>
          <p className="text-sm text-slate-500 mb-5">{blockMsg}</p>
          <Link to="/student/dashboard" className="btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (phase === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-8 max-w-md text-center">
          <div className="h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 text-2xl flex items-center justify-center mx-auto mb-4">✓</div>
          {submitted && test ? (
            <>
              <h1 className="text-lg font-bold text-ink mb-1">Test Submitted Successfully</h1>
              <p className="text-sm text-slate-500 mb-4">Your responses have been recorded.</p>
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 mb-5">
                <div className="text-xs uppercase tracking-wider text-emerald-600 font-semibold mb-1">Submission</div>
                <div className="text-xl font-bold text-emerald-700">Submitted</div>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold text-ink mb-1">You have already completed this test.</h1>
              <p className="text-sm text-slate-500 mb-5">You can view your result below.</p>
            </>
          )}
          <div className="flex gap-3 justify-center">
            <Link to={`/student/result/${testId}`} className="btn-soft">View Result</Link>
            <Link to="/student/dashboard" className="btn-outline">Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const answeredCount = questions.filter((qq) => {
    const a = answers[qq.id];
    return a && (a.letter || a.value);
  }).length;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Logo size="sm" />
            <div className="hidden sm:block h-8 w-px bg-slate-200" />
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-semibold text-ink">{test.name}</div>
              <div className="text-xs text-slate-400">{student.roll_number} · {student.student_name}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400">Answered {answeredCount}/{questions.length}</div>
            <div className={`rounded-lg px-4 py-1.5 text-center ${remaining <= 60 ? 'bg-red-50 border border-red-200' : 'bg-brand-50 border border-brand-100'}`}>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Time Remaining</div>
              <div className={`font-mono text-xl font-bold ${remaining <= 60 ? 'text-red-600' : 'text-brand-700'}`}>{fmtTime(remaining)}</div>
            </div>
            <button className="btn-primary" onClick={() => setConfirmOpen(true)} disabled={submitting}>Submit Test</button>
          </div>
        </div>
      </header>

      {saveState !== '' && phase === 'running' && (
        <div className={`text-center text-xs py-1 border-b ${saveState === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-brand-50/60 text-slate-500 border-slate-200'}`}>
          {saveState === 'error' ? 'Could not save — check connection' : saveState === 'saving' ? 'Saving your answer…' : 'Answer saved'}
        </div>
      )}

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 grid lg:grid-cols-[200px_1fr] gap-6">
        <aside className="card p-4 h-fit lg:sticky lg:top-24">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Questions</div>
          <div className="grid grid-cols-8 lg:grid-cols-5 gap-1.5">
            {questions.map((qq, idx) => {
              const a = answers[qq.id];
              const filled = a && (a.letter || a.value);
              const active = idx === current;
              const correct = runStates[qq.id] === 'Correct';
              return (
                <button
                  key={qq.id}
                  onClick={() => setCurrent(idx)}
                  title={correct ? 'Correct' : filled ? 'Answered' : 'Unanswered'}
                  className={`h-8 w-8 rounded-md text-xs font-semibold transition-colors ${
                    active ? 'ring-2 ring-brand-700' : ''
                  } ${
                    correct ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : active ? 'bg-brand-600 text-white'
                    : filled ? 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-brand-600 inline-block" /> Current</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-emerald-500 inline-block" /> Correct</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-brand-100 inline-block" /> Answered</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-slate-200 inline-block" /> Unanswered</div>
          </div>
        </aside>

        <section className="card p-6 flex flex-col gap-4">
          {q && (
            <QuestionBlock
              q={q}
              index={current}
              answer={answers[q.id] || { letter: '', value: '' }}
              runState={runStates[q.id] || ''}
              runConsole={runConsoles[q.id] || null}
              onRun={doRun}
              onChange={(v) => {
                const shaped = typeof v === 'string' ? { letter: v, value: '' } : v;
                setAnswerFor(q.id, shaped);
                setRunStates((prev) => ({ ...prev, [q.id]: '' }));
                setRunConsoles((prev) => ({ ...prev, [q.id]: null }));
                scheduleSave();
              }}
            />
          )}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
            <button className="btn-outline" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>← Previous</button>
            <div className="text-xs text-slate-400">Question {current + 1} of {questions.length}</div>
            {current < questions.length - 1 ? (
              <button className="btn-primary" onClick={() => setCurrent((c) => c + 1)}>Next →</button>
            ) : (
              <button className="btn-primary" onClick={() => setConfirmOpen(true)} disabled={submitting}>Submit Test</button>
            )}
          </div>
        </section>
      </main>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-7 max-w-sm w-full text-center shadow-soft">
            <div className="text-3xl mb-3">📝</div>
            <h3 className="text-lg font-bold text-ink mb-2">Are you sure you want to submit?</h3>
            <p className="text-sm text-slate-500 mb-6">You will not be able to change your answers after submission.</p>
            <div className="flex gap-3">
              <button className="btn-outline flex-1" onClick={() => setConfirmOpen(false)} disabled={submitting}>Cancel</button>
              <button className="btn-primary flex-1" onClick={async () => { setConfirmOpen(false); await doSubmit(); }} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}