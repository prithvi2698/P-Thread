import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Lock, ArrowRight, Shield, Command } from 'lucide-react';

import { auth, db } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: { name: string; email: string; uid: string }) => void;
}

export default function LoginModal({ isOpen, onClose, onLogin }: LoginModalProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const userData = {
        name: result.user.displayName || 'ACQUIRER_01',
        email: result.user.email || '',
        uid: result.user.uid
      };

      // Archival Sync: Save user mail and identity
      await setDoc(doc(db, 'users', userData.uid), {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.name,
        lastLogin: serverTimestamp(),
        // We use merge: true so we don't overwrite createdAt if it exists
      }, { merge: true });

      // SQL SYNC
      try {
        await fetch('/api/auth-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: userData.uid,
            email: userData.email,
            displayName: userData.name
          })
        });
      } catch (err) {
        console.error("SQL_IDENTITY_SYNC_FAIL:", err);
      }

      onLogin(userData);
      onClose();
    } catch (error) {
      console.error("Identity Sync Failure:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setVerificationError('');

    try {
      let userCredential;
      if (isRegistering) {
        userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        if (formData.name) {
          await updateProfile(userCredential.user, { displayName: formData.name });
        }
      } else {
        userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      }

      const firebaseUser = userCredential.user;
      const userData = {
        name: firebaseUser.displayName || formData.name || 'ACQUIRER_01',
        email: firebaseUser.email || '',
        uid: firebaseUser.uid
      };

      // Archival Sync: Save user mail and identity
      await setDoc(doc(db, 'users', userData.uid), {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.name,
        lastLogin: serverTimestamp(),
      }, { merge: true });

      // SQL SYNC
      try {
        await fetch('/api/auth-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: userData.uid,
            email: userData.email,
            displayName: userData.name
          })
        });
      } catch (err) {
        console.error("SQL_IDENTITY_SYNC_FAIL:", err);
      }

      onLogin(userData);
      onClose();
    } catch (error: any) {
      console.error("Authentication failure:", error);
      setVerificationError(error.message || 'AUTHENTICATION_PROTOCOL_FAILURE');
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
                className="w-full bg-accent text-white py-5 text-xs font-black uppercase tracking-[0.4em] hover:bg-white hover:text-bg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 mt-4"
              >
                {isRegistering ? 'Initialize Profile' : 'Gain Access'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="relative flex items-center justify-center py-4">
                <div className="w-full h-[1px] bg-white/5" />
                <span className="absolute bg-surface px-4 text-[8px] font-black uppercase tracking-[0.4em] text-muted">Or Login Via</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-3 bg-bg border border-white/10 py-4 text-[9px] font-black uppercase tracking-widest hover:border-accent hover:text-accent transition-all group disabled:opacity-50"
                >
                  <svg className={`w-3 h-3 fill-current ${isLoading ? 'animate-spin' : ''}`} viewBox="0 0 24 24">
                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.152-2.004 4.168-1.504 1.504-3.692 2.112-5.836 2.112-4.148 0-7.796-3.328-7.796-7.48s3.648-7.48 7.796-7.48c2.4 0 4.14 1.056 5.4 2.208L20.208 5.4C18.156 3.48 15.624 2 12.48 2 6.444 2 2.06 6.84 2.06 13s4.384 11 10.42 11c3.28 0 5.76-1.08 7.68-3.12 1.98-1.92 2.616-4.668 2.616-6.96 0-.6-.048-1.296-.144-1.92h-10.152z" />
                  </svg>
                  Google
                </button>
                <button 
                  type="button"
                  onClick={() => onLogin({ name: 'Tactical_Acquirer', email: 'fb@auth.net', uid: 'fb-mock-' + Math.random().toString(36).substr(2, 9) })}
                  className="flex items-center justify-center gap-3 bg-bg border border-white/10 py-4 text-[9px] font-black uppercase tracking-widest hover:border-[#1877F2] hover:text-[#1877F2] transition-all group"
                >
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Facebook
                </button>
              </div>
            </form>

            <div className="mt-8 pt-8 border-t border-white/5 text-center">
              <button 
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-accent transition-colors"
              >
                {isRegistering 
                  ? 'Already part of the grid? Access Terminal' 
                  : "Need terminal access? Initialize Profile"}
              </button>
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
