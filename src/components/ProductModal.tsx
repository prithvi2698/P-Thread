import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, Heart, Share2, ShieldCheck, Truck, Check, Minus, Plus, Play, ChevronLeft, ChevronRight, RefreshCw, MapPin, Ruler } from 'lucide-react';
import { Product } from '../types';
import ProductReviews from './ProductReviews';
import { checkServiceability, LogisticsReport } from '../lib/logistics';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, color: string, size: string, quantity: number) => void;
  onWishlistToggle: (productId: string) => void;
  isWishlisted: boolean;
  user: { name: string; email: string; uid: string } | null;
  onLoginPrompt: () => void;
}

export default function ProductModal({ 
  product, 
  onClose, 
  onAddToCart, 
  onWishlistToggle,
  isWishlisted,
  user,
  onLoginPrompt
}: ProductModalProps) {
  const [selectedColor, setSelectedColor] = useState(product?.colors?.[0]?.name || '');
  const [selectedSize, setSelectedSize] = useState(product?.sizes?.[0] || '');
  const [quantity, setQuantity] = useState(1);
  const [showVideo, setShowVideo] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [shareFeedback, setShareFeedback] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [pincode, setPincode] = useState('');
  const [logisticsReport, setLogisticsReport] = useState<LogisticsReport | null>(null);
  const [isCheckingLogistics, setIsCheckingLogistics] = useState(false);
  const [lastProductId, setLastProductId] = useState<string | null>(null);

  useEffect(() => {
    if (product && product.id !== lastProductId) {
      setSelectedColor(product.colors?.[0]?.name || '');
      setSelectedSize(product.sizes?.[0] || '');
      setQuantity(1);
      setCurrentImageIndex(0);
      setShowVideo(false);
      setVideoError(false);
      setLogisticsReport(null);
      setPincode('');
      setLastProductId(product.id);
    }
  }, [product, lastProductId]);

  if (!product) return null;

  const accentColor = product.name.startsWith('BTS //') ? '#8b5cf6' : 'var(--color-accent)';

  const handleShare = async () => {
    const shareData = {
      title: `P-THREAD // ${product.name}`,
      text: `Tactical Archive: ${product.description}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareFeedback(true);
        setTimeout(() => setShareFeedback(false), 3000); // Reset after 3 seconds
      }
    } catch (err) {
      console.error('Share_Protocol_Failure:', err);
    }
  };

  const getImages = () => {
    const list: string[] = [];
    if (product.image) list.push(product.image);
    if (product.images && product.images.length > 0) {
      product.images.forEach(img => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    return list.length > 0 ? list : ['https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1000&auto=format&fit=crop'];
  };

  const images = getImages();

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed || window.innerWidth < 768) return;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPos({ x, y });
  };

  const handleEstimate = () => {
    if (pincode.length !== 6) return;
    setIsCheckingLogistics(true);
    setLogisticsReport(null);
    
    // Simulate tactical sync
    setTimeout(() => {
      const report = checkServiceability(pincode);
      setLogisticsReport(report);
      setIsCheckingLogistics(false);
    }, 1200);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-8 bg-bg/95 backdrop-blur-xl"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-5xl bg-surface border border-white/5 overflow-hidden flex flex-col md:flex-row h-full max-h-[90vh] md:max-h-[95vh] overflow-y-auto md:overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 md:top-6 md:right-6 z-30 p-2 bg-bg border border-white/10 hover:border-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Left: Image Gallery */}
          <div 
            className="w-full md:w-1/2 aspect-square bg-bg flex items-center justify-center relative group overflow-hidden shrink-0 cursor-zoom-in"
            onMouseEnter={() => {
              if (window.innerWidth >= 768) setIsZoomed(true);
            }}
            onMouseLeave={() => {
              setIsZoomed(false);
              setZoomPos({ x: 50, y: 50 });
            }}
            onMouseMove={handleMouseMove}
          >
             {showVideo && product.video ? (
                <div className="absolute inset-0 z-10 bg-bg flex flex-col items-center justify-center">
                   {videoError ? (
                     <div className="flex flex-col items-center gap-6 p-10 text-center">
                        <div className="w-16 h-16 border border-accent/20 flex items-center justify-center mb-4">
                           <Play className="w-8 h-8 text-accent opacity-20" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted max-w-[200px]">
                           Archival Media Sync Failed // Access Denied By Host
                        </p>
                        <a 
                          href={(() => {
                            const idMatch = product.video.match(/[-\w]{25,}/);
                            const id = idMatch ? idMatch[0] : '';
                            return id ? `https://drive.google.com/file/d/${id}/view` : product.video;
                          })()}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-accent/10 hover:bg-accent border border-accent/20 text-accent hover:text-white px-6 py-3 text-[8px] font-black uppercase tracking-widest transition-all"
                        >
                          Open External Lookbook
                        </a>
                     </div>
                   ) : (
                    <video 
                      className="w-full h-full object-cover" 
                      autoPlay 
                      loop 
                      muted 
                      playsInline
                      crossOrigin="anonymous"
                      onError={() => {
                        console.error("Video Archive Load Failure: The media asset could not be synchronized.");
                        setVideoError(true);
                      }}
                    >
                      <source src={product.video} type="video/mp4" />
                      <source src={product.video.replace('&export=media', '&export=download')} type="video/mp4" />
                      Archive synchronization failed.
                    </video>
                   )}
                   <button 
                     onClick={() => {
                       setShowVideo(false);
                       setVideoError(false);
                     }}
                     className="absolute top-4 left-4 bg-bg/80 hover:bg-accent hover:text-white text-accent px-4 py-2 text-[8px] font-black uppercase tracking-widest border border-accent/20 transition-all z-20"
                   >
                     Exit Lookbook
                   </button>
                </div>
             ) : (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.img 
                      key={currentImageIndex}
                      src={images[currentImageIndex] || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1000&auto=format&fit=crop'} 
                      alt={`${product.name} ${currentImageIndex + 1}`} 
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ 
                        opacity: 1, 
                        scale: (isZoomed && window.innerWidth >= 768) ? 2 : 1, 
                        x: 0,
                        transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`
                      }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ 
                        duration: isZoomed ? 0.15 : 0.4, 
                        ease: isZoomed ? "linear" : [0.22, 1, 0.36, 1] 
                      }}
                      className="w-full h-full object-contain pointer-events-none md:pointer-events-auto scale-105"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1000&auto=format&fit=crop';
                      }}
                    />
                  </AnimatePresence>

                  {/* Zoom Indicator */}
                  <AnimatePresence>
                    {isZoomed && (
                      <motion.div 
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       exit={{ opacity: 0 }}
                       className="absolute top-12 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-[8px] font-black uppercase tracking-[0.5em] text-accent bg-bg/80 px-4 py-1 border border-accent/20 backdrop-blur-md shadow-[0_0_20px_rgba(230,30,30,0.2)]">
                            Optical_Magnification // {Math.round(zoomPos.x)}X:{Math.round(zoomPos.y)}Y
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {images.length > 1 && !showVideo && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); prevImage(); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-24 md:w-10 md:h-20 flex items-center justify-center bg-bg/60 backdrop-blur-lg border border-white/10 hover:border-accent text-white hover:text-accent transition-all duration-300 opacity-100 md:opacity-0 md:group-hover:opacity-100 z-20"
                        title="ARCHIVE_PREV"
                      >
                        <ChevronLeft className="w-8 h-8 md:w-6 md:h-6" />
                        <div className="absolute inset-y-2 left-0 w-[1px] bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); nextImage(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-24 md:w-10 md:h-20 flex items-center justify-center bg-bg/60 backdrop-blur-lg border border-white/10 hover:border-accent text-white hover:text-accent transition-all duration-300 opacity-100 md:opacity-0 md:group-hover:opacity-100 z-20"
                        title="ARCHIVE_NEXT"
                      >
                        <ChevronRight className="w-8 h-8 md:w-6 md:h-6" />
                        <div className="absolute inset-y-2 right-0 w-[1px] bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>

                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                        {images.map((img, idx) => (
                          <button 
                            key={idx}
                            onClick={() => setCurrentImageIndex(idx)}
                            className={`w-10 h-10 border transition-all overflow-hidden bg-surface ${currentImageIndex === idx ? 'border-accent scale-110 shadow-lg' : 'border-white/10 opacity-60 hover:opacity-100'}`}
                          >
                            <img src={img} className="w-full h-full object-cover" alt={`Archive Thumb ${idx}`} referrerPolicy="no-referrer" />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
             )}
             <div className="absolute inset-4 border border-white/5 pointer-events-none" />
             <div className="absolute top-4 left-4 w-6 h-[1px] bg-accent" />
             <div className="absolute top-4 left-4 h-6 w-[1px] bg-accent" />

             {product.video && !showVideo && (
                <motion.button 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setShowVideo(true)}
                  className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-accent/90 hover:bg-white text-white hover:text-bg px-6 py-3 text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-2 shadow-[0_0_30px_rgba(230,30,30,0.5)] transition-all"
                >
                  <Play className="w-3 h-3" />
                  Visual Lookbook
                </motion.button>
             )}
          </div>

          {/* Right: Product Info */}
          <div className="w-full md:w-1/2 p-5 sm:p-6 md:p-10 flex flex-col bg-surface border-t md:border-t-0 md:border-l border-white/5 overflow-y-auto md:custom-scrollbar pb-10">
            <div className="mb-6 md:mb-8">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-accent block mb-2">
                Serial // {product.category}
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-display uppercase tracking-tighter mb-4 leading-none">{product.name}</h2>
              <div className="flex flex-wrap items-center gap-4 md:gap-6">
                {product.price !== undefined ? (
                  <>
                    <div className="flex items-baseline gap-3">
                      {product.originalPrice && (
                        <span className="text-sm md:text-lg font-mono font-bold text-muted line-through opacity-40 italic">₹{product.originalPrice}.00</span>
                      )}
                      <span className="text-lg sm:text-xl md:text-2xl font-mono font-bold text-white">₹{product.price}.00</span>
                    </div>
                    <span className="px-3 py-1 bg-accent/10 border border-accent/20 text-accent text-[8px] font-black uppercase tracking-widest">
                      {product.stock && product.stock <= 5 
                        ? `CRITICAL_INVENTORY // ONLY ${product.stock} REMAINING`
                        : product.stock === 0
                        ? 'MANIFEST_EXHAUSTED // ARCHIVED'
                        : `IN_STOCK // SECURE_IMMEDIATELY [${product.stock || 10}]`}
                    </span>
                  </>
                ) : (
                  <span className="px-3 py-1 bg-accent/10 border border-accent/20 text-accent text-[10px] font-black uppercase tracking-[0.3em]">
                    Logistical_Demonstration // Not For Acquisition
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs sm:text-sm text-muted font-medium leading-relaxed uppercase tracking-tight mb-8 md:mb-10 pb-8 md:pb-10 border-b border-white/5">
              {product.description}
            </p>

            {product.price !== undefined && (
              <div className="space-y-10 mb-12">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted block mb-4">Select Variant</span>
                  <div className="flex gap-3">
                    {product.colors.map(color => (
                      <button 
                        key={color.name}
                        onClick={() => {
                          setSelectedColor(color.name);
                          if (color.imageIndex !== undefined) {
                            setCurrentImageIndex(color.imageIndex);
                          }
                        }}
                        className="group flex flex-col items-center gap-2"
                      >
                        <div 
                          className={`w-10 h-10 border-2 transition-all p-1 relative ${selectedColor === color.name ? 'border-accent scale-110 shadow-[0_0_15px_rgba(230,30,30,0.3)]' : 'border-white/10 hover:border-white/30'}`}
                        >
                          <div className="w-full h-full" style={{ backgroundColor: color.hex }} />
                          {selectedColor === color.name && (
                            <div className="absolute -top-1 -right-1 bg-accent text-white rounded-full">
                              <Check className="w-2 h-2" />
                            </div>
                          )}
                        </div>
                        <span className={`text-[8px] font-bold uppercase tracking-widest transition-opacity ${selectedColor === color.name ? 'text-accent opacity-100' : 'opacity-40 group-hover:opacity-100'}`}>
                          {color.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted block">Select Dimension</span>
                    <button 
                      onClick={() => setShowSizeChart(true)}
                      className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-accent hover:text-white transition-colors group"
                    >
                      <Ruler className="w-3 h-3 group-hover:rotate-12 transition-transform" />
                      Size Guide
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map(size => (
                      <button 
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`px-6 py-3 border text-xs font-black uppercase tracking-widest transition-all ${
                          selectedSize === size 
                            ? 'bg-white text-bg border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' 
                            : 'border-white/10 hover:border-white/30 text-muted hover:text-white'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted block mb-4">Quantity</span>
                  <div className="flex items-center gap-6 border border-white/10 w-fit p-1">
                    <button 
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="p-2 hover:bg-white/5 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl font-mono font-bold w-12 text-center">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(q => {
                        const next = q + 1;
                        if (product.stock !== undefined && next > product.stock) return q;
                        return next;
                      })}
                      className="p-2 hover:bg-white/5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-auto space-y-4 pt-10 border-t border-white/5">
              <div className="flex gap-4">
                {product.price !== undefined && (
                  <button 
                    onClick={() => {
                      onAddToCart(product, selectedColor, selectedSize, quantity);
                      onClose();
                    }}
                    disabled={product.stock === 0}
                    style={{ 
                      backgroundColor: product.stock === 0 ? '#333' : accentColor, 
                      boxShadow: product.stock === 0 ? 'none' : `0 10px 30px ${accentColor === '#8b5cf6' ? 'rgba(139,92,246,0.2)' : 'rgba(230,30,30,0.2)'}`,
                      cursor: product.stock === 0 ? 'not-allowed' : 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      if (product.stock === 0) return;
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.color = accentColor;
                    }}
                    onMouseLeave={(e) => {
                      if (product.stock === 0) return;
                      e.currentTarget.style.backgroundColor = accentColor;
                      e.currentTarget.style.color = 'white';
                    }}
                    className="flex-1 text-white py-5 text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    {product.stock === 0 ? 'MANIFEST_EXHAUSTED' : 'Acquire Item'}
                  </button>
                )}
                <button 
                  onClick={() => onWishlistToggle(product.id)}
                  className={`px-6 border border-white/10 flex items-center justify-center transition-all ${
                    isWishlisted ? 'bg-white text-bg' : ''
                  } ${product.price === undefined ? 'flex-1 py-5' : ''}`}
                  style={!isWishlisted ? { transition: 'all 0.3s' } : { backgroundColor: 'white', color: 'var(--color-bg)' }}
                  onMouseEnter={(e) => {
                    if (!isWishlisted) {
                      e.currentTarget.style.borderColor = accentColor;
                      e.currentTarget.style.color = accentColor;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isWishlisted) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.color = '';
                    }
                  }}
                  title="MARK_SECURE"
                >
                  {product.price !== undefined ? (
                    <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest">Mark for Sync</span>
                  )}
                </button>
                <button 
                   onClick={handleShare}
                   className="px-6 border border-white/10 flex items-center justify-center hover:border-accent hover:text-accent transition-all relative group"
                   title="BROADCAST_LINK"
                >
                  <Share2 className="w-5 h-5" />
                  <AnimatePresence>
                    {shareFeedback && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute -top-12 left-1/2 -translate-x-1/2 bg-accent text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 whitespace-nowrap"
                      >
                        Link_Manifest_Copied
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </div>

              {/* Tactical Specifications Manifold */}
              <div className="mt-12 space-y-8">
                {/* Delivery Estimation */}
                <div className="p-6 bg-bg/40 border border-white/5 space-y-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-accent" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Logistical Estimation</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="ENTER PINCODE" 
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="bg-bg border border-white/10 px-4 py-3 text-[10px] font-mono tracking-widest focus:border-accent outline-none flex-1 transition-colors"
                      maxLength={6}
                    />
                    <button 
                      onClick={handleEstimate}
                      disabled={pincode.length !== 6 || isCheckingLogistics}
                      className="bg-white text-bg px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all disabled:opacity-50"
                    >
                      {isCheckingLogistics ? 'SYNCING...' : 'Estimate'}
                    </button>
                  </div>
                  
                  <AnimatePresence>
                    {logisticsReport && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className={`p-3 border text-[9px] font-black uppercase tracking-widest ${logisticsReport.serviceable ? 'bg-accent/5 border-accent/20 text-accent' : 'bg-white/5 border-white/10 text-muted'}`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{logisticsReport.message}</span>
                          {logisticsReport.serviceable && (
                            <span className="opacity-60 italic">{logisticsReport.estimatedDays} DAYS</span>
                          )}
                        </div>
                        {logisticsReport.serviceable && (
                          <div className="mt-2 text-[8px] opacity-40">
                            SECTOR_UNLOCKED: {logisticsReport.sector}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <p className="text-[8px] font-bold text-muted uppercase tracking-widest">Global Dispatch Within 1-2 Operational Days // Free India-Wide Logistics</p>
                </div>

                {/* Key Highlights */}
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">Tactical Highlights</span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { l: 'Category', v: 'Topwear' },
                      { l: 'Type', v: 'Oversized T-shirt' },
                      { l: 'Fit', v: 'Boxy / Dropped' },
                      { l: 'Fabric', v: '100% Cotton' },
                      { l: 'Closure', v: 'No Closure' },
                      { k: 'Length', v: 'Regular' },
                    ].map(h => (
                      <div key={h.l || h.k} className="flex flex-col gap-1 border-l border-white/10 pl-4 py-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted/50">{h.l || h.k}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white">{h.v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Logistical Manifest & Returns */}
                <div className="space-y-6">
                  {/* Detailed Specs Accordion style */}
                  <details className="group border-b border-white/5 pb-4">
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white group-hover:text-accent transition-colors">Logistical Manifest</span>
                      <Plus className="w-3 h-3 text-white transition-transform group-open:rotate-45" />
                    </summary>
                    <div className="mt-6 grid grid-cols-1 gap-6">
                      <div className="grid grid-cols-2 gap-y-3">
                         {[
                           { k: 'Neck Type', v: 'Round Neck' },
                           { k: 'Pattern', v: 'Typographic Print' },
                           { k: 'Sleeve', v: 'Half Sleeve' },
                           { k: 'Origin', v: 'India' },
                           { k: 'SKU', v: `PT_${product.id}_${product.category.substring(0,3).toUpperCase()}` },
                           { k: 'Care', v: 'Machine Washable' },
                         ].map(item => (
                           <React.Fragment key={item.k}>
                             <span className="text-[9px] font-black uppercase tracking-widest text-muted">{item.k}</span>
                             <span className="text-[9px] font-black uppercase tracking-widest text-white">{item.v}</span>
                           </React.Fragment>
                         ))}
                      </div>
                    </div>
                  </details>

                  <details className="group border-b border-white/5 pb-4">
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white group-hover:text-accent transition-colors">Tactical Logistics & Returns</span>
                      <Plus className="w-3 h-3 text-white transition-transform group-open:rotate-45" />
                    </summary>
                    <div className="mt-6 space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                           <div className="w-8 h-8 shrink-0 bg-accent/10 border border-accent/20 flex items-center justify-center">
                             <Check className="w-4 h-4 text-accent" />
                           </div>
                           <div className="space-y-1">
                             <span className="text-[9px] font-black uppercase tracking-widest text-white">7-Day Return Cycle</span>
                             <p className="text-[8px] font-medium text-muted uppercase leading-relaxed tracking-wider">Items eligible for return/exchange within 7 days of synchronized delivery manifest.</p>
                           </div>
                        </div>
                        <div className="flex items-start gap-4">
                           <div className="w-8 h-8 shrink-0 bg-accent/10 border border-accent/20 flex items-center justify-center">
                             <RefreshCw className="w-4 h-4 text-accent" />
                           </div>
                           <div className="space-y-1">
                             <span className="text-[9px] font-black uppercase tracking-widest text-white">Free Exchange Node</span>
                             <p className="text-[8px] font-medium text-muted uppercase leading-relaxed tracking-wider">No-cost exchanges for alternative archival variants. Hassle-free synchronization.</p>
                           </div>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-white/5">
                         <div className="flex flex-col gap-2 p-4 bg-bg/50 border border-white/5">
                            <span className="text-[8px] font-black tracking-widest text-muted">Tactical Support Node:</span>
                            <span className="text-[10px] font-mono font-bold text-accent">+91 82867 03432</span>
                         </div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>

            <ProductReviews 
              productId={product.id} 
              user={user} 
              onLoginPrompt={onLoginPrompt} 
            />
          </div>
        </motion.div>

        {/* Size Chart Manifestation */}
        <AnimatePresence>
          {showSizeChart && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-bg/95 backdrop-blur-2xl"
              onClick={() => setShowSizeChart(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-2xl w-full bg-surface border border-white/5 p-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute top-4 right-4 z-10">
                  <button 
                    onClick={() => setShowSizeChart(false)}
                    className="p-2 bg-bg border border-white/10 hover:border-accent transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="aspect-[2/3] md:aspect-square w-full overflow-hidden">
                   <img 
                    src="https://lh3.googleusercontent.com/d/17D4qjtsKNrRoAEvPQU0Ovc6IPWlnp2iD" 
                    alt="P-THREAD Size Chart" 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                   />
                </div>
                <div className="p-6 border-t border-white/5">
                  <span className="text-[10px] font-black tracking-widest text-accent uppercase block mb-2">Protocol_Dimensions</span>
                  <p className="text-[9px] font-bold text-muted uppercase tracking-[0.2em] leading-relaxed">
                    All measurements in inches. Designed for an oversized, boxy aesthetic. Recommended to select your standard size for the intended tactical fit.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

