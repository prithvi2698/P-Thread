import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package, Truck, CheckCircle, Clock, AlertCircle, ShoppingBag } from 'lucide-react';

interface OrderItem {
  name: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  total: number;
  status: string;
  created_at: string;
  items: OrderItem[];
}

interface OrderHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
}

const STATUS_CONFIG: Record<string, { color: string, icon: any, label: string }> = {
  'PENDING': { color: 'text-yellow-500', icon: Clock, label: 'AUTHENTICATING' },
  'PENDING_DISPATCH': { color: 'text-blue-400', icon: Package, label: 'ALLOCATING_RESOURCES' },
  'SHIPPED': { color: 'text-accent', icon: Truck, label: 'IN_TRANSIT' },
  'DELIVERED': { color: 'text-green-500', icon: CheckCircle, label: 'ACQUISITION_COMPLETE' },
  'CANCELLED': { color: 'text-muted', icon: AlertCircle, label: 'PROTOCOL_TERMINATED' },
};

export default function OrderHistory({ isOpen, onClose, uid }: OrderHistoryProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch(`/api/orders?uid=${uid}`)
        .then(res => res.json())
        .then(data => {
          setOrders(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Order fetch failure:", err);
          setLoading(false);
        });
    }
  }, [isOpen, uid]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-bg/90 backdrop-blur-xl"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, x: 50 }}
            animate={{ scale: 1, opacity: 1, x: 0 }}
            exit={{ scale: 0.9, opacity: 0, x: 50 }}
            className="relative w-full max-w-2xl h-[80vh] bg-surface border border-white/5 flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-bg/50">
              <div>
                <span className="text-[10px] font-black tracking-[0.6em] text-accent uppercase mb-2 block">Acquisition_Log</span>
                <h2 className="text-3xl font-black uppercase tracking-tighter">Your Archive</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-3 bg-white/5 hover:bg-accent transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full" 
                  />
                </div>
              ) : orders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 italic">
                  <ShoppingBag className="w-16 h-16 mb-4 stroke-1" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted text-center">
                    No acquisitions detected in this manifest.<br/>
                    Start your archive selection.
                  </p>
                </div>
              ) : (
                <div className="space-y-12">
                  {orders.map((order) => (
                    <div key={order.id} className="space-y-6">
                      <div className="flex justify-between items-end border-b border-white/5 pb-4">
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-muted uppercase tracking-widest">MANIFEST_ID // {new Date(order.created_at).toLocaleDateString()}</span>
                          <h3 className="text-sm font-black uppercase tracking-tighter">{order.id}</h3>
                        </div>
                        <div className={`flex items-center gap-2 text-[10px] font-black ${STATUS_CONFIG[order.status]?.color || 'text-muted'}`}>
                          {React.createElement(STATUS_CONFIG[order.status]?.icon || Package, { className: "w-4 h-4" })}
                          <span className="uppercase tracking-widest">{STATUS_CONFIG[order.status]?.label || order.status}</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-start">
                            <div className="space-y-1">
                              <p className="text-[11px] font-black uppercase tracking-widest text-ink">{item.name}</p>
                              <p className="text-[9px] font-mono text-muted uppercase">
                                {item.color} // {item.size} // QTY: {item.quantity}
                              </p>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-accent italic">₹{item.price * item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center bg-white/5 p-4 border border-white/5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted">Final Consolidation</span>
                        <span className="text-xl font-black tracking-tighter text-ink font-mono">₹{order.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-bg border-t border-white/5 text-[8px] font-mono text-muted text-center uppercase tracking-[0.4em]">
              All data is end-to-end synchronized // v0.1-Archive-Grid
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
