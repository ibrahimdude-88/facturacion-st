import React, { useState } from 'react';
import { Receipt, Sparkles, QrCode, Shield, Zap, CheckCircle2 } from 'lucide-react';
import { loginWithGoogle, isFirebaseConfigured } from '../services/firebase';

export default function AuthGuard({ user, children }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (user) {
    return <>{children}</>;
  }

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('Error al iniciar sesión con Google:', err);
      let userFriendlyMsg = err.message || 'No se pudo completar el inicio de sesión con Google.';
      
      if (err.code === 'auth/operation-not-allowed') {
        userFriendlyMsg = 'El proveedor de Google no está habilitado en tu consola de Firebase. Por favor activa Google en Firebase Console -> Authentication -> Sign-in method.';
      } else if (err.code === 'auth/unauthorized-domain') {
        userFriendlyMsg = 'Este dominio o IP no está en la lista de dominios autorizados en Firebase Console -> Authentication -> Settings -> Authorized Domains.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        userFriendlyMsg = 'La ventana de inicio de sesión con Google se cerró antes de completar.';
      }

      setError(userFriendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 lg:p-8 relative overflow-hidden bg-slate-950">
      
      {/* Background Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-600/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-10 left-10 w-80 h-80 bg-emerald-600/15 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        
        {/* Left Hero Content */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Potenciado con Google Gemini 3.6 Flash & Firebase</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight font-sans">
            Gestión Inteligente de <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">Tickets y Facturación</span>
          </h2>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            Digitaliza tus comprobantes de compra al instante. Escanea códigos QR directamente en el navegador, extrae desglose de productos con IA y gestiona tus facturas pendientes sin costo.
          </p>

          {/* Key Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="flex items-center space-x-2.5 text-sm text-slate-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Extracción automática con Gemini 3.6</span>
            </div>
            <div className="flex items-center space-x-2.5 text-sm text-slate-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Lectura QR instantánea previa a subida</span>
            </div>
            <div className="flex items-center space-x-2.5 text-sm text-slate-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Compresión WebP &lt; 500 KB (Firebase $0)</span>
            </div>
            <div className="flex items-center space-x-2.5 text-sm text-slate-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Álbumes y seguridad NoSQL en tiempo real</span>
            </div>
          </div>
        </div>

        {/* Right Sign-In Card */}
        <div className="lg:col-span-5">
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-glass space-y-6 text-center">
            
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-glow">
              <Receipt className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-100">Iniciar Sesión</h3>
              <p className="text-xs text-slate-400">
                Accede de forma segura con tu cuenta de Google
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-left leading-relaxed">
                <span className="font-bold block mb-1">Error de Autenticación:</span>
                {error}
              </div>
            )}

            {/* Google Login Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-3 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl border border-slate-700 hover:border-slate-500 transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.28v3.15C3.25 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.28C.46 8.21 0 10.05 0 12s.46 3.79 1.28 5.42l4-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.58l4 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{loading ? 'Iniciando sesión...' : 'Continuar con Google'}</span>
            </button>

            <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Autenticación oficial de Google y reglas de privacidad</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
