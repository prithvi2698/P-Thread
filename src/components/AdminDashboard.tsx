import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package, Truck, CheckCircle, Clock, AlertCircle, Search, Filter, ShieldCheck, Database, RefreshCcw, Edit2, Check, Trash2, Tag } from 'lucide-react';
import { PRODUCTS } from '../constants';
import { db } from '../lib/firebase';
import { doc, setDoc, deleteDoc, getDoc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';

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
  notes?: string;
  labels?: string[];
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

const ALL_AVAILABLE_LABELS = ['URGENT', 'VIP', 'FRAGILE', 'HOLD', 'CUSTOMER_VIP', 'RESTOCKED', 'EXPORT_CLEARANCE'];

interface NotesControlProps {
  orderId: string;
  initialNotes: string;
  onSave: (orderId: string, notes: string) => Promise<void>;
}

function NotesControl({ orderId, initialNotes, onSave }: NotesControlProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(orderId, notes);
    setIsSaving(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-2">
      <span className="text-[8px] font-black text-muted uppercase tracking-widest block">Operator Notes</span>
      <div className="flex gap-2">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ADD OPERATOR COMMUNIQUÉ..."
          className="flex-1 bg-bg border border-white/10 p-2 text-[10px] font-mono focus:border-accent/40 outline-none uppercase resize-none h-[54px] rounded-none custom-scrollbar"
        />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`px-3 border text-[9px] font-black uppercase transition-all flex flex-col items-center justify-center gap-1 min-w-[64px] rounded-none ${
            isSaved 
              ? 'bg-green-500/10 border-green-500/30 text-green-400 font-bold' 
              : 'border-white/10 text-muted hover:border-accent hover:text-white hover:bg-white/5 cursor-pointer'
          }`}
        >
          {isSaving ? '...' : isSaved ? 'SAVED' : 'SAVE'}
        </button>
      </div>
    </div>
  );
}

interface LabelsControlProps {
  orderId: string;
  activeLabels: string[];
  onToggle: (orderId: string, label: string) => void;
}

