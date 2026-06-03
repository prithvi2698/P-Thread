import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ShieldCheck, Truck, CreditCard, User, MapPin, PackageCheck, Tag, Ticket, Smartphone, Wallet, QrCode, Maximize2, X } from 'lucide-react';
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
  'ASIA_PAC': 150,
  'EUROPE': 250,
  'NORTH_AMERICA': 300,
  'GLOBAL': 400,
};

const COUNTRY_REGIONS: Record<string, string> = {
  'India': 'INDIA',
  'Japan': 'ASIA_PAC',
  'South Korea': 'ASIA_PAC',
  'Singapore': 'ASIA_PAC',
  'Australia': 'ASIA_PAC',
  'New Zealand': 'ASIA_PAC',
  'USA': 'NORTH_AMERICA',
  'Canada': 'NORTH_AMERICA',
  'UK': 'EUROPE',
  'Germany': 'EUROPE',
  'France': 'EUROPE',
  'Italy': 'EUROPE',
  'Spain': 'EUROPE',
  'Others': 'GLOBAL',
};

const REGION_LOGISTICS: Record<string, string> = {
  'INDIA': 'Surface Protocol // 3-5 Cycles',
  'ASIA_PAC': 'Air Freight // 7-10 Cycles',
  'EUROPE': 'Intercontinental // 10-14 Cycles',
  'NORTH_AMERICA': 'Intercontinental // 10-14 Cycles',
  'GLOBAL': 'Deep Sector Logistics // 14-21 Cycles',
};

