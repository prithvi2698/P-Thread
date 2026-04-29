import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package, Truck, CheckCircle, Clock, AlertCircle, Search, Filter, ShieldCheck, Database, RefreshCcw, Edit2, Check } from 'lucide-react';
import { PRODUCTS } from '../constants';

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

const STATUS_CONFIG: Record<string, { color: string, bg: string, icon: any }> = {
  'PENDING': { color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: Clock },
  'PENDING_DISPATCH': { color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: Database },
  'SHIPPED': { color: 'text-accent', bg: 'bg-accent/10 border-accent/20', icon: Truck },
  'DELIVERED': { color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20', icon: CheckCircle },
  'CANCELLED': { color: 'text-muted', bg: 'bg-white/5 border-white/10', icon: AlertCircle },
};

export default function AdminDashboard({ isOpen, onClose, adminEmail }: AdminDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'INVENTORY'>('ORDERS');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [newOrderIdInput, setNewOrderIdInput] = useState('');
  const [resendingId, setResendingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/admin/orders', {
        headers: { 'x-admin-email': adminEmail }
      });
      const data = await resp.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Admin Order Fetch Failure:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/products');
      const data = await resp.json();
      setInventory(Array.isArray(data) ? data : PRODUCTS as any[]);
    } catch (err) {
      console.error("Admin Inventory Fetch Failure:", err);
      setInventory(PRODUCTS as any[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'ORDERS') fetchOrders();
      else fetchInventory();
    }
  }, [isOpen, activeTab]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail
        },
        body: JSON.stringify({ status: newStatus })
      });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (err) {
      console.error("Status Update failure:", err);
    }
  };

  const updateOrderId = async (oldId: string) => {
    if (!newOrderIdInput.trim() || newOrderIdInput === oldId) {
      setEditingOrderId(null);
      return;
    }
    try {
      const resp = await fetch(`/api/admin/orders/${oldId}/update-id`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail
        },
        body: JSON.stringify({ newId: newOrderIdInput })
      });
      if (resp.ok) {
        setOrders(prev => prev.map(o => o.id === oldId ? { ...o, id: newOrderIdInput } : o));
        setEditingOrderId(null);
      }
    } catch (err) {
      console.error("ID Update failure:", err);
    }
  };

  const resendReceipt = async (orderId: string) => {
    setResendingId(orderId);
    try {
      const resp = await fetch(`/api/admin/orders/${orderId}/resend`, {
        method: 'POST',
        headers: { 
          'x-admin-email': adminEmail
        }
      });
      if (resp.ok) {
        alert('MANIFEST_RE_DISPATCHED // Email sequence successful');
      }
    } catch (err) {
      console.error("Resend failure:", err);
    } finally {
      setResendingId(null);
    }
  };

  const updateStock = async (productId: string, newStock: number) => {
    try {
      await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail
        },
        body: JSON.stringify({ stock: newStock })
      });
      setInventory(prev => prev.map(p => p.id === productId ? { ...p, stock: newStock } : p));
    } catch (err) {
      console.error("Stock update failure:", err);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.id.toLowerCase().includes(filter.toLowerCase()) || 
                          o.user_email?.toLowerCase().includes(filter.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredInventory = inventory.filter(p => 
    p.name.toLowerCase().includes(filter.toLowerCase()) || 
    p.category?.toLowerCase().includes(filter.toLowerCase())
  );

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
            <div className="p-8 border-b border-white/5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-bg/50">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-accent flex items-center justify-center shadow-[0_0_30px_rgba(230,30,30,0.3)]">
                  <ShieldCheck className="text-white w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black tracking-[0.6em] text-accent uppercase block mb-1">
                    Control_Center // v1.1
                  </span>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Operations</h2>
                </div>
              </div>
              
              <div className="flex w-full lg:w-auto gap-1 bg-bg p-1 border border-white/5">
                <button 
                  onClick={() => setActiveTab('ORDERS')}
                  className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === 'ORDERS' 
                      ? 'bg-accent text-white shadow-[0_0_15px_rgba(230,30,30,0.2)]' 
                      : 'text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  Manifests
                </button>
                <button 
                  onClick={() => setActiveTab('INVENTORY')}
                  className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === 'INVENTORY' 
                      ? 'bg-accent text-white shadow-[0_0_15px_rgba(230,30,30,0.2)]' 
                      : 'text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  Inventory
                </button>
              </div>

              <button 
                onClick={onClose}
                className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-accent transition-colors lg:relative lg:top-0 lg:right-0"
                aria-label="Close Admin Panel"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Global Search & Contextual Filters */}
            <div className="p-6 bg-surface/50 border-b border-white/5 flex flex-col md:flex-row gap-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input 
                  type="text" 
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={activeTab === 'ORDERS' ? "SEARCH_MANIFEST_ID // EMAIL..." : "SEARCH_PRODUCT_CATALOG..."}
                  className="w-full bg-bg border border-white/10 pl-12 pr-4 py-3 text-[10px] font-mono focus:border-accent outline-none uppercase"
                />
              </div>
              
              <div className="flex gap-4">
                {activeTab === 'ORDERS' ? (
                  <div className="relative flex-1 md:flex-none">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                    <select 
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full bg-bg border border-white/10 pl-12 pr-10 py-3 text-[10px] font-mono text-ink appearance-none cursor-pointer focus:border-accent outline-none uppercase"
                    >
                      <option value="ALL">ALL STATUSES</option>
                      {Object.keys(STATUS_CONFIG).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 bg-bg border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[9px] font-mono text-muted uppercase tracking-widest">Live_Stock_Feed</span>
                  </div>
                )}
              </div>
            </div>

            {/* Main Scrollable View */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <motion.div 
                      animate={{ rotate: 360 }} 
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full shadow-[0_0_20px_rgba(230,30,30,0.2)]" 
                    />
                    <span className="text-[10px] font-mono text-muted uppercase tracking-[0.4em] animate-pulse">Syncing_Mainframe...</span>
                  </div>
                </div>
              ) : activeTab === 'ORDERS' ? (
                /* ORDERS CONTENT */
                filteredOrders.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30">
                    <Package className="w-16 h-16 mb-4 stroke-1 text-muted" />
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
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          className="group bg-bg/30 border border-white/5 hover:border-accent/30 transition-all p-6 relative overflow-hidden"
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          <div className="flex flex-col xl:flex-row justify-between gap-8">
                            {/* ... same order card content starts ... */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-4">
                                {editingOrderId === order.id ? (
                                  <div className="flex items-center gap-2">
                                    <input 
                                      value={newOrderIdInput}
                                      onChange={(e) => setNewOrderIdInput(e.target.value.toUpperCase())}
                                      className="bg-bg border border-accent p-1 text-[10px] font-mono outline-none"
                                      autoFocus
                                    />
                                    <button onClick={() => updateOrderId(order.id)} className="text-green-500"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => setEditingOrderId(null)} className="text-muted"><X className="w-4 h-4" /></button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 group/id">
                                    <h3 className="text-sm font-black uppercase tracking-tighter">{order.id}</h3>
                                    <button 
                                      onClick={() => {
                                        setEditingOrderId(order.id);
                                        setNewOrderIdInput(order.id);
                                      }}
                                      className="opacity-0 group-hover/id:opacity-100 transition-opacity p-1 hover:text-accent"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                                <div className={`flex items-center gap-2 text-[8px] font-black px-2 py-1 border transition-colors ${STATUS_CONFIG[order.status]?.bg || 'bg-surface border-white/5'} ${STATUS_CONFIG[order.status]?.color || 'text-muted'} rounded-sm`}>
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
                              <div className="flex justify-between items-center">
                                <span className="text-[8px] font-black text-muted uppercase tracking-widest">Update Sector Status</span>
                                <button 
                                  onClick={() => resendReceipt(order.id)}
                                  disabled={resendingId === order.id}
                                  className="text-[8px] font-black text-accent hover:text-white flex items-center gap-1 transition-colors uppercase"
                                >
                                  <RefreshCcw className={`w-3 h-3 ${resendingId === order.id ? 'animate-spin' : ''}`} />
                                  {resendingId === order.id ? 'SENDING...' : 'RESEND RECEIPT'}
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {['PENDING_DISPATCH', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map(s => (
                                  <motion.button
                                    key={s}
                                    whileHover={{ scale: 1.02, y: -1 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => updateStatus(order.id, s)}
                                    className={`relative py-2 text-[8px] font-black border uppercase tracking-wider transition-all duration-300 ${
                                      order.status === s 
                                        ? 'bg-accent border-accent text-white shadow-[0_0_20px_rgba(230,30,30,0.3)] z-10 scale-105' 
                                        : 'border-white/10 text-muted hover:border-accent/50 hover:text-accent bg-bg/50'
                                    }`}
                                  >
                                    {order.status === s && (
                                      <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="absolute -inset-[3px] border border-accent/50 pointer-events-none"
                                      />
                                    )}
                                    {s.replace('_', ' ')}
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )
              ) : (
                // INVENTORY TAB
                <div className="space-y-4">
                  {filteredInventory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-20 opacity-30">
                      <Database className="w-16 h-16 mb-4 stroke-1 text-muted" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted">No catalog matches detected.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredInventory.map((item) => (
                        <motion.div 
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.98 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true }}
                          className="bg-bg/30 border border-white/5 p-6 space-y-4 hover:border-accent/40 transition-all group"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[8px] font-black text-accent uppercase tracking-[0.4em] mb-1 block">{item.category}</span>
                              <h3 className="text-xs font-black uppercase tracking-tighter group-hover:text-accent transition-colors">{item.name}</h3>
                            </div>
                            <img 
                              src={item.images?.[0] || item.image} 
                              alt="" 
                              className="w-12 h-12 grayscale brightness-50 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-500" 
                            />
                          </div>
                        
                        <div className="flex justify-between items-center py-4 border-y border-white/5">
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-muted uppercase tracking-widest block">Available Stock</span>
                            <span className={`text-xl font-mono ${item.stock === 0 ? 'text-red-500' : 'text-white'}`}>{item.stock}</span>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => updateStock(item.id, item.stock - 1)}
                              className="w-8 h-8 flex items-center justify-center border border-white/10 hover:border-accent hover:text-accent"
                            >
                              -
                            </button>
                            <button 
                              onClick={() => updateStock(item.id, item.stock + 1)}
                              className="w-8 h-8 flex items-center justify-center border border-white/10 hover:border-accent hover:text-accent"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[9px] font-mono text-muted">
                          <span>PRICE // ₹{item.price}</span>
                          <span className="uppercase">{item.stock <= 5 ? 'Critical_Fill' : 'Optimal_Manifest'}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
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