function LabelsControl({ orderId, activeLabels, onToggle }: LabelsControlProps) {
  return (
    <div className="space-y-2">
      <span className="text-[8px] font-black text-muted uppercase tracking-widest block">Sector Log Labels</span>
      <div className="flex flex-wrap gap-1.5 h-[54px] content-start overflow-y-auto custom-scrollbar">
        {ALL_AVAILABLE_LABELS.map(lbl => {
          const isActive = activeLabels.includes(lbl);
          return (
            <button
              key={lbl}
              onClick={() => onToggle(orderId, lbl)}
              className={`px-2 py-1 text-[8px] font-mono border transition-all cursor-pointer rounded-none select-none ${
                isActive
                  ? 'bg-accent/10 border-accent/40 text-accent font-black shadow-[0_0_10px_rgba(230,30,30,0.1)]'
                  : 'bg-transparent border-white/5 text-muted hover:border-white/20 hover:text-white'
              }`}
            >
              {isActive ? `● ${lbl}` : `○ ${lbl}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchOrders = async () => {
    setLoading(true);
    let apiOrders: Order[] = [];
    try {
      const resp = await fetch('/api/admin/orders', {
        headers: { 'x-admin-email': adminEmail }
      });
      if (resp.ok) {
        const data = await resp.json();
        apiOrders = Array.isArray(data) ? data : [];
      }
    } catch (err) {
      console.warn("REST API Admin Order Fetch Failure (using firestore/local fallback):", err);
    }

    // Load from Firestore
    let firestoreOrders: Order[] = [];
    try {
      const q = collection(db, 'orders');
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        firestoreOrders.push({
          id: docSnap.id,
          user_email: data.email || data.user_email || 'SANDBOX_ANONYMOUS',
          total: Number(data.total || 0),
          status: data.status || 'PENDING',
          notes: data.notes || '',
          labels: data.labels || [],
          created_at: data.createdAt?.toDate?.()?.toISOString() || data.created_at || new Date().toISOString(),
          items: (data.items || []).map((item: any) => ({
            name: item.name,
            color: item.color || item.selectedColor || 'DEFAULT',
            size: item.size || item.selectedSize || 'DEFAULT',
            quantity: Number(item.quantity || 1),
            price: Number(item.price || 0)
          }))
        });
      });
    } catch (fsErr) {
      console.warn("Firestore Admin Order query skipped or failed:", fsErr);
    }

    // Load from localStorage
    let fallbackOrders: Order[] = [];
    try {
      const local = JSON.parse(localStorage.getItem('threads-fallback-orders') || '[]');
      fallbackOrders = local.map((o: any) => ({
        id: o.id,
        user_email: o.email || o.user_email || 'SANDBOX_ANONYMOUS',
        total: Number(o.total || 0),
        status: o.status || 'PENDING',
        notes: o.notes || '',
        labels: o.labels || [],
        created_at: o.created_at || o.createdAt || new Date().toISOString(),
        items: (o.items || []).map((item: any) => ({
          name: item.name,
          color: item.color || item.selectedColor || 'DEFAULT',
          size: item.size || item.selectedSize || 'DEFAULT',
          quantity: Number(item.quantity || 1),
          price: Number(item.price || 0)
        }))
      }));
    } catch (lsErr) {
      console.warn("Local storage parse failed:", lsErr);
    }

    // Merge everything by ID, keeping highest precedence: API > Firestore > Fallback
    const ordersMap = new Map<string, Order>();
    fallbackOrders.forEach(o => ordersMap.set(o.id.toLowerCase(), o));
    firestoreOrders.forEach(o => ordersMap.set(o.id.toLowerCase(), o));
    apiOrders.forEach(o => ordersMap.set(o.id.toLowerCase(), o));

    const combined = Array.from(ordersMap.values());
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setOrders(combined);
    setLoading(false);
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
    // 1. Update UI state immediately for responsive feedback
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

    try {
      // 2. Sync to API backend if online
      await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail
        },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (err) {
      console.warn("API direct status update skipped/failed:", err);
    }

    // 3. Update localStorage fallback state
    try {
      const localOrders = JSON.parse(localStorage.getItem('threads-fallback-orders') || '[]');
      const updated = localOrders.map((o: any) => {
        if (o.id === orderId) {
          return { ...o, status: newStatus };
        }
        return o;
      });
      localStorage.setItem('threads-fallback-orders', JSON.stringify(updated));
    } catch (lsErr) {
      console.error("Local storage status update error:", lsErr);
    }

    // 4. Update Firestore directly as Admin
    try {
      const orderRef = doc(db, 'orders', orderId);
      await setDoc(orderRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      }, { merge: true });
      console.log(`Firestore status updated to ${newStatus} for ID: ${orderId}`);
    } catch (firestoreErr) {
      console.warn("Firestore direct status sync skipped/failed:", firestoreErr);
    }
  };

  const updateOrderId = async (oldId: string) => {
    if (!newOrderIdInput.trim() || newOrderIdInput === oldId) {
      setEditingOrderId(null);
      return;
    }

    const newId = newOrderIdInput.trim();

    try {
      // 1. Try hitting the API backend
      await fetch(`/api/admin/orders/${oldId}/update-id`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail
        },
        body: JSON.stringify({ newId })
      });
    } catch (err) {
      console.warn("API update order ID skipped/failed:", err);
    }

    // Always keep state, localStorage, and Firestore synchronized
    setOrders(prev => prev.map(o => o.id === oldId ? { ...o, id: newId } : o));
    setEditingOrderId(null);

    // Update Local Storage
    try {
      const localOrders = JSON.parse(localStorage.getItem('threads-fallback-orders') || '[]');
      const updated = localOrders.map((o: any) => {
        if (o.id === oldId) {
          return { ...o, id: newId };
        }
        return o;
      });
      localStorage.setItem('threads-fallback-orders', JSON.stringify(updated));
    } catch (lsErr) {
      console.error("Local storage ID update error:", lsErr);
    }

    // Update Firestore (clone document with new ID and delete old document)
    try {
      const oldRef = doc(db, 'orders', oldId);
      const newRef = doc(db, 'orders', newId);
      const snap = await getDoc(oldRef);
      if (snap.exists()) {
        await setDoc(newRef, {
          ...snap.data(),
          updatedAt: serverTimestamp()
        });
        await deleteDoc(oldRef);
        console.log(`Firestore document clone successful from '${oldId}' to '${newId}'`);
      }
    } catch (firestoreErr) {
      console.warn("Firestore document ID migration skipped/failed:", firestoreErr);
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

  const updateNotes = async (orderId: string, newNotes: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, notes: newNotes } : o));

    try {
      await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail
        },
        body: JSON.stringify({ notes: newNotes })
      });
    } catch (err) {
      console.warn("API update notes failed:", err);
    }

    try {
      const localOrders = JSON.parse(localStorage.getItem('threads-fallback-orders') || '[]');
      const updated = localOrders.map((o: any) => o.id === orderId ? { ...o, notes: newNotes } : o);
      localStorage.setItem('threads-fallback-orders', JSON.stringify(updated));
    } catch (lsErr) {
      console.error(lsErr);
    }

    try {
      const orderRef = doc(db, 'orders', orderId);
      await setDoc(orderRef, {
        notes: newNotes,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (fsErr) {
      console.warn("Firestore update notes failed:", fsErr);
    }
  };

  const toggleLabel = async (orderId: string, label: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const currentLabels = order.labels || [];
    const newLabels = currentLabels.includes(label)
      ? currentLabels.filter(l => l !== label)
      : [...currentLabels, label];

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, labels: newLabels } : o));

    try {
      await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail
        },
        body: JSON.stringify({ labels: newLabels })
      });
    } catch (err) {
      console.warn("API update labels failed:", err);
    }

    try {
      const localOrders = JSON.parse(localStorage.getItem('threads-fallback-orders') || '[]');
      const updated = localOrders.map((o: any) => o.id === orderId ? { ...o, labels: newLabels } : o);
      localStorage.setItem('threads-fallback-orders', JSON.stringify(updated));
    } catch (lsErr) {
      console.error(lsErr);
    }

    try {
      const orderRef = doc(db, 'orders', orderId);
      await setDoc(orderRef, {
        labels: newLabels,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (fsErr) {
      console.warn("Firestore update labels failed:", fsErr);
    }
  };

  const deleteOrder = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    const orderId = orderToDelete.id;

    try {
      await fetch(`/api/admin/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail
        },
        body: JSON.stringify({ reason: cancellationReason || 'Order cancelled by administrator.' })
      });
    } catch (err) {
      console.warn("API delete order failed: ", err);
    }

    setOrders(prev => prev.filter(o => o.id !== orderId));

    try {
      const localOrders = JSON.parse(localStorage.getItem('threads-fallback-orders') || '[]');
      const updated = localOrders.filter((o: any) => o.id !== orderId);
      localStorage.setItem('threads-fallback-orders', JSON.stringify(updated));
    } catch (lsErr) {
      console.error("Local storage delete order failed:", lsErr);
    }

    try {
      const orderRef = doc(db, 'orders', orderId);
      await deleteDoc(orderRef);
      console.log(`Firestore document deleted: ${orderId}`);
    } catch (fsErr) {
      console.warn("Firestore direct delete order failed:", fsErr);
    }

    setIsDeleting(false);
    setOrderToDelete(null);
    setCancellationReason('');
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

                          <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                            <div className="md:col-span-5">
                              <NotesControl 
                                orderId={order.id} 
                                initialNotes={order.notes || ''} 
                                onSave={updateNotes} 
                              />
                            </div>
                            <div className="md:col-span-4">
                              <LabelsControl 
                                orderId={order.id} 
                                activeLabels={order.labels || []} 
                                onToggle={toggleLabel} 
                              />
                            </div>
                            <div className="md:col-span-3">
                              <button
                                onClick={() => setOrderToDelete(order)}
                                className="w-full py-3 border border-red-500/20 text-[9px] font-black text-red-500 bg-red-500/5 hover:bg-red-500 hover:text-white hover:border-red-500 uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer h-[54px] rounded-none"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                REMOVE MANIFEST
                              </button>
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

          {/* Deletion / Voiding Overlay Prompt */}
          <AnimatePresence>
            {orderToDelete && (
              <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setOrderToDelete(null)}
                  className="absolute inset-0 bg-black/95 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="relative w-full max-w-lg bg-surface border border-red-500/30 p-8 shadow-2xl flex flex-col gap-6"
                >
                  <div className="flex items-center gap-4 border-b border-red-500/20 pb-4">
                    <div className="w-10 h-10 bg-red-500/10 border border-red-500/40 flex items-center justify-center text-red-500 font-bold text-xs select-none animate-pulse">
                      !
                    </div>
                    <div>
                      <span className="text-[9px] font-black tracking-widest text-red-500 uppercase block">Terminal_Warning // Level_04</span>
                      <h3 className="text-sm font-black uppercase text-white tracking-widest">Acquisition Revocation Protocol</h3>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-mono text-muted uppercase tracking-wider leading-relaxed">
                      You are about to void manifest <strong className="text-red-400 font-black">{orderToDelete.id}</strong>. This operation will purge the record from the mainframe database.
                    </p>
                    <p className="text-[10px] font-mono text-muted uppercase tracking-wider leading-relaxed">
                      A critical cancellation email will be dispatched to <strong className="text-white">{orderToDelete.user_email}</strong>. Please provide a clear termination record entry below describing the reason:
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-muted uppercase tracking-widest block">Reason for Allocation Revocation</span>
                    <textarea
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      placeholder="e.g. ITEM_OUT_OF_STOCK // ADDRESS_VERIFICATION_FAILURE"
                      className="w-full bg-bg border border-red-500/20 p-3 text-[10px] font-mono focus:border-red-500 outline-none uppercase resize-none h-[80px] rounded-none text-red-400 custom-scrollbar placeholder:text-red-950/55"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setOrderToDelete(null)}
                      className="flex-1 py-3 border border-white/5 text-[9px] font-black text-muted hover:border-white/20 hover:text-white uppercase tracking-widest transition-all cursor-pointer rounded-none"
                    >
                      ABORT PROTOCOL
                    </button>
                    <button
                      onClick={deleteOrder}
                      disabled={isDeleting}
                      className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-[9px] font-black text-white uppercase tracking-widest transition-all cursor-pointer rounded-none flex items-center justify-center gap-2 font-bold"
                    >
                      {isDeleting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          VOIDIND...
                        </>
                      ) : (
                        'CONFIRM REVOCATION'
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}
