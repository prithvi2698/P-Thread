import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Header from './components/Header';
import Hero from './components/Hero';
import ProductList from './components/ProductList';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import WishlistDrawer from './components/WishlistDrawer';
import ProductModal from './components/ProductModal';
import LoginModal from './components/LoginModal';
import OrderHistory from './components/OrderHistory';
import AdminDashboard from './components/AdminDashboard';
import About from './pages/About';
import Checkout from './pages/Checkout';
import { PRODUCTS } from './constants';
import { CartItem, Product } from './types';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

function AppContent() {
  const location = useLocation();
  const isCheckout = location.pathname === '/checkout';

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('threads-cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [wishlist, setWishlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('threads-wishlist');
    return saved ? JSON.parse(saved) : [];
  });
  const [user, setUser] = useState<{ name: string; email: string; uid: string } | null>(null);
  const [products, setProducts] = useState<Product[]>(PRODUCTS as Product[]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    // Firebase Identity Sync
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.emailVerified) {
        const userData = {
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Operator',
          email: firebaseUser.email || '',
          uid: firebaseUser.uid
        };
        setUser(userData);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('threads-cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('threads-wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  const addToCart = (product: Product, color: string, size: string, quantity: number = 1) => {
    if (product.price === undefined) {
      setNotification(`PIECE_MANIFEST_ONLY: CANNOT ACQUIRE`);
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    
    if (product.stock !== undefined && product.stock <= 0) {
      setNotification(`MANIFEST_EXHAUSTED: ${product.name} IS ARCHIVED`);
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => 
        item.id === product.id && 
        item.selectedColor === color && 
        item.selectedSize === size
      );

      const currentQty = existing ? existing.quantity : 0;
      const newQty = currentQty + quantity;

      if (product.stock !== undefined && newQty > product.stock) {
        setNotification(`INSUFFICIENT_STOCK: ONLY ${product.stock} AVAILABLE`);
        setTimeout(() => setNotification(null), 3000);
        return prev;
      }

      if (existing) {
        return prev.map(item => 
          item === existing 
            ? { ...item, quantity: newQty }
            : item
        );
      }

      return [...prev, { ...product, selectedColor: color, selectedSize: size, quantity }];
    });
    setNotification(`${product.name} ACQUIRED`);
    setIsCartOpen(true);
    setTimeout(() => setNotification(null), 3000);
  };

  const moveWishlistToCart = (product: Product) => {
    addToCart(product, product.colors[0].name, product.sizes[0]);
    toggleWishlist(product.id);
  };

  const updateQuantity = (id: string, color: string, size: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id && item.selectedColor === color && item.selectedSize === size) {
        const nextQty = item.quantity + delta;
        if (item.stock !== undefined && nextQty > item.stock) {
          setNotification(`MAX_ARCHIVE_QUOTA_REACHED [${item.stock}]`);
          return item;
        }
        return { ...item, quantity: Math.max(1, nextQty) };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string, color: string, size: string) => {
    setCart(prev => prev.filter(item => 
      !(item.id === id && item.selectedColor === color && item.selectedSize === size)
    ));
  };

  const clearCart = () => setCart([]);

  const toggleWishlist = (id: string) => {
    setWishlist(prev => 
      prev.includes(id) ? prev.filter(wId => wId !== id) : [...prev, id]
    );
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const wishlistProducts = products.filter(p => wishlist.includes(p.id));

  const handleLogin = (userData: { name: string; email: string; uid: string }) => {
    setUser(userData);
    setNotification(`IDENTITY VERIFIED // WELCOME ${userData.name.toUpperCase()}`);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setNotification("TERMINAL DISCONNECTED");
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Logout failure:", error);
    }
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Vertical Rail (Sidebar) - Hidden on mobile */}
      <aside className="hidden lg:flex w-20 border-r border-white/5 flex flex-col justify-between items-center py-10 shrink-0 bg-bg sticky top-0 h-screen z-50">
        <div className="flex flex-col items-center gap-12">
          <Link 
            to="/" 
            onClick={handleLogoClick}
            className="vertical-text font-black text-2xl md:text-3xl tracking-[0.2em] uppercase text-ink/80 hover:text-accent transition-colors"
          >
            P-THREAD STUDIO
          </Link>
          
          <div className="flex flex-col gap-8 py-8 items-center border-y border-white/5">
            <span className="vertical-text text-[10px] font-black uppercase tracking-[0.4em] text-accent/50">
              Core_Archive_Series_01
            </span>
            <div className="vertical-text text-[8px] font-black uppercase tracking-[0.2em] text-muted max-h-[300px] overflow-hidden opacity-50">
              Tactical silhouettes inspired by shadow transformations. Engineered for the operator.
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-12">
          <div className="w-[1px] h-20 bg-accent/20" />
          <div className="flex flex-col gap-6 text-[9px] uppercase font-black tracking-widest text-muted">
            <span className="vertical-text opacity-50 cursor-default">Archive_v0.1</span>
            <a href="#" className="hover:text-accent transition-colors vertical-text">Comm_Link // IG</a>
          </div>
          <div className="w-[1px] h-12 bg-white/5" />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {!isCheckout && (
          <Header 
            cartCount={cartCount} 
            onCartToggle={() => setIsCartOpen(true)}
            wishlistCount={wishlist.length}
            onWishlistToggle={() => setIsWishlistOpen(true)}
            user={user}
            onLoginToggle={() => setIsLoginOpen(true)}
            onLogout={handleLogout}
            onOrderHistoryToggle={() => setIsOrderHistoryOpen(true)}
            onAdminToggle={() => setIsAdminOpen(true)}
          />
        )}
        
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] bg-accent text-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl flex items-center gap-3"
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              {notification}
            </motion.div>
          )}
        </AnimatePresence>

        <Routes>
          <Route path="/" element={
            <main className="flex flex-col gap-24 md:gap-32">
              <Hero />
              <ProductList 
                products={products.filter(p => !p.name.startsWith('BTS //'))} 
                onAddToCart={addToCart}
                onWishlistToggle={toggleWishlist}
                wishlist={wishlist}
                onViewDetails={setSelectedProduct}
                title="BTS // Global Archive"
                collectionSubtitle="Archival_Sync_Active"
                id="series-01"
              />
              <ProductList 
                products={products.filter(p => p.name.startsWith('BTS //'))} 
                onAddToCart={addToCart}
                onWishlistToggle={toggleWishlist}
                wishlist={wishlist}
                onViewDetails={setSelectedProduct}
                title="BTS // Signature Series"
                collectionSubtitle="Latest_Manifest_v02"
                id="bts-archive"
                accentColor="#8b5cf6"
              />
            </main>
          } />
          <Route path="/about" element={<About />} />
          <Route path="/checkout" element={<Checkout cart={cart} onComplete={clearCart} user={user} onLoginToggle={() => setIsLoginOpen(true)} />} />
        </Routes>

        {!isCheckout && (
          <Footer 
            onLoginToggle={() => setIsLoginOpen(true)}
            user={user}
            onAdminToggle={() => setIsAdminOpen(true)}
          />
        )}
      </div>

      <CartDrawer 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={updateQuantity}
        onRemove={removeFromCart}
      />

      <WishlistDrawer 
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        products={wishlistProducts}
        onRemove={toggleWishlist}
        onMoveToCart={moveWishlistToCart}
      />

      <LoginModal 
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={handleLogin}
      />

      <OrderHistory 
        isOpen={isOrderHistoryOpen}
        onClose={() => setIsOrderHistoryOpen(false)}
        uid={user?.uid || ''}
      />

      {user?.email === 'prithvi2698@gmail.com' && (
        <AdminDashboard 
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          adminEmail={user.email}
        />
      )}

      <ProductModal 
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={addToCart}
        onWishlistToggle={toggleWishlist}
        isWishlisted={selectedProduct ? wishlist.includes(selectedProduct.id) : false}
        user={user}
        onLoginPrompt={() => setIsLoginOpen(true)}
      />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <div className="bg-bg min-h-[100dvh]">
        <AppContent />
      </div>
    </Router>
  );
}


