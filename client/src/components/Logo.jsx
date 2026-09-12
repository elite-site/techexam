export function Logo({ size = 'md' }) {
  const px = size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const txt = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-lg';
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className={`${px} rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold shadow-soft`}>
        E
      </div>
      <div className="leading-tight">
        <div className={`${txt} font-bold text-ink tracking-tight`}>ELITE</div>
        <div className={`text-[10px] uppercase tracking-[0.2em] text-brand-600 ${size === 'sm' ? 'hidden' : ''}`}>
          Examination
        </div>
      </div>
    </div>
  );
}