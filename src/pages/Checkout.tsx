import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ShieldCheck, Truck, CreditCard, User, MapPin, PackageCheck, Tag, Ticket, Smartphone, Wallet } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { CartItem } from '../types';
import { checkServiceability } from '../lib/logistics';
import { auth } from '../lib/firebase';

interface CheckoutProps {
  cart: CartItem[];
  onComplete: () => void;
  user: { name: string; email: string; uid: string } | null;
  onLoginToggle: () => void;
}

declare const Razorpay: any;

const VALID_COUPONS: Record<string, number> = {
  'SERIES01': 100, // Flat 100 off
  'P20': 200, // Flat 200 off
  'ARCHIVE50': 500, // Flat 500 off
};

const SHIPPING_MATRIX: Record<string, number> = {
  'INDIA': 50,
  'ASIA': 150,
  'GLOBAL': 300,
};

const COUNTRY_REGIONS: Record<string, string> = {
  'India': 'INDIA',
  'Japan': 'ASIA',
  'South Korea': 'ASIA',
  'Singapore': 'ASIA',
  'USA': 'GLOBAL',
  'UK': 'GLOBAL',
  'Germany': 'GLOBAL',
  'France': 'GLOBAL',
  'Others': 'GLOBAL',
};

export default function Checkout({ cart, onComplete, user, onLoginToggle }: CheckoutProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'GPAY' | 'PHONEPE'>('CARD');
  const [couponInput, setCouponInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [activeCoupon, setActiveCoupon] = useState('');
  const [logisticsError, setLogisticsError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Pre-fill user data if available
    if (user && formData.email === '') {
      const names = user.name.split(' ');
      setFormData(prev => ({
        ...prev,
        email: user.email,
        firstName: names[0] || '',
        lastName: names.slice(1).join(' ') || ''
      }));
    }
  }, [user]);

  useEffect(() => {
    // Focus management: move focus to step heading when step changes
    if (stepHeadingRef.current) {
      stepHeadingRef.current.focus();
    }

    // Proactive Razorpay script loading
    if (typeof (window as any).Razorpay === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, [step]);

  const subtotal = cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const totalSavings = cart.reduce((sum, item) => {
    const savingsPerUnit = (item.originalPrice || item.price || 0) - (item.price || 0);
    return sum + (savingsPerUnit * item.quantity);
  }, 0);
  
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'India',
    cardNumber: '',
    expiry: '',
    cvv: ''
  });

  const shippingRegion = COUNTRY_REGIONS[formData.country] || 'GLOBAL';
  const shipping = SHIPPING_MATRIX[shippingRegion];
  const total = Math.max(0, subtotal + shipping - appliedDiscount);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyCoupon = () => {
    const code = couponInput.toUpperCase().trim();
    if (VALID_COUPONS[code]) {
      setAppliedDiscount(VALID_COUPONS[code]);
      setActiveCoupon(code);
      setCouponError('');
      setCouponInput('');
    } else {
      setCouponError('INVALID_PROTOCOL_CODE');
      setAppliedDiscount(0);
      setActiveCoupon('');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedDiscount(0);
    setActiveCoupon('');
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [processState, setProcessState] = useState('');
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);

  const handleProceed = async () => {
    if (step === 1) {
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
        setLogisticsError('ACQUIRER_PROFILE_INCOMPLETE // ALL_FIELDS_REQUIRED');
        return;
      }
      if (formData.phone.length < 10) {
        setLogisticsError('INVALID_PHONE_SEQUENCE // MIN_LENGTH_REQUIRED');
        return;
      }
      setLogisticsError('');
      setStep(step + 1);
    } else if (step === 2) {
      // Validate serviceability before moving to payment
      if (formData.country === 'India') {
        const report = checkServiceability(formData.postalCode);
        if (!report.serviceable) {
          setLogisticsError(report.message);
          return;
        }
      }
      if (!formData.address || !formData.city || !formData.postalCode) {
        setLogisticsError('DISPATCH_LOCATION_INCOMPLETE // ALL_FIELDS_REQUIRED');
        return;
      }
      setLogisticsError('');
      setStep(step + 1);
    } else {
      setPaymentError('');
      // IDENTITY VERIFICATION CHECKPOINT
      if (typeof (window as any).Razorpay === 'undefined') {
        setProcessState('GATEWAY_SYNC_PENDING // PLEASE_WAIT');
        setIsProcessing(true);
        
        let attempts = 0;
        const checkScript = setInterval(() => {
          attempts++;
          if (typeof (window as any).Razorpay !== 'undefined') {
            clearInterval(checkScript);
            setIsProcessing(false);
            handleProceed(); // Recursive call once loaded
          } else if (attempts > 50) {
            clearInterval(checkScript);
            setIsProcessing(false);
            setPaymentError('GATEWAY_SYNC_FAILED // CHECK_CONNECTIVITY');
            setProcessState('SYNC_FAILED');
          }
        }, 200);
        return;
      }

      if (!user) {
        setPaymentError('AUTH_REQUIRED // SYNCHRONIZING_TERMINAL');
        onLoginToggle();
        return;
      }

      // Razorpay Integration
      setIsProcessing(true);
      try {
        const razorpayKey = (import.meta as any).env.VITE_RAZORPAY_KEY_ID;

        // Diagnostic Check for Keys
        if (!razorpayKey || razorpayKey.trim() === '' || razorpayKey.includes('YOUR_')) {
          console.error("DIAGNOSTIC_FAILURE // RAZORPAY_KEY_MISSING");
          setPaymentError('GATEWAY_CONFIG_MISSING // Please set VITE_RAZORPAY_KEY_ID in the environment settings to enable payments.');
          setIsProcessing(false);
          return;
        }

        setProcessState('INITIATING_SECURE_GATEWAY');
        const orderRes = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: total })
        });
        
        const contentType = orderRes.headers.get("content-type");
        if (!orderRes.ok) {
          let errorMsg = 'ORDER_PROTOCOL_FAILURE';
          if (contentType && contentType.includes("application/json")) {
            const errorData = await orderRes.json();
            errorMsg = errorData.error || errorMsg;
          } else {
            const text = await orderRes.text();
            console.error("Non-JSON Error Response:", text);
            errorMsg = `SERVER_ERROR (${orderRes.status}): ${text.substring(0, 50)}...`;
          }
          throw new Error(errorMsg);
        }
        
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error('INTERNAL_PROTOCOL_ERROR // Unexpected Response Format');
        }

        const orderData = await orderRes.json();
        // razorpayKey is already declared above

        const options = {
          key: razorpayKey,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "P-THREAD",
          description: "ARCHIVE_ACQUISITION // SERIES_01",
          order_id: orderData.id,
          prefill: {
            name: `${formData.firstName} ${formData.lastName}`,
            email: formData.email,
            contact: formData.phone
          },
          theme: {
            color: "#e61e1e"
          },
          handler: async function (response: any) {
            setProcessState('PAYMENT_VERIFIED // DISPATCHING_RECEIPT');
            
            try {
              // Server-side verification
              const verifyRes = await fetch('/api/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  order_items: cart.map(item => ({
                    id: item.id,
                    quantity: item.quantity
                  }))
                })
              });
              
              const verifyContentType = verifyRes.headers.get("content-type");
              if (!verifyRes.ok) {
                let errorMsg = 'PAYMENT_VERIFICATION_FAILURE';
                if (verifyContentType && verifyContentType.includes("application/json")) {
                  const errorData = await verifyRes.json();
                  errorMsg = errorData.error || errorMsg;
                } else {
                  const text = await verifyRes.text();
                  errorMsg = `VERIFY_ERROR (${verifyRes.status}): ${text.substring(0, 50)}...`;
                }
                throw new Error(errorMsg);
              }

              // BACKEND SYNC: Send Email Receipt via API (Includes SQL and FIRESTORE Sync)
              const receiptRes = await fetch('/api/send-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: formData.email,
                  phone: formData.phone,
                  address: formData.address,
                  city: formData.city,
                  postalCode: formData.postalCode,
                  country: formData.country,
                  shipping,
                  total,
                  paymentId: response.razorpay_payment_id,
                  userId: user?.uid,
                  orderDetails: cart.map((item: any) => ({
                    name: item.name,
                    color: item.selectedColor,
                    size: item.selectedSize,
                    quantity: item.quantity,
                    price: item.price
                  }))
                })
              });
              
              const receiptContentType = receiptRes.headers.get("content-type");
              if (!receiptRes.ok) {
                let errorMsg = 'RECEIPT_DISPATCH_FAILURE';
                if (receiptContentType && receiptContentType.includes("application/json")) {
                  const errorData = await receiptRes.json();
                  errorMsg = errorData.error || errorMsg;
                } else {
                  const text = await receiptRes.text();
                  errorMsg = `RECEIPT_ERROR (${receiptRes.status}): ${text.substring(0, 50)}...`;
                }
                throw new Error(errorMsg);
              }
              
              const receiptData = await receiptRes.json();
              if (receiptData.orderId) {
                setCompletedOrderId(receiptData.orderId);
              }
              
              setIsProcessing(false);
              setIsSuccess(true);
              onComplete();
            } catch (error: any) {
              console.error("Archival Sync Failure:", error);
              setPaymentError(`SYNC_ERROR: ${error.message || 'PLEASE_CONTACT_SUPPORT'}`);
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: function() {
              setIsProcessing(false);
              setPaymentError('ACQUISITION_ABORTED // RE-INITIATE_WHEN_READY');
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } catch (err: any) {
        console.error("Order creation failure:", err);
        setPaymentError(`PROTOCOL_ERROR: ${err.message || 'GATEWAY_TIMEOUT'}`);
        setIsProcessing(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigate('/');
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-8 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-accent flex items-center justify-center mb-12 shadow-[0_0_50px_rgba(230,30,30,0.5)]"
        >
          <PackageCheck className="w-12 h-12 text-white" />
        </motion.div>
        
        <motion.div
           initial={{ y: 20, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           transition={{ delay: 0.3 }}
        >
          <span className="text-[10px] font-black tracking-[0.6em] text-accent uppercase mb-4 block">Acquisition_Successful</span>
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6">Archive Secured.</h2>
          
          {completedOrderId && (
            <div className="mb-10 p-5 bg-surface border border-accent/20 inline-flex flex-col items-center">
              <span className="text-[10px] font-black text-muted uppercase tracking-[0.4em] mb-2 block border-b border-white/5 pb-2 w-full">Manifest_ID</span>
              <span className="text-2xl font-mono text-accent font-bold tracking-[0.2em]">{completedOrderId}</span>
            </div>
          )}

          <p className="text-xs font-mono text-muted uppercase tracking-widest max-w-md mx-auto mb-12 leading-relaxed">
            Your items have been allocated and are moving into the logistics grid. Serial numbers and tracking manifests will be dispatched to your terminal shortly.
          </p>
          
          <button 
            onClick={() => navigate('/')}
            className="group relative bg-white text-bg px-12 py-5 text-xs font-black uppercase tracking-[0.4em] transition-all hover:bg-accent hover:text-white overflow-hidden"
          >
            <span className="relative z-10 text-xs">Return to Operations</span>
            <motion.div 
              className="absolute inset-0 bg-accent translate-y-full group-hover:translate-y-0 transition-transform duration-300"
            />
          </button>
        </motion.div>
      </div>
    );
  }

  if (cart.length === 0 && step !== 3) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-8">
        <div className="w-24 h-24 border border-white/5 flex items-center justify-center mb-8">
          <ChevronLeft className="w-12 h-12 text-muted opacity-20" />
        </div>
        <h2 className="text-xl font-black uppercase tracking-[0.4em] text-muted mb-8">Archive Empty // No Items For Checkout</h2>
        <Link to="/" className="bg-white text-bg px-10 py-4 text-xs font-black uppercase tracking-[0.3em] hover:bg-accent hover:text-white transition-all">
          Return to Archive
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col lg:flex-row">
      {/* Left: Checkout Form */}
      <div className="flex-1 p-5 sm:p-8 md:p-16 lg:p-24 overflow-y-auto">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted hover:text-accent transition-colors mb-12 sm:mb-16"
          aria-label="Abort Mission and return to previous page"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          Abort_Mission // Return
        </button>

        <div className="max-w-2xl">
          <div className="mb-16">
            <span className="text-[10px] font-black tracking-[0.6em] text-accent uppercase mb-2 block">Acquirer_Profile</span>
            <h1 className="text-2xl sm:text-4xl md:text-6xl font-black tracking-tighter uppercase mb-4" tabIndex={-1} ref={stepHeadingRef}>
              Secure Dispatch // Step 0{step}
            </h1>
            <nav className="flex gap-4 mt-8" aria-label="Checkout Progress">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center gap-3">
                  <div 
                    className={`w-8 h-8 flex items-center justify-center text-[10px] font-black border ${step >= s ? 'bg-accent border-accent text-white' : 'border-white/10 text-muted'}`}
                    aria-current={step === s ? 'step' : undefined}
                  >
                    0{s}
                  </div>
                  {s < 3 && <div className={`w-12 h-[1px] ${step > s ? 'bg-accent' : 'bg-white/10'}`} aria-hidden="true" />}
                </div>
              ))}
            </nav>
          </div>

          <div className="space-y-12">
            {step === 1 && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
                role="region"
                aria-labelledby="personal-info-heading"
              >
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <User className="w-4 h-4 text-accent" aria-hidden="true" />
                  <h2 id="personal-info-heading" className="text-xs font-black uppercase tracking-widest text-ink">Personal Information</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-[9px] font-black uppercase text-muted tracking-widest">Email Address</label>
                    <input 
                      id="email"
                      type="email" name="email" value={formData.email} onChange={handleInputChange}
                      className="w-full bg-surface border border-white/10 p-4 text-xs font-mono focus:border-accent outline-none" 
                      placeholder="ACQUIRER@DECRYPTED.NET"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-[9px] font-black uppercase text-muted tracking-widest flex items-center gap-2">
                      <Smartphone className="w-3 h-3 text-accent" />
                      Phone Sequence
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input 
                        id="phone"
                        type="tel" 
                        name="phone"
                        value={formData.phone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d+]/g, '');
                          setFormData(prev => ({ ...prev, phone: val }));
                          setLogisticsError('');
                        }}
                        className={`flex-1 bg-surface border border-white/10 p-4 text-xs font-mono focus:border-accent outline-none min-w-0`} 
                        placeholder="+91 XXXX-XXXXXX"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="firstName" className="text-[9px] font-black uppercase text-muted tracking-widest">First Name</label>
                    <input 
                      id="firstName"
                      type="text" name="firstName" value={formData.firstName} onChange={handleInputChange}
                      className="w-full bg-surface border border-white/10 p-4 text-xs font-mono focus:border-accent outline-none" 
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="lastName" className="text-[9px] font-black uppercase text-muted tracking-widest">Last Name</label>
                    <input 
                      id="lastName"
                      type="text" name="lastName" value={formData.lastName} onChange={handleInputChange}
                      className="w-full bg-surface border border-white/10 p-4 text-xs font-mono focus:border-accent outline-none" 
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
                role="region"
                aria-labelledby="shipping-heading"
              >
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <MapPin className="w-4 h-4 text-accent" aria-hidden="true" />
                  <h2 id="shipping-heading" className="text-xs font-black uppercase tracking-widest text-ink">Shipping Matrix</h2>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="address" className="text-[9px] font-black uppercase text-muted tracking-widest">Street Address</label>
                    <input 
                      id="address"
                      type="text" name="address" value={formData.address} onChange={handleInputChange}
                      className="w-full bg-surface border border-white/10 p-4 text-xs font-mono focus:border-accent outline-none" 
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label htmlFor="country" className="text-[9px] font-black uppercase text-muted tracking-widest">Sector Country</label>
                       <select 
                         id="country"
                         name="country"
                         value={formData.country}
                         onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                         className="w-full bg-surface border border-white/10 p-4 text-xs font-mono focus:border-accent outline-none appearance-none cursor-pointer"
                       >
                         {Object.keys(COUNTRY_REGIONS).map(country => (
                           <option key={country} value={country}>{country.toUpperCase()}</option>
                         ))}
                       </select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="city" className="text-[9px] font-black uppercase text-muted tracking-widest">City</label>
                      <input 
                        id="city"
                        type="text" name="city" value={formData.city} onChange={handleInputChange}
                        className="w-full bg-surface border border-white/10 p-4 text-xs font-mono focus:border-accent outline-none" 
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="postalCode" className="text-[9px] font-black uppercase text-muted tracking-widest">Postal Code</label>
                      <input 
                        id="postalCode"
                        type="text" name="postalCode" value={formData.postalCode} 
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setFormData(prev => ({ ...prev, postalCode: val }));
                          setLogisticsError('');
                        }}
                        className={`w-full bg-surface border ${logisticsError ? 'border-accent' : 'border-white/10'} p-4 text-xs font-mono focus:border-accent outline-none`} 
                        required
                      />
                      <AnimatePresence>
                        {logisticsError && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                            className="text-[9px] font-mono text-accent italic uppercase"
                          >
                            {logisticsError} // SECTOR_RESTRICTED
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
                role="region"
                aria-labelledby="payment-heading"
              >
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <CreditCard className="w-4 h-4 text-accent" aria-hidden="true" />
                  <h2 id="payment-heading" className="text-xs font-black uppercase tracking-widest text-ink">Secure Gateway Authorization</h2>
                </div>

                <div className="p-8 bg-surface border border-white/5 space-y-6">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-accent">Summary manifest</span>
                    <p className="text-xs font-mono text-muted uppercase leading-relaxed">
                      You are about to initiate a secure acquisition transfer of <span className="text-white">₹{total}</span> to P-THREAD.
                      All transactions are protected via 256-bit AES encryption.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black uppercase text-muted tracking-widest">Dispatch Sector</span>
                      <p className="text-[10px] font-mono text-white uppercase">{formData.country} // {formData.city}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-black uppercase text-muted tracking-widest">Acquirer Identity</span>
                      <p className="text-[10px] font-mono text-white uppercase">{formData.firstName} {formData.lastName}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-accent/5 border border-accent/20 flex items-start gap-4">
                    <ShieldCheck className="w-5 h-5 text-accent shrink-0" />
                    <p className="text-[9px] font-mono text-muted uppercase leading-relaxed">
                      BY PROCEEDING, YOU AUTHORIZE THE LOGISTICS SYNC AND ARCHIVE ALLOCATION PROTOCOLS.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Global Error Feedback */}
            <AnimatePresence>
              {(logisticsError || paymentError) && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-accent/10 border border-accent/20 p-4 mt-8"
                >
                  <p className="text-[10px] font-mono text-accent uppercase flex items-center gap-3">
                    <ShieldCheck className="w-3 h-3" />
                    PROTOCOL_ERROR: {logisticsError || paymentError}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Terminal */}
            <div className="flex flex-col sm:flex-row gap-4 mt-12">
              {step > 1 && (
                <button 
                  onClick={handleBack}
                  className="flex-1 bg-surface border border-white/10 text-white py-6 text-xs font-black uppercase tracking-[0.4em] hover:bg-white/5 transition-all flex items-center justify-center gap-3 group"
                >
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  Recall Sequence
                </button>
              )}
              <button 
                onClick={handleProceed}
                disabled={isProcessing}
                className={`${step > 1 ? 'flex-[2]' : 'w-full'} bg-accent text-white py-6 text-xs font-black uppercase tracking-[0.4em] hover:bg-white hover:text-bg transition-all transform hover:scale-[1.02] shadow-[0_0_40px_rgba(230,30,30,0.2)] relative overflow-hidden group disabled:opacity-80 disabled:scale-100 flex items-center justify-center`}
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative z-10">
                  {isProcessing ? (
                    <div className="flex items-center justify-center gap-4">
                      <div className="flex gap-1">
                        <motion.div 
                          animate={{ scaleY: [1, 2, 1] }} 
                          transition={{ repeat: Infinity, duration: 0.6 }} 
                          className="w-0.5 h-3 bg-white" 
                        />
                        <motion.div 
                          animate={{ scaleY: [1, 2, 1] }} 
                          transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} 
                          className="w-0.5 h-3 bg-white" 
                        />
                        <motion.div 
                          animate={{ scaleY: [1, 2, 1] }} 
                          transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} 
                          className="w-0.5 h-3 bg-white" 
                        />
                      </div>
                      <span className="animate-pulse">{processState}</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-3">
                      {step === 3 ? `AUTHORIZE & PAY ₹${total}` : 
                       'MOVE TO NEXT SECTOR'}
                    </span>
                  )}
                </span>
                
                {/* Scanline Effect during processing */}
                {isProcessing && (
                  <motion.div 
                    initial={{ top: '-100%' }}
                    animate={{ top: '200%' }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="absolute left-0 w-full h-1/2 bg-gradient-to-b from-transparent via-white/20 to-transparent pointer-events-none"
                  />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Order Summary */}
      <div className="w-full lg:w-[500px] bg-surface border-l border-white/5 p-8 md:p-16 flex flex-col">
        <div className="mb-12">
          <span className="text-[10px] font-black tracking-[0.6em] text-accent uppercase mb-2 block">Archive_Summary</span>
          <h2 className="text-2xl font-black uppercase tracking-widest">Inventory Manifest</h2>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto custom-scrollbar pr-4">
          {cart.map((item) => (
            <div key={`${item.id}-${item.selectedColor}-${item.selectedSize}`} className="flex gap-6">
              <div className="w-20 h-24 bg-bg border border-white/5 shrink-0 overflow-hidden relative">
                <motion.img 
                  initial={{ scale: 1.3, opacity: 0, x: 20 }}
                  whileInView={{ scale: 1, opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  src={item.image} 
                  alt={item.name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer" 
                />
                <div className="absolute inset-2 border border-white/5 pointer-events-none" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-[10px] font-black uppercase tracking-widest">{item.name}</h3>
                <p className="text-[9px] font-mono text-muted uppercase">
                  {item.selectedColor} // {item.selectedSize} // QTY: {item.quantity}
                </p>
                <div className="flex items-baseline gap-2">
                  {item.originalPrice && (
                    <span className="text-[9px] font-mono text-muted line-through opacity-40 italic">₹{item.originalPrice * item.quantity}</span>
                  )}
                  <p className="text-xs font-mono font-bold text-accent italic">₹{item.price * item.quantity}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-4 border-t border-white/5 pt-8">
          <div className="space-y-4 mb-8">
            <label htmlFor="coupon" className="text-[10px] font-black tracking-[0.6em] text-accent uppercase block">Redeem_Coupon</label>
            <div className="flex gap-2">
              <input 
                id="coupon"
                type="text" 
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="ENTER_DECRYPT_CODE"
                className="flex-1 bg-bg border border-white/10 p-3 text-[10px] font-mono focus:border-accent outline-none uppercase"
                aria-invalid={!!couponError}
                aria-describedby={couponError ? "coupon-error" : undefined}
              />
              <button 
                onClick={handleApplyCoupon}
                className="bg-white text-bg px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all"
              >
                Apply
              </button>
            </div>
            <div aria-live="polite">
              <AnimatePresence>
                {couponError && (
                  <motion.p 
                    id="coupon-error"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] font-mono text-accent italic"
                  >
                    {couponError}
                  </motion.p>
                )}
                {activeCoupon && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-between bg-accent/10 border border-accent/20 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Ticket className="w-3 h-3 text-accent" aria-hidden="true" />
                      <span className="text-[10px] font-mono text-ink uppercase">{activeCoupon} APPLIED</span>
                    </div>
                    <button onClick={handleRemoveCoupon} className="text-[10px] font-mono text-accent hover:underline" aria-label={`Remove coupon ${activeCoupon}`}>REMOVE</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted">
            <span>Manifest Subtotal</span>
            <span>₹{subtotal + totalSavings}</span>
          </div>
          {totalSavings > 0 && (
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-accent italic">
              <span>Protocol Discount</span>
              <span>-₹{totalSavings}</span>
            </div>
          )}
          {appliedDiscount > 0 && (
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-accent italic">
              <span>Coupon Offset</span>
              <span>-₹{appliedDiscount}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted">
            <span>Shipping Matrix</span>
            <span>{shipping > 0 ? `₹${shipping}` : 'FREE'}</span>
          </div>
          <div className="flex justify-between items-center text-xl font-black uppercase tracking-tighter text-ink pt-4">
            <span>Critical Total</span>
            <span className="text-accent">₹{total}</span>
          </div>
        </div>

        <div className="mt-12 space-y-4">
          <div className="flex items-center gap-3 text-[9px] font-bold text-muted uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 text-accent" />
            End-to-end Encrypted Archive Transfer
          </div>
          <div className="flex items-center gap-3 text-[9px] font-bold text-muted uppercase tracking-widest">
            <PackageCheck className="w-4 h-4 text-accent" />
            Verified Serialized Goods
          </div>
        </div>
      </div>
    </div>
  );
}
