import { Plus, Heart, Minus } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, color: string, size: string, quantity: number) => void;
  onWishlistToggle?: (productId: string) => void;
  isWishlisted?: boolean;
  onViewDetails?: (product: Product) => void;
  variant?: 'grid' | 'poster';
  key?: string | number;
  accentColor?: string;
}

export default function ProductCard({ 
  product, 
  onAddToCart, 
  onWishlistToggle, 
  isWishlisted,
  onViewDetails,
  variant = 'grid',
  accentColor = 'var(--color-accent)'
}: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [isHovered, setIsHovered] = useState(false);

  const isPoster = variant === 'poster';
  const hasAltImage = product.images && product.images.length > 1;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative bg-[#0a0a0a] flex flex-col justify-between overflow-hidden ${
        isPoster ? 'min-h-[600px] md:min-h-[800px]' : 'min-h-[400px] md:min-h-[450px]'
      }`}
    >
      <div 
        className={`relative ${isPoster ? 'aspect-auto h-[450px] md:h-[700px]' : 'aspect-[4/5]'} overflow-hidden bg-white/[0.02] flex items-center justify-center cursor-pointer`}
        onClick={() => {
          if (product.price !== undefined) {
            onViewDetails?.(product);
          }
        }}
      >
        <motion.img 
          initial={{ opacity: 0, scale: 1.1 }}
          whileInView={{ opacity: 1, scale: 1 }}
          animate={{ opacity: (isHovered && hasAltImage) ? 0.3 : 1, filter: (isHovered && hasAltImage) ? 'blur(15px)' : 'blur(0px)' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          src={product.image || (product.images && product.images[0])} 
          alt={product.name} 
          className="w-full h-full object-contain p-8 md:p-12 transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1000&auto=format&fit=crop';
          }}
        />

        {hasAltImage && (
          <motion.img 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ 
              opacity: isHovered ? 1 : 0,
              scale: isHovered ? 1 : 1.1
            }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            src={product.images![1]}
            alt={`${product.name} alternate manifestation`}
            className="absolute inset-0 w-full h-full object-contain p-4 pointer-events-none"
            referrerPolicy="no-referrer"
          />
        )}

        {/* Wishlist Manifold */}
        {product.price !== undefined && (
          <button 
            onClick={() => onWishlistToggle?.(product.id)}
            style={isWishlisted ? { backgroundColor: accentColor } : {}}
            className={`absolute top-2 right-2 md:top-8 md:right-8 p-2 rounded-full backdrop-blur-md transition-all z-20 ${
              isWishlisted ? 'text-white scale-110' : 'bg-black/20 text-white/40 hover:text-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
          </button>
        )}

        {/* Framing lines */}
        <div className="absolute inset-4 border border-white/5 pointer-events-none" />
        <div className="absolute top-4 left-4 w-4 h-[1px]" style={{ backgroundColor: accentColor }} />
        <div className="absolute top-4 left-4 h-4 w-[1px]" style={{ backgroundColor: accentColor }} />
        
        {/* Category Label */}
        <div className="absolute top-4 left-4 md:top-8 md:left-8">
           <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-[0.3em] bg-bg/80 backdrop-blur-sm px-2 py-1 border border-white/10">
            {product.category}
           </span>
        </div>

        {/* Perspective Indicator */}
        {hasAltImage && (
          <div className="absolute bottom-4 right-4 md:bottom-8 md:right-8 z-20">
            <div className="flex items-center gap-2 bg-bg/80 backdrop-blur-sm px-3 py-1.5 border border-white/10">
              <span className="text-[7px] font-black transition-colors" style={isHovered ? { color: 'var(--color-muted)' } : { color: accentColor }}>01</span>
              <div className="w-[8px] h-[1px] bg-white/20" />
              <span className="text-[7px] font-black transition-colors" style={isHovered ? { color: accentColor } : { color: 'var(--color-muted)' }}>02</span>
            </div>
          </div>
        )}

        {/* Marquee removed */}
      </div>

      <div className="p-4 flex justify-between items-end border-t border-white/5">
        <div className="space-y-1">
          <h3 className={`${isPoster ? 'text-2xl md:text-3xl' : 'text-xs md:text-[10px]'} font-bold uppercase tracking-widest leading-tight`}>{product.name}</h3>
          <p className={`${isPoster ? 'text-xs' : 'text-[10px] md:text-[9px]'} text-muted font-normal uppercase tracking-tighter`}>
             {product.colors.map(c => c.name).join(' / ')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {product.price !== undefined ? (
            <>
              <div className="flex flex-col items-end leading-none">
                {product.originalPrice && (
                  <span className="text-[10px] font-mono font-bold text-muted line-through opacity-50 mb-1">₹{product.originalPrice}</span>
                )}
                <span className="text-sm font-mono font-bold" style={{ color: accentColor }}>₹{product.price}</span>
              </div>
              <div className="flex gap-2 mt-1">
                {product.sizes.map(size => (
                  <button
                    key={size}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(product, product.colors[0].name, size, quantity)
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = accentColor}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    className="w-8 h-8 md:w-5 md:h-5 flex items-center justify-center text-[10px] md:text-[8px] font-bold bg-white text-bg hover:text-white transition-colors border border-white/10"
                    title={`Add ${size}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              {/* Quantity Selector */}
              <div className="flex items-center gap-3 mt-1 border border-white/10 px-2 py-1 scale-100 md:scale-90 origin-right">
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setQuantity(q => Math.max(1, q - 1));
                   }}
                   onMouseEnter={(e) => e.currentTarget.style.color = accentColor}
                   onMouseLeave={(e) => e.currentTarget.style.color = ''}
                   className="p-1 text-muted transition-colors"
                 >
                   <Minus className="w-4 h-4 md:w-2.5 md:h-2.5" />
                 </button>
                 <span className="text-xs md:text-[10px] font-mono font-bold w-6 md:w-4 text-center">{quantity}</span>
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setQuantity(q => q + 1);
                   }}
                   onMouseEnter={(e) => e.currentTarget.style.color = accentColor}
                   onMouseLeave={(e) => e.currentTarget.style.color = ''}
                   className="p-1 text-muted transition-colors"
                 >
                   <Plus className="w-4 h-4 md:w-2.5 md:h-2.5" />
                 </button>
              </div>
            </>
          ) : (
            <div className="text-[8px] font-black uppercase tracking-[0.2em] p-2 border bg-opacity-5" style={{ color: accentColor, borderColor: `${accentColor}33`, backgroundColor: `${accentColor}0D` }}>
              Demonstration_Only
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}



