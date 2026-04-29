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
    <section className="relative flex flex-col justify-center min-h-[90vh] lg:min-h-screen pt-20 overflow-hidden bg-bg text-white">
      {/* Tactical Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Archival Background Image */}
        <div className="absolute inset-0 flex items-center justify-center lg:justify-end lg:pr-[10%] opacity-40 lg:opacity-60 overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, scale: 1.2, x: 100 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full h-full lg:w-4/5 lg:h-4/5 max-w-[1200px]"
          >
            <img 
              src="https://lh3.googleusercontent.com/d/1pJiRzzIZgQ7bxhXfpMf8WswEawwrOzGG" 
              alt="Archival Focal Point" 
              className="w-full h-full object-contain object-center scale-125 lg:scale-110"
              referrerPolicy="no-referrer"
            />
            {/* Overlay Vignetts for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg via-transparent to-bg" />
          </motion.div>
        </div>

        {/* Technical Grid Overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(var(--color-accent) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

        {/* Scanner Line */}
        <motion.div 
          animate={{ y: ['-100%', '300%'] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-x-0 h-[100px] bg-gradient-to-b from-transparent via-accent/5 to-transparent z-0"
        />
      </div>

      <div className="z-10 relative container mx-auto px-6 md:px-12 lg:px-24">
        <div className="max-w-[1000px]">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: 'circOut' }}
          >
            <div className="flex items-center gap-6 mb-12">
               <div className="h-[1px] w-12 bg-accent" />
               <span className="text-[10px] font-black uppercase tracking-[0.6em] text-accent">Active_Protocol_v0.1</span>
            </div>

            <div className="relative mb-8 md:mb-12">
              <h1 className="text-[14vw] sm:text-[14vw] lg:text-[10vw] font-black tracking-[-0.04em] uppercase leading-[0.85] text-white mix-blend-difference break-words">
                P-THREAD
              </h1>
              <div className="absolute -top-4 -left-4 w-8 h-8 md:w-12 md:h-12 border-t-2 border-l-2 border-accent opacity-50" />
            </div>
            
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="flex flex-col gap-8 md:gap-12"
            >
               <p className="text-[10px] md:text-sm font-mono text-muted max-w-sm uppercase leading-relaxed tracking-wider">
                  Tactical manifestations engineered for survival in the urban grid. Archive series one now synchronized for deployment.
               </p>
               
               <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
                  <button 
                    onClick={scrollToCollection}
                    className="bg-white text-bg px-8 md:px-10 py-5 md:py-6 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] hover:bg-accent hover:text-white transition-all transform hover:translate-y-[-4px] relative group overflow-hidden"
                  >
                    <span className="relative z-10">Access Archive_01</span>
                    <div className="absolute inset-0 bg-accent translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                  </button>

                  <button 
                    onClick={scrollToBTS}
                    className="bg-[#b042dd] text-white px-8 md:px-10 py-5 md:py-6 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] transition-all transform hover:translate-y-[-4px] hover:brightness-110"
                  >
                    Signature Series
                  </button>
               </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Vertical Side labels */}
      <div className="absolute bottom-24 right-12 hidden lg:flex flex-col items-end gap-12 pointer-events-none">
        <div className="vertical-text text-[9px] font-black tracking-[0.8em] text-muted/30 uppercase">
          04_29_2026 // DISPATCH
        </div>
        <div className="w-[1px] h-32 bg-gradient-to-b from-accent to-transparent" />
      </div>
    </section>
  );
}




