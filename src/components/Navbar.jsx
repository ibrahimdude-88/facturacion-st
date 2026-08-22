import React from 'react';
import { Receipt, Sparkles, LogOut, ShieldCheck, AlertTriangle, Sun, Moon, Crown } from 'lucide-react';
import { isFirebaseConfigured } from '../services/firebase';
import { isGeminiConfigured } from '../services/gemini';

export default function Navbar({ user, theme, onToggleTheme, onLogout, openApiKeyInfo, onOpenAdminModal }) {
  const isAdmin = user?.email && user.email.toLowerCase().includes('zippo0189');

  return (
    <header className="sticky top-0 z-30 glass-panel border-b border-slate-800/80 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-glow">
            <Receipt className="w-6 h-6" />
            <Sparkles className="w-3.5 h-3.5 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent font-sans">
                FacturaSnap <span className="text-blue-500 font-black">AI</span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 font-medium hidden sm:block">
              Gestión inteligente de tickets & facturación
            </p>
          </div>
        </div>

        {/* User Profile & Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          
          {/* Day / Night Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-600 transition-all text-xs font-semibold shadow-sm active:scale-95"
            title={theme === 'dark' ? 'Cambiar a Modo Día (Claro)' : 'Cambiar a Modo Noche (Oscuro)'}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Modo Día</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-400" />
                <span className="hidden sm:inline">Modo Noche</span>
              </>
            )}
          </button>

          {/* Admin Panel Button (Exclusively for zippo0189) */}
          {isAdmin && (
            <button
              onClick={onOpenAdminModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all text-xs font-extrabold shadow-glow-amber active:scale-95"
              title="Abrir Reporte General de Administración (zippo0189)"
            >
              <Crown className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>Panel Admin</span>
            </button>
          )}

          {/* Environment Status Badge */}
          <button
            onClick={openApiKeyInfo}
            className={`hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              isFirebaseConfigured && isGeminiConfigured
                ? 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:border-slate-600'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            }`}
            title="Estado de Firebase y Gemini API"
          >
            {isFirebaseConfigured && isGeminiConfigured ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Firebase & Gemini Activos</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Modo Demo Local / Configurar Keys</span>
              </>
            )}
          </button>

          {/* User Profile Avatar & Sign Out */}
          {user && (
            <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
              <div className="flex items-center space-x-2.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Usuario'}
                    className="w-9 h-9 rounded-full ring-2 ring-blue-500/40 object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm ring-2 ring-blue-400/40">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-semibold text-slate-100 leading-tight">
                    {user.displayName || 'Usuario Google'}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-tight truncate max-w-[140px]">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/20 transition-all"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
