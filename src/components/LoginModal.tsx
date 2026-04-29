import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Lock, ArrowRight, Shield, Command } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  sendEmailVerification,
  signOut,
  signInWithPopup
} from 'firebase/auth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: { name: string; email: string; uid: string }) => void;
}

export default function LoginModal({ isOpen, onClose, onLogin }: LoginModalProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setVerificationError('');

    try {
      if (isRegistering) {
        try {
          const result = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
          await updateProfile(result.user, { displayName: formData.name });
          
          // Send verification email
          await sendEmailVerification(result.user);
          
          // Sign out immediately to prevent automatic login (requirements)
          await signOut(auth);
          
          setIsVerifying(true);
        } catch (error: any) {
          if (error.code === 'auth/email-already-in-use') {
            setVerificationError('User already exists. Please sign in');
          } else {
            throw error;
          }
        }
      } else {
        try {
          const result = await signInWithEmailAndPassword(auth, formData.email, formData.password);
          
          if (!result.user.emailVerified) {
            // Send verification email again if they are trying to log in but aren't verified
            await sendEmailVerification(result.user);
            await signOut(auth);
            setIsVerifying(true);
            return;
          }

          onLogin({
            name: result.user.displayName || result.user.email?.split('@')[0] || 'Operator',
            email: result.user.email || '',
            uid: result.user.uid
          });
          onClose();
        } catch (error: any) {
          if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            setVerificationError('Email or password is incorrect');
          } else {
            throw error;
          }
        }
      }
    } catch (error: any) {
      console.error("Authentication failure:", error);
      setVerificationError(error.message || 'Authentication error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setVerificationError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        // Requirements say check verification
        // Google users are usually verified, but let's be strict if the user wants verification
        if (!result.user.emailVerified) {
          setVerificationError('Email not verified. Please verify your Google account.');
          await signOut(auth);
          return;
        }

        onLogin({
          name: result.user.displayName || result.user.email?.split('@')[0] || 'Operator',
          email: result.user.email || '',
          uid: result.user.uid
        });
        onClose();
      }
    } catch (error: any) {
      console.error("Google Authentication failure:", error);
      setVerificationError(error.message || 'Google Auth Error');
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
            
            <AnimatePresence mode="wait">
              {isVerifying ? (
                <motion.div
                  key="verifying"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="text-center py-4"
                >
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Shield className="w-8 h-8 text-accent animate-pulse" />
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-4">Identity Verification</h2>
                  <p className="text-xs font-mono text-muted uppercase tracking-[0.2em] leading-relaxed mb-8">
                    We have sent you a verification email to <span className="text-accent">{formData.email}</span>. Please verify it and log in.
                  </p>
                  
                  <button 
                    onClick={() => {
                      setIsVerifying(false);
                      setIsRegistering(false);
                      setVerificationError('');
                    }}
                    className="w-full bg-accent text-white py-5 text-xs font-black uppercase tracking-[0.4em] hover:bg-white hover:text-bg transition-all transform hover:scale-[1.02]"
                  >
                    Return to Login
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
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
                          className="text-[10px] font-mono text-accent italic uppercase text-center mt-2 font-bold"
                        >
                          {verificationError}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </form>

                  <div className="relative flex items-center justify-center py-4 my-4">
                    <div className="w-full h-[1px] bg-white/5" />
                    <span className="absolute bg-surface px-4 text-[8px] font-black uppercase tracking-[0.4em] text-muted">Or Continue Via</span>
                  </div>

                  <button 
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full bg-bg border border-white/10 py-5 text-xs font-black uppercase tracking-[0.4em] hover:bg-white hover:text-bg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.152-2.004 4.168-1.504 1.504-3.692 2.112-5.836 2.112-4.148 0-7.796-3.328-7.796-7.48s3.648-7.48 7.796-7.48c2.4 0 4.14 1.056 5.4 2.208L20.208 5.4C18.156 3.48 15.624 2 12.48 2 6.444 2 2.06 6.84 2.06 13s4.384 11 10.42 11c3.28 0 5.76-1.08 7.68-3.12 1.98-1.92 2.616-4.668 2.616-6.96 0-.6-.048-1.296-.144-1.92h-10.152z" />
                    </svg>
                    Google Sync
                  </button>

                  <div className="mt-8 pt-8 border-t border-white/5 text-center flex flex-col gap-4">
                    <button 
                      onClick={() => {
                        setIsRegistering(!isRegistering);
                        setVerificationError('');
                      }}
                      className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-accent transition-colors"
                    >
                      {isRegistering 
                        ? 'Already part of the grid? Access Terminal' 
                        : "Need terminal access? Initialize Profile"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
