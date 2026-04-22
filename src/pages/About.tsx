import { motion } from 'motion/react';

export default function About() {
  return (
    <div className="pt-32 pb-24 px-4 md:px-12 bg-paper min-h-screen">
      <div className="max-w-4xl mx-auto space-y-24">
        <section>
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-8"
          >
            <span className="text-[10px] font-black tracking-[0.6em] text-accent uppercase mb-2 block">Core_Philosophy</span>
            <h1 className="text-[12vw] font-display leading-[0.8] mb-12 tracking-tighter">
              BEYOND<br/>FABRIC.
            </h1>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <p className="font-mono text-xs uppercase leading-relaxed text-muted tracking-widest">
              P-THREAD WAS BORN OUT OF A DESIRE FOR PERMANENCE IN A DISPOSABLE WORLD. 
              WE DON'T REPLICATE TRENDS. WE ARCHIVE STRENGTH.
            </p>
            <p className="font-mono text-xs uppercase leading-relaxed text-muted tracking-widest">
              EVERY SILHOUETTE IS A STUDY IN TACTICAL PROPORTION, TRANSFORMATION, AND DURABILITY. 
              ENGINEERED FOR THE OPERATOR WHO MOVES IN SILENCE.
            </p>
          </div>
        </section>

        <section className="border-t border-white/5 pt-24">
          <div className="mb-12">
            <span className="text-[10px] font-black tracking-[0.6em] text-accent uppercase mb-2 block">The_Grid</span>
            <h2 className="text-5xl font-display tracking-tighter uppercase">Operations Hub</h2>
          </div>
          <div className="aspect-[21/9] bg-white/5 overflow-hidden border border-white/5 relative group">
            <img 
              src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=2000&auto=format&fit=crop" 
              alt="Studio Hub" 
              className="w-full h-full object-cover grayscale opacity-40 group-hover:opacity-60 transition-all duration-1000 scale-105 group-hover:scale-100"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[15vw] font-black text-white/[0.03] uppercase tracking-[0.2em] select-none">DISPATCH</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
