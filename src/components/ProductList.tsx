import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Product } from '../types';
import ProductCard from './ProductCard';
import { Search, SlidersHorizontal, X } from 'lucide-react';

interface ProductListProps {
  products: Product[];
  onAddToCart: (product: Product, color: string, size: string, quantity: number) => void;
  onWishlistToggle: (productId: string) => void;
  wishlist: string[];
  onViewDetails: (product: Product) => void;
  title?: string;
  collectionSubtitle?: string;
  id?: string;
  showFilters?: boolean;
  variant?: 'grid' | 'poster';
  accentColor?: string;
}

export default function ProductList({ 
  products, 
  onAddToCart, 
  onWishlistToggle, 
  wishlist,
  onViewDetails,
  title = "Series 01 Collection",
  collectionSubtitle = "Archive_System",
  id = "collection-view",
  showFilters = true,
  variant = 'grid',
  accentColor = 'var(--color-accent)'
}: ProductListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategories, setActiveCategories] = useState<string[]>(['All']);
  const [sortBy, setSortBy] = useState<'default' | 'price-low' | 'price-high'>('default');

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    return ['All', ...cats];
  }, [products]);

  const resetFilters = () => {
    setActiveCategories(['All']);
    setSearchQuery('');
    setSortBy('default');
  };

  const toggleCategory = (cat: string) => {
    setActiveCategories(prev => {
      if (cat === 'All') return ['All'];
      
      const newCats = prev.includes(cat) 
        ? prev.filter(c => c !== cat) 
        : [...prev.filter(c => c !== 'All'), cat];
      
      return newCats.length === 0 ? ['All'] : newCats;
    });
  };

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategories.includes('All') || activeCategories.includes(p.category);
      return matchesSearch && matchesCategory;
    });

    if (sortBy === 'price-low') result.sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sortBy === 'price-high') result.sort((a, b) => (b.price || 0) - (a.price || 0));

    return result;
  }, [products, searchQuery, activeCategories, sortBy]);

  return (
    <section id={id} className={`flex flex-col py-24 md:py-32 relative ${id !== 'collection-view' ? 'bg-bg' : 'bg-surface'}`}>
      <div className="container mx-auto px-6 md:px-12 lg:px-24">
        {/* Decorative vertical lines - Subtle reinforcement */}
        <div className="hidden 2xl:block absolute top-0 left-12 w-[1px] h-full bg-white/5 pointer-events-none" />
        <div className="hidden 2xl:block absolute top-0 right-12 w-[1px] h-full bg-white/5 pointer-events-none" />

        <div className="shrink-0 space-y-12 mb-20 relative">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-12">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-[1px]" style={{ backgroundColor: accentColor }} />
                <span className="text-[10px] font-black tracking-[0.6em] uppercase" style={{ color: accentColor }}>{collectionSubtitle}</span>
              </div>
              <h2 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter uppercase text-white leading-[0.9]">{title}</h2>
            </div>
            
            {showFilters && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
                <div className="relative group flex-1 sm:flex-none">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" />
                  <input 
                    type="text"
                    placeholder="Search Manifest..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-bg border border-white/10 py-5 pl-14 pr-12 text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-accent w-full sm:w-80 transition-all placeholder:opacity-30"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-muted hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="relative">
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-bg border border-white/10 py-5 px-8 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-accent appearance-none cursor-pointer w-full"
                  >
                    <option value="default">Sort // Protocol</option>
                    <option value="price-low">Value // Minimal</option>
                    <option value="price-high">Value // Maximal</option>
                  </select>
                  <SlidersHorizontal className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-muted pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {showFilters && categories.length > 2 && (
            <div className="flex flex-wrap items-center gap-4" id="category-filters">
              <div className="flex flex-wrap gap-3">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`group relative text-[9px] font-black uppercase tracking-[0.3em] px-8 py-4 border transition-all duration-500 ${
                      activeCategories.includes(cat) 
                        ? 'border-accent text-white' 
                        : 'bg-bg border-white/5 text-muted hover:text-white hover:border-white/20'
                    }`}
                  >
                    <span className="relative z-10 flex items-center gap-3">
                      {cat}
                      {activeCategories.includes(cat) && cat !== 'All' && (
                        <div className="w-1 h-1 bg-accent rounded-full animate-ping" />
                      )}
                    </span>
                    
                    {activeCategories.includes(cat) && (
                      <motion.div 
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        className="absolute bottom-0 left-0 w-full h-[1px] bg-accent origin-left"
                      />
                    )}
                  </button>
                ))}
              </div>

              {(!activeCategories.includes('All') || searchQuery !== '' || sortBy !== 'default') && (
                <button 
                  onClick={resetFilters}
                  className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.4em] text-accent hover:text-white transition-all pl-6 border-l border-white/10"
                >
                  <X className="w-3 h-3" />
                  Reset_Archive
                </button>
              )}
            </div>
          )}
        </div>

        <div 
          className={variant === 'poster' 
            ? "grid grid-cols-1 gap-24 flex-1" 
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-x-6 gap-y-12 flex-1"
          } 
          id="product-grid"
        >
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product, index) => (
            <div key={product.id} id={index === 0 ? 'primary-data-node' : undefined} className={variant === 'poster' ? 'max-w-4xl mx-auto w-full' : ''}>
              <ProductCard 
                product={product} 
                onAddToCart={onAddToCart}
                onWishlistToggle={onWishlistToggle}
                isWishlisted={wishlist.includes(product.id)}
                onViewDetails={onViewDetails}
                variant={variant}
                accentColor={accentColor}
              />
            </div>
          ))
        ) : (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 border border-white/5 flex items-center justify-center mb-8">
              <X className="w-12 h-12 text-muted opacity-20" />
            </div>
            <p className="text-sm uppercase font-black tracking-[0.4em] text-muted">
              Null result // No matches found in archive
            </p>
          </div>
        )}
      </div>
    </div>
  </section>
);
}



