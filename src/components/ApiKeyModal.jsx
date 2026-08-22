import React from 'react';
import { X, Key, ShieldCheck, CheckCircle2, AlertTriangle, ExternalLink, HelpCircle } from 'lucide-react';
import { isFirebaseConfigured } from '../services/firebase';
import { isGeminiConfigured } from '../services/gemini';

export default function ApiKeyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-slate-800 shadow-glass space-y-5 relative text-left">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Estado de Configuración & API Keys</h3>
            <p className="text-xs text-slate-400">
              Servicios de Firebase Suite y Google Gemini 2.5 Flash
            </p>
          </div>
        </div>

        {/* Status List */}
        <div className="space-y-3 text-xs">
          <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
            isFirebaseConfigured 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            <div className="flex items-center space-x-2.5">
              {isFirebaseConfigured ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div>
                <p className="font-bold">Firebase Suite (Auth, Firestore, Storage)</p>
                <p className="text-[11px] opacity-80">
                  {isFirebaseConfigured 
                    ? 'Conectado a tu proyecto de Firebase en la nube.' 
                    : 'Modo demo activo. Configura VITE_FIREBASE_* en tu archivo .env'}
                </p>
              </div>
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
            isGeminiConfigured 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            <div className="flex items-center space-x-2.5">
              {isGeminiConfigured ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div>
                <p className="font-bold">Google Gemini 2.5 Flash API</p>
                <p className="text-[11px] opacity-80">
                  {isGeminiConfigured 
                    ? 'API Key activa para extracción inteligente JSON.' 
                    : 'Modo simulación activo. Configura VITE_GEMINI_API_KEY en .env'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Instructions */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2 text-slate-300">
          <div className="flex items-center space-x-2 font-bold text-slate-200">
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span>¿Cómo conectar tus credenciales de Firebase y Gemini?</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
            <li>Crea un archivo <code>.env</code> en la raíz del proyecto duplicando <code>.env.example</code>.</li>
            <li>Obtén tu Gemini API Key en <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Google AI Studio</a>.</li>
            <li>Crea un proyecto en <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Firebase Console</a> y copia las llaves de tu Web App.</li>
            <li>Reinicia el servidor de desarrollo (<code>npm run dev</code>).</li>
          </ol>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
}
