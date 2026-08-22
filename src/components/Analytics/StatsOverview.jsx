import React from 'react';
import { DollarSign, Clock, CheckCircle2, FileText, Download, Plus, Archive, Sparkles } from 'lucide-react';

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

export default function StatsOverview({ tickets, selectedAlbumName, onUploadClick, onExportCSV, onExportZIP, onExportPDF }) {
  const totalAmount = tickets.reduce((acc, t) => acc + (Number(t.total) || 0), 0);
  const totalCount = tickets.length;
  
  const pendingTickets = tickets.filter(t => !t.isBilled);
  const pendingAmount = pendingTickets.reduce((acc, t) => acc + (Number(t.total) || 0), 0);
  
  const billedTickets = tickets.filter(t => t.isBilled);
  const billedAmount = billedTickets.reduce((acc, t) => acc + (Number(t.total) || 0), 0);

  const billedPercentage = totalCount > 0 ? Math.round((billedTickets.length / totalCount) * 100) : 0;
  const isAllBilled = totalCount > 0 && billedPercentage === 100;

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Top Banner Actions & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 font-sans tracking-tight">
              Resumen General
            </h2>
            {selectedAlbumName && (
              <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-bold truncate max-w-[120px] sm:max-w-none">
                {selectedAlbumName}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Control de tickets escaneados e IVA deducible
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* General PDF Report Button */}
          <button
            onClick={onExportPDF}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-700 hover:border-slate-600 transition-all shadow-sm active:scale-95 font-semibold text-xs"
            title="Generar y descargar Reporte General en PDF"
          >
            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Exportar PDF General</span>
          </button>

          {/* ZIP Export Button (PDF + Photos) */}
          <button
            onClick={onExportZIP}
            className={`flex items-center justify-center space-x-1.5 px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
              isAllBilled
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400 shadow-glow-emerald animate-pulse-fast'
                : 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border-slate-700 hover:border-slate-600'
            }`}
            title="Descargar paquete .ZIP con el reporte PDF y todas las fotos renombradas"
          >
            <Archive className="w-4 h-4 shrink-0" />
            <span>{isAllBilled ? '🎉 Descargar ZIP (100% Facturado)' : 'Descargar ZIP (PDF + Fotos)'}</span>
          </button>
        </div>
      </div>

      {/* 100% Billed Special Celebration Banner */}
      {isAllBilled && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border border-emerald-500/40 shadow-glow-emerald flex flex-col sm:flex-row items-center justify-between gap-3 text-emerald-300">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                ¡Felicidades! Todos los tickets de este lote han sido facturados (100%)
              </h4>
              <p className="text-xs text-emerald-400">
                Ya puedes descargar tu paquete comprimido .ZIP con las fotos de cada comprobante renombradas por comercio + resumen CSV.
              </p>
            </div>
          </div>

          <button
            onClick={onExportZIP}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-all shadow-md shrink-0"
          >
            Descargar ZIP Ahora
          </button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Spent */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Registrado
            </span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              {formatCurrency(totalAmount)}
            </p>
            <p className="text-xs text-slate-400 mt-1 flex items-center space-x-1">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>{totalCount} ticket{totalCount !== 1 ? 's' : ''} en total</span>
            </p>
          </div>
        </div>

        {/* Card 2: Pending to Bill */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Pendientes de Facturar
            </span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-tight">
              {formatCurrency(pendingAmount)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {pendingTickets.length} comprobante{pendingTickets.length !== 1 ? 's' : ''} por facturar
            </p>
          </div>
        </div>

        {/* Card 3: Already Billed */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Facturados
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight">
              {formatCurrency(billedAmount)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {billedTickets.length} comprobante{billedTickets.length !== 1 ? 's' : ''} facturado{billedTickets.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Card 4: Billing Progress */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Progreso de Facturación
            </span>
            <span className="text-sm font-bold text-blue-400">{billedPercentage}%</span>
          </div>
          
          <div className="my-2">
            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${billedPercentage}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            {billedPercentage === 100 
              ? '¡Excelente! Todos tus tickets están facturados.' 
              : `${totalCount - billedTickets.length} pendientes para deducción fiscal.`}
          </p>
        </div>

      </div>
    </div>
  );
}
