import { ShoppingBag, Menu, X, Heart, LogOut, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface HeaderProps {
  cartCount: number;
  onCartToggle: () => void;
  wishlistCount: number;
  onWishlistToggle: () => void;
  user: { name: string; email: string } | null;
  onLoginToggle: () => void;
  onLogout: () => void;
  onOrderHistoryToggle: () => void;
  onAdminToggle: () => void;
}

export default function Header({ 
  cartCount, 
  onCartToggle, 
  wishlistCount, 
  onWishlistToggle,
  user,
  onLoginToggle,
  onLogout,
  onOrderHistoryToggle,
  onAdminToggle
}: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleHomeClick = (e: React.MouseEvent) => {
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    if (location.pathname === '/') {
      e.preventDefault();
      const element = document.getElementById('series-01');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleBTSClick = (e: React.MouseEvent) => {
    if (location.pathname === '/') {
      e.preventDefault();
      const element = document.getElementById('bts-archive');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <nav className="sticky top-0 left-0 w-full z-10 bg-bg/80 backdrop-blur-md py-4 px-4 md:py-6 md:px-16 flex justify-between items-center border-b border-white/5 transition-all duration-300">
      <Link 
        to="/" 
        onClick={handleHomeClick}
        className="flex items-center gap-2 group shrink-0 max-w-[40%] sm:max-w-none"
      >
        <div className="w-8 h-8 bg-accent flex items-center justify-center font-black text-white text-xl shrink-0">P</div>
        <div className="flex flex-col overflow-hidden">
          <span className="text-sm md:text-2xl font-black tracking-tighter uppercase group-hover:text-accent transition-colors leading-none truncate">
            P-THREAD<span className="hidden sm:inline"> STUDIO</span>
          </span>
          <span className="text-[6px] md:text-[8px] font-black tracking-[0.5em] text-accent uppercase leading-none mt-1 truncate">Archive_Ops</span>
        </div>
      </Link>

      <div className="flex items-center gap-3 sm:gap-6 lg:gap-12 text-[10px] font-black tracking-[0.3em] uppercase">
        <div className="hidden lg:flex items-center gap-8">
          <Link 
            to="/" 
            onClick={handleBTSClick}
            className="hover:text-[#8b5cf6] transition-colors text-[#8b5cf6] font-black animate-pulse"
          >
            BTS_Archive
          </Link>
          <Link 
            to="/" 
            onClick={handleArchiveClick}
            className="hover:text-accent transition-colors opacity-60 hover:opacity-100"
          >
            Archives
          </Link>
          <Link to="/about" className="hover:text-accent transition-colors opacity-60 hover:opacity-100">Manifesto</Link>
        </div>
        
        <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
          {/* Identity Tag */}
          {user ? (
            <div className="flex items-center gap-2 md:gap-3 pr-4 md:pr-6 border-r border-white/10 h-8">
              <div className="text-right flex flex-col items-end">
                <span className="text-[6px] md:text-[8px] text-accent font-black tracking-[0.2em] leading-none mb-1">ID_VERIFIED</span>
                <button 
                  onClick={onOrderHistoryToggle}
                  className="hidden md:block text-[10px] font-black tracking-widest leading-none hover:text-accent transition-colors"
                >
                  {user.name.toUpperCase()}
                </button>
                <span className="md:hidden text-[8px] font-black tracking-widest leading-none truncate max-w-[40px]">USR</span>
              </div>
              {user.email === 'prithvi2698@gmail.com' && (
                <button 
                  onClick={onAdminToggle}
                  className="px-3 py-1.5 bg-accent/20 border border-accent/40 hover:bg-accent hover:text-white transition-all group flex items-center gap-2"
                  title="Admin Dashboard"
                >
                  <Shield className="w-3 h-3 text-accent group-hover:text-white" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-accent group-hover:text-white hidden lg:inline">Admin_Terminal</span>
                </button>
              )}
              <button 
                onClick={onLogout}
                className="group flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 hover:bg-accent hover:border-accent transition-all md:ml-4"
                title="Disconnect Terminal"
              >
                <LogOut className="w-3 h-3 text-accent group-hover:text-white" />
                <span className="text-[10px] font-black uppercase tracking-widest text-accent group-hover:text-white hidden md:inline">Disconnect</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={onLoginToggle}
              className="text-[8px] md:text-[10px] font-black tracking-widest hover:text-accent transition-all flex items-center gap-1 md:gap-2 group pr-3 sm:pr-4 md:pr-6 border-r border-white/10 h-8 uppercase"
            >
              <div className="w-1 md:w-1.5 h-1 md:h-1.5 bg-accent rounded-full group-hover:animate-ping" />
              <span className="hidden sm:inline">Login</span>
              <span className="sm:hidden">ID</span>
            </button>
          )}

          <div className="flex items-center gap-2 sm:gap-4 md:gap-8">
            <button 
              onClick={onWishlistToggle}
              className="relative p-1 sm:p-2 text-muted hover:text-accent transition-colors flex items-center gap-2"
            >
              <div className="relative">
                <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-accent text-[8px] font-black text-white">
                  {wishlistCount}
                </span>
                <div className="text-[10px] font-black hidden sm:block">MARK</div>
                <div className="sm:hidden"><Heart className="w-4 h-4" /></div>
              </div>
            </button>

            <button 
              onClick={onCartToggle}
              className="relative group flex items-center gap-2 sm:gap-3 bg-white text-bg px-3 sm:px-5 py-2 hover:bg-accent hover:text-white transition-all transform hover:scale-105 shrink-0"
            >
              <span className="font-bold text-[10px] sm:text-xs">BAG</span>
              <span className="font-black text-accent group-hover:text-white text-[10px] sm:text-xs">[{cartCount}]</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}


