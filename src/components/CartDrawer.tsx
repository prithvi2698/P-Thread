import { X, Minus, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { CartItem } from '../types';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, color: string, size: string, delta: number) => void;
  onRemove: (id: string, color: string, size: string) => void;
}

export default function CartDrawer({ isOpen, onClose, items, onUpdateQuantity, onRemove }: CartDrawerProps) {
  const navigate = useNavigate();
  const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const totalSavings = items.reduce((sum, item) => {
    const savingsPerUnit = (item.originalPrice || item.price || 0) - (item.price || 0);
    return sum + (savingsPerUnit * item.quantity);
  }, 0);

  const handleCheckout = () => {
    onClose();
    navigate('/checkout');
  };

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
            className="fixed right-0 top-0 h-full w-full max-w-md bg-paper border-l border-ink/10 shadow-2xl z-[101] flex flex-col"
          >
            <div className="p-4 sm:p-6 border-b border-white/5 flex justify-between items-center bg-bg/50">
              <div className="flex flex-col">
                <span className="text-[10px] font-black tracking-[0.4em] text-accent uppercase mb-1 drop-shadow-sm">Current_Manifest</span>
                <h2 className="text-xl font-display uppercase tracking-widest text-ink">Your Bag [{items.length}]</h2>
              </div>
              <div className="flex items-center gap-2">
                {items.length > 0 && (
                  <button 
                    onClick={handleCheckout}
                    className="hidden sm:block text-[9px] font-black uppercase tracking-widest bg-accent text-white px-4 py-2 hover:bg-white hover:text-bg transition-all"
                  >
                    Quick Checkout
                  </button>
                )}
                <button onClick={onClose} className="p-2 hover:bg-white/5 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6 sm:space-y-8 bg-paper">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-50">
                  <p className="font-mono text-sm uppercase tracking-tighter">Your bag is empty.</p>
                  <button onClick={onClose} className="text-xs border-b border-ink hover:pb-1 transition-all">Continue Shopping</button>
                </div>
              ) : (
                items.map((item) => (
                  <div key={`${item.id}-${item.selectedColor}-${item.selectedSize}`} className="flex space-x-4">
                    <motion.img 
                      initial={{ scale: 1.3, opacity: 0, x: 20 }}
                      whileInView={{ scale: 1, opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      src={item.image || 'https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=1000&auto=format&fit=crop'} 
                      alt={item.name} 
                      className="w-24 h-32 object-cover bg-ink/5"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=1000&auto=format&fit=crop';
                      }}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-start">
                        <h3 className="text-sm font-bold uppercase tracking-tight leading-none">{item.name}</h3>
                        <button onClick={() => onRemove(item.id, item.selectedColor, item.selectedSize)} className="text-ink/40 hover:text-ink">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[10px] font-mono uppercase text-ink/60">
                        {item.selectedColor} / {item.selectedSize}
                      </p>
                      <div className="flex justify-between items-center pt-2">
                        <div className="flex items-center space-x-3 border border-ink/10 px-2 py-1">
                          <button onClick={() => onUpdateQuantity(item.id, item.selectedColor, item.selectedSize, -1)} className="p-1 disabled:opacity-30" disabled={item.quantity <= 1}>
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-mono">{item.quantity}</span>
                          <button onClick={() => onUpdateQuantity(item.id, item.selectedColor, item.selectedSize, 1)} className="p-1">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex flex-col items-end">
                          {item.originalPrice && (
                            <span className="text-[9px] font-mono text-muted line-through opacity-40">₹{item.originalPrice * item.quantity}</span>
                          )}
                          <span className="text-sm font-bold tracking-tight">₹{(item.price || 0) * item.quantity}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-5 sm:p-8 bg-surface border-t border-white/5 space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                  <span>Manifest Subtotal</span>
                  <span>₹{subtotal + totalSavings}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-accent italic">
                    <span>Protocol Discount</span>
                    <span>-₹{totalSavings}</span>
                  </div>
                )}
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                  <span>Shipping Matrix</span>
                  <span className="text-accent">FREE</span>
                </div>
                <div className="h-[1px] bg-white/5" />
                <div className="flex justify-between text-lg font-black uppercase tracking-tighter text-ink">
                  <span>Final Total</span>
                  <span className="text-accent">₹{subtotal}</span>
                </div>
              </div>
              
              <button 
                onClick={handleCheckout}
                disabled={items.length === 0}
                className="w-full bg-accent text-white py-6 text-xs font-black uppercase tracking-[0.4em] hover:bg-white hover:text-bg transition-all transform hover:scale-[1.02] shadow-[0_0_30px_rgba(230,30,30,0.1)] disabled:opacity-20 disabled:grayscale disabled:scale-100 disabled:shadow-none"
              >
                SECURE ACQUISITION // CHECKOUT
              </button>
              
              <div className="flex items-center justify-center gap-2 opacity-30 text-[8px] font-bold uppercase tracking-widest">
                <div className="w-1 h-1 bg-accent rounded-full animate-pulse" />
                Secure Protocol Enabled
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
