import React, { useState, useEffect } from 'react';
import { 
  X, ZoomIn, ZoomOut, RotateCw, Maximize2, ExternalLink, QrCode, 
  CheckCircle2, Plus, Save, Trash2, Calendar, Store, Calculator 
} from 'lucide-react';
import TicketItemRow from './TicketItemRow';
import { formatCurrency } from '../Analytics/StatsOverview';

export default function TicketDrawer({ isOpen, ticket, albums, onClose, onSave, onDelete }) {
  const [formData, setFormData] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fullScreenImage, setFullScreenImage] = useState(false);

  useEffect(() => {
    if (ticket) {
      const cloned = JSON.parse(JSON.stringify(ticket));

      const itemsRawSum = (cloned.items || []).reduce((acc, i) => acc + (Number(i.quantity || 1) * Number(i.unitPrice || 0)), 0);
      const itemsAmountSum = (cloned.items || []).reduce((acc, i) => acc + (Number(i.amount) || (Number(i.quantity || 1) * Number(i.unitPrice || 0))), 0);

      let sub = Number(cloned.subtotal) || 0;
      let tot = Number(cloned.total) || 0;
      let disc = Number(cloned.discount) || 0;

      if (itemsRawSum > 0 && (sub === 0 || sub < itemsRawSum)) {
        sub = itemsRawSum;
      }

      if (itemsRawSum > itemsAmountSum && (itemsRawSum - itemsAmountSum) > 0.05) {
        const lineDisc = Number((itemsRawSum - itemsAmountSum).toFixed(2));
        if (disc < lineDisc) disc = lineDisc;
      }

      if (sub > 0 && tot > 0 && (sub - tot) > 0.05) {
        const mathDiff = Number((sub - tot).toFixed(2));
        if (disc < mathDiff) disc = mathDiff;
      }

      cloned.subtotal = Number(sub.toFixed(2));
      cloned.discount = Number(disc.toFixed(2));
      cloned.total = Number(tot.toFixed(2));

      setFormData(cloned);
      setZoom(1);
      setRotation(0);
    }
  }, [ticket]);

  if (!isOpen || !formData) return null;

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const q = Number(field === 'quantity' ? value : updatedItems[index].quantity) || 0;
      const p = Number(field === 'unitPrice' ? value : updatedItems[index].unitPrice) || 0;
      updatedItems[index].amount = Number((q * p).toFixed(2));
    }

    setFormData({ ...formData, items: updatedItems });
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: 'Nuevo Producto', quantity: 1, unitPrice: 0, amount: 0 }]
    });
  };

  const handleRemoveItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  // Recalculate financials from items (Auto-calculates discount)
  const handleRecalculateTotals = () => {
    const itemsRawSum = formData.items.reduce((acc, i) => acc + (Number(i.quantity || 1) * Number(i.unitPrice || 0)), 0);
    const itemsAmountSum = formData.items.reduce((acc, i) => acc + (Number(i.amount) || (Number(i.quantity || 1) * Number(i.unitPrice || 0))), 0);

    const sub = itemsRawSum > 0 ? itemsRawSum : itemsAmountSum;
    const tot = itemsAmountSum > 0 ? itemsAmountSum : sub;
    let disc = 0;

    if (itemsRawSum > itemsAmountSum && (itemsRawSum - itemsAmountSum) > 0.05) {
      disc = Number((itemsRawSum - itemsAmountSum).toFixed(2));
    } else if (sub > tot && (sub - tot) > 0.05) {
      disc = Number((sub - tot).toFixed(2));
    }

    setFormData({
      ...formData,
      subtotal: Number(sub.toFixed(2)),
      discount: disc,
      total: Number(tot.toFixed(2)),
    });
  };

  // Toggle billed status and close drawer INSTANTLY
  const handleToggleBilledAndClose = () => {
    const newBilled = !formData.isBilled;
    const updated = { ...formData, isBilled: newBilled };
    onSave(updated);
    onClose();
  };

  // Save edits and close drawer INSTANTLY
  const handleSaveSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-5xl h-full border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            {/* Toggle Billed button - Saves and closes drawer on click */}
            <button
              type="button"
              onClick={handleToggleBilledAndClose}
              className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                formData.isBilled
                  ? 'bg-emerald-500 border-emerald-400 text-white shadow-glow-emerald'
                  : 'bg-slate-800 border-slate-700 text-transparent hover:border-slate-500'
              }`}
              title={formData.isBilled ? 'Marcado como Facturado (Haz clic para desmarcar)' : 'Marcar como Facturado (Haz clic para guardar)'}
            >
              <CheckCircle2 className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-100">{formData.businessName || 'Comercio General'}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  formData.isBilled
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  {formData.isBilled ? 'Facturado' : 'Pendiente de Facturar'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Fecha: {formData.purchaseDate} | ID: #{formData.id}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                onDelete(formData.id);
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              title="Eliminar este ticket"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Drawer Split Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* LEFT PANE: Interactive Image Viewer */}
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950 p-4 flex flex-col justify-between relative overflow-hidden">
            
            {/* Viewer Controls Toolbar */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800 z-10">
              <span className="text-[11px] font-semibold text-slate-400 pl-1">Foto del Ticket</span>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
                  title="Alejar"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-mono text-slate-400 px-1">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
                  title="Acercar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
                  title="Rotar 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFullScreenImage(true)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
                  title="Pantalla Completa"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Image Canvas Container */}
            <div className="flex-1 flex items-center justify-center overflow-auto p-4 my-2 relative">
              {formData.imageUrl ? (
                <img
                  src={formData.imageUrl}
                  alt="Foto del ticket"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transition: 'transform 0.2s ease-out',
                  }}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-lg cursor-grab active:cursor-grabbing"
                />
              ) : (
                <div className="text-center text-slate-500 space-y-2">
                  <p className="text-xs">Sin captura de imagen</p>
                </div>
              )}
            </div>

            {/* Quick Link to Billing Portal */}
            {(() => {
              const raw = formData.billingUrl || formData.qrData;
              if (!raw || typeof raw !== 'string') return null;
              const clean = raw.trim();
              if (!clean || clean === '#' || clean === '/') return null;
              const targetUrl = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;

              return (
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Ir al Portal de Facturación Directo</span>
                </a>
              );
            })()}
          </div>

          {/* RIGHT PANE: Editable Ticket Form & Breakdown */}
          <div className="lg:col-span-7 p-5 sm:p-6 overflow-y-auto space-y-5">
            <form onSubmit={handleSaveSubmit} className="space-y-5">
              
              {/* General Metadata Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Comercio / Emisor
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={formData.businessName || ''}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 rounded-xl glass-input text-xs font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Fecha de Compra
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={formData.purchaseDate || ''}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 rounded-xl glass-input text-xs font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Álbum
                  </label>
                  <select
                    value={formData.albumId}
                    onChange={(e) => setFormData({ ...formData, albumId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  >
                    {albums.map((alb) => (
                      <option key={alb.id} value={alb.id} className="bg-slate-900">
                        {alb.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Enlace de Facturación (URL / QR)
                  </label>
                  <input
                    type="text"
                    value={formData.billingUrl || ''}
                    onChange={(e) => setFormData({ ...formData, billingUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              {/* Items List Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Desglose de Productos ({formData.items?.length || 0})
                  </h4>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleRecalculateTotals}
                      className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
                      title="Calcular subtotal e IVA desde los productos"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Recalcular Totales</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {formData.items?.map((item, idx) => (
                    <TicketItemRow
                      key={idx}
                      item={item}
                      index={idx}
                      onChange={handleItemChange}
                      onRemove={handleRemoveItem}
                    />
                  ))}
                </div>
              </div>

              {/* Financial Totals Section */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Subtotal</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.subtotal}
                      onChange={(e) => setFormData({ ...formData, subtotal: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-emerald-400 font-semibold mb-1">Descuento</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.discount || 0}
                      onChange={(e) => setFormData({ ...formData, discount: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">IVA / Impuestos</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.iva}
                      onChange={(e) => setFormData({ ...formData, iva: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Propina</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tip || 0}
                      onChange={(e) => setFormData({ ...formData, tip: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-blue-400 font-bold mb-1">Total Final</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.total}
                      onChange={(e) => setFormData({ ...formData, total: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-extrabold"
                    />
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-glow transition-all flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </button>
              </div>

            </form>
          </div>

        </div>

      </div>

      {/* Fullscreen Image Overlay Modal */}
      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setFullScreenImage(false)}
        >
          <button
            type="button"
            onClick={() => setFullScreenImage(false)}
            className="absolute top-4 right-4 p-2 text-white bg-slate-800/80 rounded-full hover:bg-slate-700"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={formData.imageUrl}
            alt="Ticket en pantalla completa"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
