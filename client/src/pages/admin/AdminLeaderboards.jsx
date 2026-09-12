import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout.jsx';
import Loading from '../../components/Loading.jsx';
import { request } from '../../api.js';

export default function AdminLeaderboards() {
  const [tests, setTests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    request('/admin/tests').then((d) => {
      setTests(d.tests);
      if (d.tests.length) setSelected(d.tests[0].id);
    }).catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setData(null);
    request(`/admin/leaderboard/${selected}`)
      .then((d) => setData(d))
      .catch((e) => setErr(e.message));
  }, [selected]);

  const toggleWinner = async (row) => {
    try {
      await request(`/admin/round2/winners/${row.student_id}`, 'POST', { winner: !row.round2_winner });
      setData((d) => ({
        ...d,
        leaderboard: d.leaderboard.map((x) =>
          x.student_id === row.student_id ? { ...x, round2_winner: !row.round2_winner } : x
        ),
      }));
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <AdminLayout title="Leaderboards" subtitle="Separate leaderboards for Code Debugging and each Technical Quiz round.">
      {err && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">{err}</div>}
      <div className="flex flex-wrap gap-2 mb-6">
        {tests.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${selected === t.id ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-brand-300'}`}
          >
            {t.name}{t.round ? ` R${t.round}` : ''}
          </button>
        ))}
      </div>

      {data ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-bold text-ink">{data.test.name}{data.test.round ? ` — Round ${data.test.round}` : ''} Leaderboard</h3>
            <span className="badge-gray">{data.leaderboard.length} entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold w-16">Rank</th>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Roll Number</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Correct</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {data.test.type === 'quiz' && Number(data.test.round) === 1 && (
                    <th className="px-4 py-3 font-semibold">Round 2 Winner</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.length === 0 && (
                  <tr><td colSpan={data.test.type === 'quiz' && Number(data.test.round) === 1 ? 7 : 6} className="px-4 py-10 text-center text-slate-400">No submitted attempts yet.</td></tr>
                )}
                {data.leaderboard.map((r, i) => (
                  <tr key={r.student_id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      {i === 0 ? <span className="badge-amber">🥇 {i + 1}</span>
                        : i === 1 ? <span className="badge-blue">🥈 {i + 1}</span>
                        : i === 2 ? <span className="badge-blue">🥉 {i + 1}</span>
                        : <span className="text-slate-400 font-semibold">{i + 1}</span>}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-ink">{r.student_name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.roll_number}</td>
                    <td className="px-4 py-2.5 font-bold text-brand-700">{r.score}</td>
                    <td className="px-4 py-2.5 text-slate-500">{r.correct_count}/{r.total_count}</td>
                    <td className="px-4 py-2.5"><span className={r.status === 'EXPIRED' ? 'badge-gray' : 'badge-green'}>{r.status}</span></td>
                    {data.test.type === 'quiz' && Number(data.test.round) === 1 && (
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleWinner(r)}
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                            r.round2_winner
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {r.round2_winner ? '🏆 Round 2 Winner' : 'Mark Winner'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Loading />
      )}
    </AdminLayout>
  );
}