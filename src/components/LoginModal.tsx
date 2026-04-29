import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Lock, ArrowRight, Shield, Command } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile, 
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  AuthCredential
} from 'firebase/auth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: { name: string; email: string; uid: string }) => void;
}

export default function LoginModal({ isOpen, onClose, onLogin }: LoginModalProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [pendingCredential, setPendingCredential] = useState<AuthCredential | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleLinkingIfPending = async (user: any) => {
    if (pendingCredential) {
      try {
        await linkWithCredential(user, pendingCredential);
        setPendingCredential(null);
        setVerificationError('SYNC_SUCCESS: Accounts linked successfully.');
      } catch (linkError: any) {
        console.error("Linking failed:", linkError);
        setVerificationError(`LINK_FAILURE: ${linkError.message}`);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setVerificationError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await handleLinkingIfPending(result.user);
        onLogin({
          name: result.user.displayName || result.user.email?.split('@')[0] || 'ACQUIRER_01',
          email: result.user.email || '',
          uid: result.user.uid
        });
        onClose();
      }
    } catch (error: any) {
      console.error("Google Sync Failure:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setVerificationError('DOMAIN_UNAUTHORIZED: Visit Firebase Console > Auth > Settings > Authorized Domains to allow this URL.');
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        const credential = GoogleAuthProvider.credentialFromError(error);
        setPendingCredential(credential);
        const email = error.customData?.email || formData.email;
        if (email) {
          try {
            const methods = await fetchSignInMethodsForEmail(auth, email);
            const providerName = methods[0]?.split('.')[0] || 'another provider';
            setVerificationError(`CONFLICT: ${email} is linked to ${providerName.toUpperCase()}. Login via ${providerName.toUpperCase()} to auto-sync.`);
          } catch {
            setVerificationError('CONFLICT: Account exists with different provider. Login with existing provider to link.');
          }
        } else {
          setVerificationError('CONFLICT: Account exists with different provider. Login with existing provider to link.');
        }
      } else {
        setVerificationError(error.message || 'GOOGLE_AUTH_PROTOCOL_FAILURE');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setVerificationError('');

    try {
      if (isRegistering) {
        const result = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        await updateProfile(result.user, { displayName: formData.name });
        
        await handleLinkingIfPending(result.user);
        onLogin({
          name: formData.name,
          email: formData.email,
          uid: result.user.uid
        });
        onClose();
      } else {
        const result = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        await handleLinkingIfPending(result.user);
        onLogin({
          name: result.user.displayName || result.user.email?.split('@')[0] || 'ACQUIRER_01',
          email: result.user.email || '',
          uid: result.user.uid
        });
        onClose();
      }
    } catch (error: any) {
      console.error("Authentication failure:", error);
      if (error.code === 'auth/account-exists-with-different-credential') {
        // For email/password, there's no "pending credential" from the error itself in the same way,
        // but if they were trying to sync Facebook/Google and now signed in with email, we can link.
        // Actually the error usually happens when choosing POPUP first.
        setVerificationError('CONFLICT: Account already exists with this email. Please sign in with your original provider.');
      } else {
        setVerificationError(error.message || 'AUTHENTICATION_PROTOCOL_FAILURE');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-bg/90 backdrop-blur-xl"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-surface border border-white/5 p-6 sm:p-10 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Design Elements */}
            <div className="absolute top-0 left-0 w-full h-1 bg-accent pointer-events-none" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex justify-between items-start mb-12">
              <div>
                <span className="text-[10px] font-black tracking-[0.6em] text-accent uppercase mb-2 block">
                  Identity_Portal // {isRegistering ? 'Registration' : 'Authorization'}
                </span>
                <h2 className="text-3xl font-black uppercase tracking-tighter">
                  {isRegistering ? 'Join the Grid' : 'Enter the Grid'}
                </h2>
              </div>
              <button 
                onClick={onClose}
                className="relative z-10 p-2 bg-white/5 hover:bg-accent transition-colors"
                aria-label="Close Terminal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {isRegistering && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-muted tracking-widest flex items-center gap-2">
                    <User className="w-3 h-3 text-accent" />
                    Operator Alias
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-bg border border-white/10 p-4 text-xs font-mono focus:border-accent outline-none"
                    placeholder="NAME_OR_ALIAS"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-muted tracking-widest flex items-center gap-2">
                  <Command className="w-3 h-3 text-accent" />
                  Terminal Identity
                </label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-bg border border-white/10 p-4 text-xs font-mono focus:border-accent outline-none"
                  placeholder="ACQUIRER@ENCRYPTED.NET"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-muted tracking-widest flex items-center gap-2">
                  <Lock className="w-3 h-3 text-accent" />
                  Access Cipher
                </label>
                <input 
                  type="password" 
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-bg border border-white/10 p-4 text-xs font-mono focus:border-accent outline-none"
                  placeholder="••••••••"
                />
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-accent text-white py-5 text-xs font-black uppercase tracking-[0.4em] hover:bg-white hover:text-bg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 mt-4 disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : (isRegistering ? 'Initialize Profile' : 'Gain Access')}
                <ArrowRight className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {verificationError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[9px] font-mono text-accent italic uppercase text-center mt-2"
                  >
                    {verificationError}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="relative flex items-center justify-center py-4">
                <div className="w-full h-[1px] bg-white/5" />
                <span className="absolute bg-surface px-4 text-[8px] font-black uppercase tracking-[0.4em] text-muted">Or Sync Via</span>
              </div>

              <div className="flex flex-col gap-4">
                <button 
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-3 bg-bg border border-white/10 py-4 px-4 text-[9px] font-black uppercase tracking-widest hover:border-accent hover:text-accent transition-all group disabled:opacity-50 w-full"
                  title="Google Authentication"
                >
                  <svg className={`w-3 h-3 fill-current ${isLoading ? 'animate-spin' : ''}`} viewBox="0 0 24 24">
                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.152-2.004 4.168-1.504 1.504-3.692 2.112-5.836 2.112-4.148 0-7.796-3.328-7.796-7.48s3.648-7.48 7.796-7.48c2.4 0 4.14 1.056 5.4 2.208L20.208 5.4C18.156 3.48 15.624 2 12.48 2 6.444 2 2.06 6.84 2.06 13s4.384 11 10.42 11c3.28 0 5.76-1.08 7.68-3.12 1.98-1.92 2.616-4.668 2.616-6.96 0-.6-.048-1.296-.144-1.92h-10.152z" />
                  </svg>
                  Google
                </button>
              </div>
            </form>

            <div className="mt-8 pt-8 border-t border-white/5 text-center flex flex-col gap-4">
              <button 
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-accent transition-colors"
              >
                {isRegistering 
                  ? 'Already part of the grid? Access Terminal' 
                  : "Need terminal access? Initialize Profile"}
              </button>
              
              <div className="flex items-center justify-center gap-2 text-[8px] font-black text-accent/40 uppercase tracking-[0.2em]">
                <Shield className="w-3 h-3" />
                Authorized Operators: prithvi2698@gmail.com
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center gap-4 opacity-20">
              <Shield className="w-4 h-4" />
              <div className="h-[1px] flex-1 bg-white" />
              <span className="text-[8px] font-black uppercase tracking-widest">End-to-End Secure</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
