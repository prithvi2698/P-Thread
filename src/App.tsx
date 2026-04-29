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
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    // Initial product fetch
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(Array.isArray(data) ? data : []))
      .catch(err => {
        console.warn('RETR_PRODUCTS_FAILURE // USING_PLACEHOLDER_ARCHIVE');
        setProducts(PRODUCTS as Product[]);
      });
  }, []);

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
          uid: firebaseUser.uid,
          photoURL: firebaseUser.photoURL
        };
        setUser(userData);
        // Sync with backend
        fetch('/api/auth-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        }).catch(err => console.error("AUTH_SYNC_FAILURE:", err));

        // Fetch cloud cart
        fetch(`/api/cart?uid=${firebaseUser.uid}`)
          .then(res => res.json())
          .then(cloudCart => {
            if (Array.isArray(cloudCart) && cloudCart.length > 0) {
              setCart(prevLocal => {
                // Merge logic: prefer cloud cart but keep unique local items if desired
                // For now, let's just use cloud cart if it exists to ensure cross-device consistency
                return cloudCart;
              });
            }
          })
          .catch(err => console.error("CLOUD_CART_FETCH_FAILURE:", err));
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('threads-cart', JSON.stringify(cart));
    
    // Sync cart to backend if user is logged in
    if (user) {
      const controller = new AbortController();
      fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, items: cart }),
        signal: controller.signal
      }).catch(err => {
        if (err.name !== 'AbortError') {
          console.error("CART_BACKEND_SYNC_FAILURE:", err);
        }
      });
      return () => controller.abort();
    }
  }, [cart, user]);

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
    <div className="flex min-h-screen bg-bg selection:bg-accent selection:text-white">
      {/* Vertical Rail (Sidebar) - Hidden on mobile */}
      <aside className="hidden lg:flex w-24 border-r border-white/5 flex-col justify-between items-center py-12 shrink-0 bg-bg sticky top-0 h-screen z-50 overflow-hidden">
        <div className="flex flex-col items-center gap-16">
          <Link 
            to="/" 
            onClick={handleLogoClick}
            className="vertical-text font-black text-3xl tracking-[0.25em] uppercase text-white/90 hover:text-accent transition-all duration-500 hover:scale-105"
          >
            P-THREAD
          </Link>
          
          <div className="flex flex-col gap-10 py-10 items-center relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[1px] bg-white/10" />
            <span className="vertical-text text-[9px] font-black uppercase tracking-[0.4em] text-accent/60">
              EST. 2026 // PROTOCOL
            </span>
            <div className="vertical-text text-[8px] font-black uppercase tracking-[0.25em] text-muted/40 max-h-[250px] overflow-hidden leading-relaxed">
              ARCHIVE_01_SERIES // TACTICAL_SYMMETRY // SHADOW_OPERATOR
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[1px] bg-white/10" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-12">
          <div className="w-[1px] h-24 bg-gradient-to-b from-transparent via-accent/30 to-transparent" />
          <div className="flex flex-col gap-8 text-[9px] uppercase font-black tracking-widest text-muted">
            <span className="vertical-text opacity-30 cursor-default">V_0.1.ARCHIVE</span>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hover:text-accent transition-all vertical-text hover:translate-y-[-2px]">SYNC_IG</a>
          </div>
          <div className="w-[1px] h-12 bg-white/5" />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen relative">
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
              className="fixed bottom-12 left-1/2 lg:left-[calc(50%+4rem)] -translate-x-1/2 z-[200] bg-white text-bg px-6 md:px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl flex items-center gap-4 border-l-4 border-accent w-[calc(100%-2rem)] max-w-sm lg:w-auto"
            >
              <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse shrink-0" />
              <span className="truncate">{notification}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <Routes>
          <Route path="/" element={
            <main className="flex flex-col gap-32 md:gap-48 pb-32">
              <Hero />
              <div className="w-full max-w-[1920px] mx-auto">
                <ProductList 
                  products={products.filter(p => !['11', '12', '13', '14', '16', '17', '18'].includes(p.id))} 
                  onAddToCart={addToCart}
                  onWishlistToggle={toggleWishlist}
                  wishlist={wishlist}
                  onViewDetails={setSelectedProduct}
                  title="Global Archive"
                  id="series-01"
                />
              </div>
              <div className="w-full max-w-[1920px] mx-auto border-t border-white/5">
                <ProductList 
                  products={products.filter(p => ['11', '12', '13', '14', '16', '17', '18'].includes(p.id))} 
                  onAddToCart={addToCart}
                  onWishlistToggle={toggleWishlist}
                  wishlist={wishlist}
                  onViewDetails={setSelectedProduct}
                  title="Signature Series"
                  id="bts-archive"
                  accentColor="#8b5cf6"
                />
              </div>
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


