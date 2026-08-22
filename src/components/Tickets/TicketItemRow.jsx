import React from 'react';
import { Trash2 } from 'lucide-react';

export default function TicketItemRow({ item, index, onChange, onRemove }) {
  return (
    <div className="flex items-center space-x-2 text-xs bg-slate-900/80 p-2 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
      
      {/* Description */}
      <input
        type="text"
        value={item.description}
        onChange={(e) => onChange(index, 'description', e.target.value)}
        placeholder="Producto o servicio"
        className="flex-1 px-2.5 py-1.5 rounded-lg glass-input text-xs"
      />

      {/* Quantity */}
      <div className="w-16">
        <input
          type="number"
          step="0.5"
          value={item.quantity}
          onChange={(e) => onChange(index, 'quantity', e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg glass-input text-xs text-center font-medium"
          title="Cantidad"
        />
      </div>

      {/* Unit Price */}
      <div className="w-24">
        <input
          type="number"
          step="0.01"
          value={item.unitPrice}
          onChange={(e) => onChange(index, 'unitPrice', e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg glass-input text-xs text-right font-medium"
          title="Precio Unitario"
        />
      </div>

      {/* Amount */}
      <div className="w-24 text-right font-bold text-slate-100 pr-1">
        ${Number(item.amount || 0).toFixed(2)}
      </div>

      {/* Remove Button */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
        title="Eliminar producto"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
