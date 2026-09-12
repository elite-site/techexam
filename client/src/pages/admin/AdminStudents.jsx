import { useEffect, useRef, useState } from 'react';
import AdminLayout from '../../components/AdminLayout.jsx';
import Loading from '../../components/Loading.jsx';
import { request, getAdminToken } from '../../api.js';

export default function AdminStudents() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [err, setErr] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef(null);

  async function load(q) {
    try {
      const d = await request('/admin/students' + (q ? `?search=${encodeURIComponent(q)}` : ''));
      setData(d);
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => { load(''); }, []);

  async function doImport(file) {
    setImporting(true);
    setImportMsg('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/admin/students/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAdminToken()}` },
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Import failed');
      setImportMsg(`Imported ${body.imported} students. Total registered: ${body.total_students}.`);
      load('');
    } catch (e) {
      setImportMsg('Import error: ' + e.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <AdminLayout title="Students" subtitle="Students registered from the imported Excel list.">
      {err && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">{err}</div>}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="card px-4 py-2 text-sm">
          <span className="text-slate-400">Total Students:</span>{' '}
          <span className="font-bold text-brand-700">{data ? data.total : '…'}</span>
        </div>
        <div className="flex-1 min-w-[220px]">
          <input
            className="input"
            placeholder="Search by Roll Number / Name…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); load(e.target.value.trim()); }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-soft" onClick={() => fileRef.current && fileRef.current.click()} disabled={importing}>
            {importing ? 'Importing…' : 'Update Students (Excel)'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { if (e.target.files[0]) doImport(e.target.files[0]); e.target.value = ''; }} />
        </div>
      </div>
      {importMsg && <div className={`text-sm rounded-lg border px-4 py-2 mb-4 ${importMsg.includes('error') || importMsg.includes('Import error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{importMsg}</div>}

      {!data && <Loading />}
      {data && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Roll Number</th>
                  <th className="px-4 py-3 font-semibold">Student Name</th>
                  <th className="px-4 py-3 font-semibold">Year</th>
                  <th className="px-4 py-3 font-semibold">Section</th>
                </tr>
              </thead>
              <tbody>
                {data.students.length === 0 && (
                  <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-400">No students found.</td></tr>
                )}
                {data.students.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-ink">{s.roll_number}</td>
                    <td className="px-4 py-2.5">{s.student_name}</td>
                    <td className="px-4 py-2.5">{s.year || '—'}</td>
                    <td className="px-4 py-2.5">{s.section || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}