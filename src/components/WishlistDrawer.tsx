import { X, Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product } from '../types';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onRemove: (id: string) => void;
  onMoveToCart: (product: Product) => void;
}

export default function WishlistDrawer({ 
  isOpen, 
  onClose, 
  products, 
  onRemove, 
  onMoveToCart 
}: WishlistDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-bg border-l border-white/5 shadow-2xl z-[101] flex flex-col"
          >
            <div className="p-6 sm:p-10 border-b border-white/5 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-black tracking-[0.6em] text-accent uppercase mb-1 block">Data_Vault</span>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-widest">Wishlist [{products.length}]</h2>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 sm:p-3 bg-white/5 hover:bg-accent hover:text-white transition-all transform hover:rotate-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10 space-y-8 sm:space-y-12">
              {products.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-30">
                  <Heart className="w-16 h-16 stroke-1 mb-4" />
                  <p className="text-xs font-black uppercase tracking-[0.4em] text-center">Archive is empty // No marks detected</p>
                  <button 
                    onClick={onClose} 
                    className="text-[10px] font-black uppercase tracking-widest border-b border-white/20 pb-2 hover:border-accent hover:text-accent transition-all"
                  >
                    Return to Mission
                  </button>
                </div>
              ) : (
                products.map((product) => (
                  <div key={product.id} className="group relative flex gap-6 pb-12 border-b border-white/5 last:border-0">
                    <div className="w-24 h-32 shrink-0 bg-white/5 overflow-hidden relative">
                      <motion.img 
                        initial={{ scale: 1.3, opacity: 0, x: 20 }}
                        whileInView={{ scale: 1, opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        src={product.image || (product.images && product.images[0]) || 'https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=1000&auto=format&fit=crop'} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=1000&auto=format&fit=crop';
                        }}
                      />
                      <div className="absolute inset-2 border border-white/5 pointer-events-none" />
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <h3 className="text-xs font-black uppercase tracking-widest">{product.name}</h3>
                          <button 
                            onClick={() => onRemove(product.id)} 
                            className="text-muted hover:text-accent transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex flex-col gap-1">
                          {product.originalPrice && (
                            <span className="text-[10px] font-mono font-bold text-muted line-through opacity-40">₹{product.originalPrice}</span>
                          )}
                          <span className="text-sm font-mono font-bold text-accent italic">₹{product.price}</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => onMoveToCart(product)}
                        className="mt-6 flex items-center justify-center gap-3 bg-white text-bg py-3 text-[9px] font-black uppercase tracking-[0.3em] hover:bg-accent hover:text-white transition-all transform hover:scale-105"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        Acquire Piece
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {products.length > 0 && (
              <div className="p-10 border-t border-white/5 bg-surface/50">
                <p className="text-[9px] font-bold text-muted uppercase tracking-[0.3em] leading-relaxed">
                  * Saved items will persist in your session. Archive Series 01 items are subject to availability.
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
