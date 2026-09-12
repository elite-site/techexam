export default function Loading({ label = 'Loading…' }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-400">
      <div className="h-8 w-8 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}