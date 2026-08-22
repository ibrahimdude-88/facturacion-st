import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Edit3, Trash2, AlertCircle } from 'lucide-react';

export default function AlbumModal({ isOpen, mode, album, onClose, onSubmit, onDelete }) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (album) {
      setName(album.name || '');
    } else {
      setName('');
    }
  }, [album, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    
    // Execute onSubmit and close modal INSTANTLY (0ms delay)
    onSubmit(cleanName);
    onClose();
  };

  const handleDelete = () => {
    if (album?.id) {
      onDelete(album.id);
    }
    onClose(); // Close modal INSTANTLY
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-800 shadow-glass space-y-5 relative">
        
        {/* X Close Button - Cancels operation and closes modal safely */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          title="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-xl ${mode === 'delete' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
            {mode === 'create' && <FolderPlus className="w-6 h-6" />}
            {mode === 'edit' && <Edit3 className="w-6 h-6" />}
            {mode === 'delete' && <Trash2 className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              {mode === 'create' && 'Nuevo Álbum de Comprobantes'}
              {mode === 'edit' && 'Renombrar Álbum'}
              {mode === 'delete' && 'Eliminar Álbum'}
            </h3>
            <p className="text-xs text-slate-400">
              {mode === 'create' && 'Organiza tus tickets por categoría o periodo'}
              {mode === 'edit' && 'Actualiza el nombre identificador del álbum'}
              {mode === 'delete' && 'Esta acción eliminará el álbum seleccionado'}
            </p>
          </div>
        </div>

        {/* Form Body for Create / Edit */}
        {mode !== 'delete' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nombre del Álbum
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Gastos Agosto 2026, Viaje Monterrey..."
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-sm"
                autoFocus
                required
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-glow transition-all disabled:opacity-50"
              >
                {mode === 'create' ? 'Crear Álbum' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        ) : (
          /* Confirmation Body for Delete */
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>
                ¿Estás seguro de que deseas eliminar el álbum <strong>"{album?.name}"</strong>?
              </span>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all"
              >
                Sí, Eliminar Álbum
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