export default function Checkout({ cart, onComplete, user, onLoginToggle }: CheckoutProps) {
  const navigate = useNavigate();
  const rzpKey = (import.meta as any).env.VITE_RAZORPAY_KEY_ID || '';
  const isKeyMissingOrPlaceholder = !rzpKey || rzpKey.trim() === '' || rzpKey.includes('YOUR_');

  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'GATEWAY' | 'SCAN_PAY'>(isKeyMissingOrPlaceholder ? 'SCAN_PAY' : 'GATEWAY');
  const [couponInput, setCouponInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [activeCoupon, setActiveCoupon] = useState('');
  const [logisticsError, setLogisticsError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [useDemoPayment, setUseDemoPayment] = useState(isKeyMissingOrPlaceholder);
  const [utrNumber, setUtrNumber] = useState(() => Math.floor(100000000000 + Math.random() * 900000000000).toString());
  const [utrError, setUtrError] = useState('');
  const [showScannerPopup, setShowScannerPopup] = useState(false);
  const [copiedUPILink, setCopiedUPILink] = useState(false);
  const [upiAddress, setUpiAddress] = useState('p-thread@axisbank');
  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [tempUpi, setTempUpi] = useState('p-thread@axisbank');

  const copyUPIAddress = () => {
    navigator.clipboard.writeText(upiAddress);
    setCopiedUPILink(true);
    setTimeout(() => setCopiedUPILink(false), 2000);
  };
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
  const shippingLabel = REGION_LOGISTICS[shippingRegion];
  const total = Math.max(0, subtotal + shipping - appliedDiscount);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const performMockPayment = async () => {
    setProcessState('INITIATING_MOCK_ALLOCATION');
    await new Promise(r => setTimeout(r, 1500));
    
    setProcessState('DISPATCHING_MOCK_RECEIPT');
    try {
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
          paymentId: `MOCK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
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
      setPaymentError(`MOCK_SYNC_ERROR: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const performScanPayPayment = async (utr: string) => {
    setProcessState('RESOLVING_TRANSACTION_MANIFEST');
    await new Promise(r => setTimeout(r, 1500));
    
    setProcessState('DISPATCHING_SECURE_RECEIPT');
    try {
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
          paymentId: `UPI-SCAN-${utr}`,
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
      setPaymentError(`UPI_SYNC_ERROR: ${error.message}`);
      setIsProcessing(false);
    }
  };

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

      if (!user) {
        setPaymentError('AUTH_REQUIRED // SYNCHRONIZING_TERMINAL');
        onLoginToggle();
        return;
      }

      setIsProcessing(true);

      if (paymentMethod === 'SCAN_PAY') {
        const finalUtr = utrNumber.trim() || Math.floor(100000000000 + Math.random() * 900000000000).toString();
        setUtrError('');
        await performScanPayPayment(finalUtr);
        return;
      }

      if (useDemoPayment) {
        await performMockPayment();
        return;
      }

      // IDENTITY VERIFICATION CHECKPOINT
      if (typeof (window as any).Razorpay === 'undefined') {
        setProcessState('GATEWAY_SYNC_PENDING // PLEASE_WAIT');
        
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

      // Razorpay Integration
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
          let hintMessage = '';
          if (contentType && contentType.includes("application/json")) {
            const errorData = await orderRes.json();
            errorMsg = errorData.error || errorMsg;
            hintMessage = errorData.hint ? ` // ${errorData.hint}` : '';
          } else {
            const text = await orderRes.text();
            console.error("Non-JSON Error Response:", text);
            errorMsg = `SERVER_ERROR (${orderRes.status})`;
          }
          throw new Error(`${errorMsg}${hintMessage}`);
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
            setPaymentError('');
            
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

                {/* Payment Method Tabs */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('GATEWAY');
                      setPaymentError('');
                    }}
                    className={`p-5 border text-[10px] font-black uppercase tracking-[0.2em] transition-all text-center flex flex-col sm:flex-row items-center justify-center gap-3 cursor-pointer ${
                      paymentMethod === 'GATEWAY'
                        ? 'bg-accent border-accent text-white shadow-[0_0_20px_rgba(230,30,30,0.15)] font-black'
                        : 'bg-surface border-white/10 text-muted hover:border-white/20'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 shrink-0" />
                    <span>01 // ONLINE GATEWAY</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('SCAN_PAY');
                      setPaymentError('');
                    }}
                    className={`p-5 border text-[10px] font-black uppercase tracking-[0.2em] transition-all text-center flex flex-col sm:flex-row items-center justify-center gap-3 cursor-pointer ${
                      paymentMethod === 'SCAN_PAY'
                        ? 'bg-accent border-accent text-white shadow-[0_0_20px_rgba(230,30,30,0.15)] font-black'
                        : 'bg-surface border-white/10 text-muted hover:border-white/20'
                    }`}
                  >
                    <QrCode className="w-4 h-4 shrink-0" />
                    <span>02 // UPI SCAN & PAY</span>
                  </button>
                </div>

                {paymentMethod === 'GATEWAY' ? (
                  <div className="p-8 bg-surface border border-white/5 space-y-6">
                    {((import.meta as any).env.VITE_RAZORPAY_KEY_ID || '').startsWith('rzp_test_') && (
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 mb-4">
                        <p className="text-[10px] font-mono text-blue-400 uppercase leading-relaxed">
                          <span className="text-white font-bold">[TEST_MODE_ACTIVE]</span> // Use Razorpay test cards (e.g., 4111...) for simulation. 
                          If using international cards, ensure "International Payments" is enabled in your Razorpay Dashboard.
                        </p>
                      </div>
                    )}

                    {isKeyMissingOrPlaceholder && (
                      <div className="p-6 bg-accent/10 border border-accent/20 space-y-4">
                        <div className="flex items-center gap-3">
                          <Ticket className="w-4 h-4 text-accent" />
                          <span className="text-[10px] font-black uppercase text-accent tracking-widest">Gateway Configuration Missing</span>
                        </div>
                        <p className="text-[10px] font-mono text-muted uppercase leading-relaxed">
                          To enable real payments, go to <span className="text-white">Settings &gt; API Keys</span> and set <span className="text-accent underline">VITE_RAZORPAY_KEY_ID</span>.
                        </p>
                        <button
                          onClick={() => setUseDemoPayment(!useDemoPayment)}
                          className={`w-full p-4 border text-[10px] font-black uppercase tracking-[0.2em] transition-all ${useDemoPayment ? 'bg-accent border-accent text-white' : 'bg-surface border-white/10 text-muted'}`}
                        >
                          {useDemoPayment ? '[DEMO_MODE_ACTIVE]' : 'ACTIVATE_DEMO_BYPASS'}
                        </button>
                      </div>
                    )}

                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-accent">Summary manifest</span>
                      <p className="text-xs font-mono text-muted uppercase leading-relaxed">
                        You are about to initiate a secure acquisition transfer of <span className="text-white">₹{total}</span> to P-THREAD.
                        {useDemoPayment ? ' [SIMULATED_TRANSACTION]' : ' All transactions are protected via 256-bit AES encryption.'}
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
                ) : (
                  <div className="p-8 bg-surface border border-white/5 space-y-6">
                    <div className="text-center space-y-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-accent block">UPI Scan to Authorize Transfer</span>
                      
                      {/* Beautiful QR Code Scanner styling with popup cursor */}
                      <div 
                        onClick={() => setShowScannerPopup(true)}
                        className="relative w-48 h-48 mx-auto bg-[#050505] border border-white/10 p-2 overflow-hidden flex items-center justify-center group shadow-[0_0_30px_rgba(230,30,30,0.08)] cursor-pointer hover:border-accent/40 transition-all duration-300"
                        title="Click to zoom scan target"
                      >
                        {/* Scanning Line anim */}
                        <motion.div 
                          className="absolute left-0 right-0 h-[2px] bg-accent opacity-75 z-20"
                          animate={{ top: ['0%', '100%', '0%'] }}
                          transition={{ repeat: Infinity, duration: 2.2, ease: 'linear' }}
                        />
                        {/* Direct high-res dynamic UPI QR Code */}
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`upi://pay?pa=${upiAddress}&pn=P-THREAD&am=${total}&cu=INR`)}`}
                          alt="UPI scan and pay routing manifest to secure gateway"
                          className="w-full h-full object-contain relative z-10 group-hover:scale-105 transition-transform duration-300 bg-white p-1.5"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/80 py-2.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 border-t border-accent/25">
                          <Maximize2 className="w-3 h-3 text-accent animate-pulse" />
                          <span className="text-[8px] font-black text-accent uppercase tracking-widest">ENLARGE SCAN TARGET</span>
                        </div>
                        <div className="absolute inset-0 border-2 border-accent/10 pointer-events-none group-hover:border-accent/25 transition-colors" />
                      </div>

                      <div className="space-y-4 mt-4 max-w-sm mx-auto">
                        <span className="text-[10px] font-mono text-accent uppercase block">[TRANSACTION_MATRIX_TOTAL: ₹{total}]</span>
                        <p className="text-[10px] font-mono text-muted uppercase leading-relaxed">
                          Scan the QR above using your preferred UPI provider (GPay, PhonePe, Paytm, BHIM). Ensure the amount is exactly <span className="text-white">₹{total}</span>.
                        </p>

                        <div className="bg-[#111] p-4 border border-white/5 space-y-3 text-left">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-black text-muted uppercase tracking-widest">Payee UPI VPA</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditingUpi) {
                                  const trimmed = tempUpi.trim();
                                  if (trimmed) {
                                    setUpiAddress(trimmed);
                                  }
                                } else {
                                  setTempUpi(upiAddress);
                                }
                                setIsEditingUpi(!isEditingUpi);
                              }}
                              className="text-[9px] font-black text-accent hover:underline uppercase"
                            >
                              {isEditingUpi ? '[ SAVE ]' : '[ EDIT ]'}
                            </button>
                          </div>
                          {isEditingUpi ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={tempUpi}
                                onChange={(e) => setTempUpi(e.target.value)}
                                className="flex-1 bg-black border border-white/10 p-2 text-xs font-mono text-white focus:border-accent outline-none"
                                placeholder="your-registered-id@upi"
                              />
                            </div>
                          ) : (
                            <div className="flex justify-between items-center bg-black/40 p-2 border border-white/5">
                              <p className="text-[10px] font-mono text-white select-all">{upiAddress}</p>
                              <button
                                type="button"
                                onClick={copyUPIAddress}
                                className="text-[9px] text-accent font-mono uppercase hover:underline"
                              >
                                {copiedUPILink ? 'COPIED' : 'COPY'}
                              </button>
                            </div>
                          )}
                          <p className="text-[8px] font-mono text-muted uppercase leading-relaxed">
                            Since GPay account registration may be required on real phones, the sandbox simulation auto-generates a clearance sequence below. You can proceed directly to authorize and place the order.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowScannerPopup(true)}
                          className="inline-flex items-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 hover:border-accent/40 text-white text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2.5 transition-all text-center mx-auto cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3 text-accent" />
                          Launch Fullscreen QR Scanner
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4 border-t border-white/5 pt-6 text-center">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-accent tracking-[0.2em] block">
                          [DEMO_CLEARANCE_MODE_ACTIVE]
                        </span>
                        <p className="text-[10px] font-mono text-muted uppercase">
                          Reference Sequence: <span className="text-white font-bold">{utrNumber}</span>
                        </p>
                      </div>

                      <div className="space-y-1 text-left">
                        <span className="text-[8px] font-black uppercase text-muted tracking-widest block">Important Clearance Policy</span>
                        <p className="text-[9px] font-mono text-muted uppercase leading-relaxed">
                          The transaction will be verified sequentially by our clearing network. Delivery logistics will update dynamically upon clearance.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
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
          <div className="flex justify-between items-start text-[10px] font-black uppercase tracking-widest text-muted">
            <div className="flex flex-col">
              <span>Shipping Matrix</span>
              <span className="text-[8px] text-accent/50 font-mono tracking-normal leading-tight mt-1">{formData.country.toUpperCase()} // {shippingLabel}</span>
            </div>
            <span>{shipping > 0 ? `₹${shipping}` : 'ALLOCATED'}</span>
          </div>
          <div className="flex justify-between items-center text-xl font-black uppercase tracking-tighter text-ink pt-4 border-t border-white/5">
            <span>Critical Total</span>
            <span className="text-accent italic">₹{total}</span>
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

      {/* Scanner Popup Modal */}
      <AnimatePresence>
        {showScannerPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 p-6 md:p-8 space-y-6 shadow-[0_0_80px_rgba(230,30,30,0.15)] overflow-y-auto max-h-[90vh]"
            >
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-accent" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-accent" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-accent" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-accent" />

              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-accent uppercase tracking-[0.3em] block">// SECURE_UPI_GATEWAY</span>
                  <h3 className="text-sm font-black uppercase tracking-wider text-ink flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-accent" />
                    AUTHORIZE_TRANSFER_PROTOCOL
                  </h3>
                </div>
                <button
                  onClick={() => setShowScannerPopup(false)}
                  className="p-2 border border-white/15 bg-white/5 hover:border-accent hover:text-accent transition-colors text-white cursor-pointer"
                  aria-label="Close Scanner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main Scanner Visualizer */}
              <div className="text-center space-y-4">
                <div className="relative w-56 h-56 mx-auto bg-[#030303] border border-accent/20 p-3 overflow-hidden flex items-center justify-center group shadow-[0_0_40px_rgba(230,30,30,0.12)]">
                  {/* Glowing corners */}
                  <div className="absolute inset-0 pointer-events-none border border-accent/10" />
                  
                  {/* Real-time scanning laser bar */}
                  <motion.div 
                    className="absolute left-0 right-0 h-[2.5px] bg-accent opacity-90 z-20 shadow-[0_0_12px_#e61e1e]"
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  />

                   {/* High Resolution dynamic UPI QR Code */}
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`upi://pay?pa=${upiAddress}&pn=P-THREAD&am=${total}&cu=INR`)}`}
                    alt="P-THREAD UPI Scan Target Manifest"
                    className="w-full h-full object-contain relative z-10 filter contrast-125 bg-white p-2.5"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-2xl font-black text-white italic tracking-tighter block">₹{total}</span>
                  <span className="text-[10px] font-mono text-accent uppercase tracking-widest block">[VERIFIED AMOUNT IN PROGRESS]</span>
                </div>
              </div>

              {/* Quick Copy UPI Address ID */}
              <div className="bg-[#111] p-4 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-black text-muted uppercase tracking-widest">Store UPI String Address</span>
                  {copiedUPILink ? (
                    <span className="text-[8px] font-mono text-green-400 uppercase tracking-widest">[ COPIED_TO_CLIPBOARD ]</span>
                  ) : (
                    <span className="text-[8px] font-mono text-muted uppercase tracking-widest">[ CLICK_TO_COPY ]</span>
                  )}
                </div>
                <div 
                  onClick={copyUPIAddress}
                  className="flex items-center justify-between bg-[#070707] border border-white/5 p-3 font-mono text-[10px] text-white hover:border-accent/40 cursor-pointer transition-colors"
                >
                  <span className="tracking-wider">{upiAddress}</span>
                  <span className="text-accent hover:underline text-[9px] font-black uppercase text-[10px]">COPY</span>
                </div>
              </div>

              {/* Instructions and Input */}
              <div className="space-y-4">
                <div className="space-y-1 text-center md:text-left">
                  <p className="text-[10px] font-mono text-muted uppercase leading-relaxed text-left">
                    Sandbox clearance mode is active. You can complete the simulation immediately without making any physical UPI transfers.
                  </p>
                </div>

                <div className="space-y-2 pt-4 border-t border-white/10 text-center">
                  <span className="text-[9px] font-black uppercase text-accent tracking-[0.2em] block">
                    [SIMULATION_TRACKING_ACTIVE]
                  </span>
                  <p className="text-[10px] font-mono text-muted uppercase">
                    Auto-generated Trace: <span className="text-white font-bold">{utrNumber}</span>
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const finalUtr = utrNumber.trim() || Math.floor(100000000000 + Math.random() * 900000000000).toString();
                      setUtrError('');
                      setShowScannerPopup(false);
                      setIsProcessing(true);
                      await performScanPayPayment(finalUtr);
                    }}
                    className="w-full bg-accent text-white py-5 text-xs font-black uppercase tracking-[0.4em] hover:bg-white hover:text-bg transition-all shadow-[0_0_20px_rgba(230,30,30,0.15)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    SUBMIT CLEARANCE & VERIFY
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
