import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package, Truck, CheckCircle, Clock, AlertCircle, Search, Filter, ShieldCheck, Database } from 'lucide-react';

interface OrderItem {
  name: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  user_email: string;
  total: number;
  status: string;
  created_at: string;
  items: OrderItem[];
}

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  adminEmail: string;
}

const STATUS_CONFIG: Record<string, { color: string, icon: any }> = {
  'PENDING': { color: 'text-yellow-500', icon: Clock },
  'PENDING_DISPATCH': { color: 'text-blue-400', icon: Database },
  'SHIPPED': { color: 'text-accent', icon: Truck },
  'DELIVERED': { color: 'text-green-500', icon: CheckCircle },
  'CANCELLED': { color: 'text-muted', icon: AlertCircle },
};

export default function AdminDashboard({ isOpen, onClose, adminEmail }: AdminDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/orders', {
        headers: { 'x-admin-email': adminEmail }
      });
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error("Admin Order Fetch Failure:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail 
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      }
    } catch (err) {
      console.error("Status Update failure:", err);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.id.toLowerCase().includes(filter.toLowerCase()) || 
                          o.user_email?.toLowerCase().includes(filter.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-bg/95 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-6xl h-[85vh] bg-surface border border-white/5 flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-bg/50">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-accent flex items-center justify-center shadow-[0_0_30px_rgba(230,30,30,0.3)]">
                  <ShieldCheck className="text-white w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black tracking-[0.6em] text-accent uppercase block mb-1">
                    Control_Center // v1.0
                  </span>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Order Manifests</h2>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 bg-white/5 hover:bg-accent transition-colors"
                aria-label="Close Admin Panel"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Filters Bar */}
            <div className="p-6 bg-surface/50 border-b border-white/5 flex flex-col md:flex-row gap-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input 
                  type="text" 
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="SEARCH_MANIFEST_ID // EMAIL..."
                  className="w-full bg-bg border border-white/10 pl-12 pr-4 py-3 text-[10px] font-mono focus:border-accent outline-none uppercase"
                />
              </div>
              
              <div className="flex gap-4">
                <div className="relative">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-bg border border-white/10 pl-12 pr-10 py-3 text-[10px] font-mono text-ink appearance-none cursor-pointer focus:border-accent outline-none uppercase"
                  >
                    <option value="ALL">ALL STATUSES</option>
                    <option value="PENDING">PENDING</option>
                    <option value="PENDING_DISPATCH">PENDING_DISPATCH</option>
                    <option value="SHIPPED">SHIPPED</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
                <button 
                  onClick={fetchOrders}
                  className="bg-white/5 border border-white/10 px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:border-accent hover:text-accent transition-all"
                >
                  Sync Grid
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <motion.div 
                      animate={{ rotate: 360 }} 
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full" 
                    />
                    <span className="text-[10px] font-mono text-muted uppercase tracking-[0.4em]">Deciphering_Payload...</span>
                  </div>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 italic">
                  <Package className="w-16 h-16 mb-4 stroke-1" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">No manifestations detected in this sector.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredOrders.map((order) => {
                    const StatusIcon = STATUS_CONFIG[order.status]?.icon || Package;
                    return (
                      <motion.div 
                        key={order.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group bg-bg/50 border border-white/5 hover:border-accent/30 transition-all p-6 relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="flex flex-col xl:flex-row justify-between gap-8">
                          <div className="space-y-4">
                            <div className="flex items-center gap-4">
                              <h3 className="text-sm font-black uppercase tracking-tighter">{order.id}</h3>
                              <div className={`flex items-center gap-2 text-[9px] font-black px-2 py-1 bg-surface border border-white/5 ${STATUS_CONFIG[order.status]?.color || 'text-muted'}`}>
                                <StatusIcon className="w-3 h-3" />
                                {order.status}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black text-muted uppercase tracking-widest">Operator Email</span>
                                <span className="text-[10px] font-mono text-ink">{order.user_email || order.email}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black text-muted uppercase tracking-widest">Acquisition Timestamp</span>
                                <span className="text-[10px] font-mono text-ink">{new Date(order.created_at).toLocaleString()}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black text-muted uppercase tracking-widest">Total Value</span>
                                <span className="text-[10px] font-mono text-accent font-bold">₹{order.total}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 max-w-md">
                            <span className="text-[8px] font-black text-muted uppercase tracking-widest mb-3 block">Manifest Items</span>
                            <div className="space-y-2">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-[9px] font-mono border-b border-white/5 pb-2">
                                  <span className="text-ink uppercase">{item.name} ({item.color}/{item.size}) <span className="text-muted">x{item.quantity}</span></span>
                                  <span className="text-ink">₹{item.price * item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 min-w-[200px]">
                            <span className="text-[8px] font-black text-muted uppercase tracking-widest">Update Sector Status</span>
                            <div className="grid grid-cols-2 gap-2">
                              {['PENDING_DISPATCH', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map(s => (
                                <button
                                  key={s}
                                  onClick={() => updateStatus(order.id, s)}
                                  className={`py-2 text-[8px] font-black border transition-all ${order.status === s ? 'bg-accent border-accent text-white' : 'border-white/10 text-muted hover:border-accent hover:text-accent'}`}
                                >
                                  {s.replace('_', ' ')}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 bg-bg flex justify-between items-center border-t border-white/5 text-[8px] font-mono text-muted uppercase tracking-widest">
              <span>ADMIN_TERMINAL_SYNCED // {adminEmail}</span>
              <span>Grid_Protection: ENABLED</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
