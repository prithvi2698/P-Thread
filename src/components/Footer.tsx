import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-bg text-ink py-24 md:py-32 px-6 md:px-16 border-t border-white/5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-12 md:space-y-0">
        <div className="space-y-4">
          <div className="flex flex-col">
            <h2 className="text-2xl font-black tracking-tighter uppercase leading-none">P-THREAD STUDIO</h2>
            <span className="text-[8px] font-black tracking-[0.5em] text-accent uppercase leading-none mt-1">Studio_Operations</span>
          </div>
          <p className="max-w-[200px] text-[11px] uppercase font-black text-muted leading-relaxed tracking-widest">
            ENGINEERED FOR PERMANENCE. ARCHIVE 01 DISPATCHED BY P-THREAD STUDIO.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-4 text-[11px] font-black uppercase tracking-[0.3em] md:h-10 items-center">
           <a href="#" className="hover:text-accent transition-colors">Instagram</a>
        </div>

        <div className="text-[9px] font-black uppercase tracking-[0.4em] text-muted border-t md:border-t-0 md:border-l border-white/10 pt-8 md:pt-0 md:pl-8 md:h-10 flex items-center w-full md:w-auto">
          &copy; 2026 P-THREAD STUDIO_CORP.
        </div>
      </div>
    </footer>
  );
}

