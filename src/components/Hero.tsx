import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

export default function Hero() {
  const scrollToCollection = () => {
    const element = document.getElementById('series-01');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToBTS = () => {
    const element = document.getElementById('bts-archive');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative flex flex-col justify-center px-4 md:px-16 pt-24 md:pt-32 pb-8 md:pb-0 overflow-x-hidden bg-bg text-ink lg:min-h-[80vh]">
      {/* Tactical Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Archival Background Image */}
        <div className="absolute inset-x-0 inset-y-0 lg:left-1/4 flex items-center justify-center pointer-events-none overflow-hidden h-full">
          <motion.div 
            initial={{ opacity: 0, scale: 1.8, x: 150 }}
            animate={{ opacity: 0.5, scale: 1, x: 0 }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full h-full max-w-[1000px] mt-24 md:mt-0"
          >
            <img 
              src="https://lh3.googleusercontent.com/d/1pJiRzzIZgQ7bxhXfpMf8WswEawwrOzGG" 
              alt="Archival Background" 
              className="w-full h-full object-contain object-center scale-150 lg:scale-150 transition-all opacity-100 md:opacity-80"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=1000&auto=format&fit=crop';
              }}
            />
            {/* Overlay Vignetts for seamless blending */}
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg via-transparent to-surface" />
          </motion.div>
        </div>

        {/* Animated Orbital Rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-10">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 border border-accent rounded-full border-dashed"
          />
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-20 border border-white/20 rounded-full border-dotted"
          />
        </div>

        {/* Floating Data Points */}
        <motion.div 
          animate={{ 
            y: [0, -20, 0],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 right-[10%] text-[8px] font-mono font-black vertical-text tracking-[0.8em] text-accent/30"
        >
        </motion.div>

        <motion.div 
          animate={{ 
            x: [0, 20, 0],
            opacity: [0.1, 0.3, 0.1]
          }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-14 left-[5%] text-[8px] font-mono font-black tracking-[0.5em] text-white/20"
        >
          SYSTEM_SYNC_ACTIVE
        </motion.div>

        {/* Large Decorative X - Removed background P_THREAD to avoid conflict with centered P */}
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 text-[40vh] font-black text-white/5 select-none transition-all duration-1000 -rotate-12 hidden">
          P_THREAD
        </div>

        {/* Scanning Line */}
        <motion.div 
          animate={{ y: ['-100%', '200%'] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-x-0 h-[100px] bg-gradient-to-b from-transparent via-accent/5 to-transparent z-0"
        />
      </div>

      <div className="z-10 relative w-full max-w-7xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: 'circOut' }}
          className="flex flex-col items-center"
        >
          <div className="mb-12 flex flex-col items-center gap-4">
             <div className="h-[2px] w-24 bg-accent/30" />
          </div>

          <div className="relative mb-4 md:mb-8 px-4 w-full">
            <h1 className="text-[2.2rem] sm:text-6xl md:text-9xl font-black tracking-[0.1em] sm:tracking-[0.2em] uppercase text-white drop-shadow-[0_0_50px_rgba(230,30,30,0.2)] relative z-10 leading-[1] sm:leading-none break-words">
              P-THREAD
            </h1>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="flex flex-col items-center relative z-20"
          >
             <h2 className="text-[10px] md:text-xl font-bold tracking-[0.3em] sm:tracking-[1em] uppercase text-ink/80 mb-8 md:mb-12 px-2">
                UNLEASH THE POWER WITHIN.
             </h2>
             
             <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                <button 
                  onClick={scrollToCollection}
                  className="bg-accent text-white px-8 md:px-12 py-5 text-[10px] font-black uppercase tracking-[.6em] hover:bg-white hover:text-bg transition-all transform hover:scale-105 shadow-[0_0_50px_rgba(230,30,30,0.4)] relative overflow-hidden group border border-accent flex-1 sm:flex-none"
                >
                  <span className="relative z-10">Manifest Archive</span>
                  <div className="absolute inset-0 bg-white translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500" />
                </button>

                <button 
                  onClick={scrollToBTS}
                  className="bg-[#8b5cf6] text-white px-8 md:px-12 py-5 text-[10px] font-black uppercase tracking-[.6em] hover:bg-white hover:text-[#8b5cf6] transition-all transform hover:scale-105 shadow-[0_0_50px_rgba(139,92,246,0.4)] relative overflow-hidden group border border-[#8b5cf6] flex-1 sm:flex-none"
                >
                  <span className="relative z-10">Acquire BTS // 2026</span>
                  <div className="absolute inset-0 bg-white translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
                </button>
             </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Grid pattern background */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(red 1px, transparent 0)', backgroundSize: '60px 60px' }} />
      
      <div className="absolute bottom-12 right-12 opacity-20 pointer-events-none hidden lg:block">
        <div className="text-[15vh] font-black vertical-text tracking-widest text-white/5 uppercase">
          Latest Dispatch
        </div>
      </div>
    </section>
  );
}




