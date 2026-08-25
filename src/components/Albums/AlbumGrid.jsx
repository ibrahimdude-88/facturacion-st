import React, { useState } from 'react';
import { Folder, Plus, Edit2, Trash2, Check, Archive, Sparkles, FolderArchive, Layers, Upload } from 'lucide-react';
import { formatCurrency } from '../Analytics/StatsOverview';

export default function AlbumGrid({ 
  albums, 
  tickets, 
  selectedAlbumId, 
  onSelectAlbum, 
  onUploadClick,
  onOpenUpload,
  onCreateAlbumClick, 
  onCreateAlbum,
  onEditAlbumClick, 
  onEditAlbum,
  onDeleteAlbumClick,
  onDeleteAlbum,
  onArchiveAlbumClick,
  onToggleArchiveAlbum
}) {
  const handleUpload = onUploadClick || onOpenUpload;
  const handleCreate = onCreateAlbumClick || onCreateAlbum;
  const handleEdit = onEditAlbumClick || onEditAlbum;
  const handleDelete = onDeleteAlbumClick || onDeleteAlbum;
  const handleArchive = onArchiveAlbumClick || onToggleArchiveAlbum;

  const [tabFilter, setTabFilter] = useState('active'); // 'active' | 'archived'

  // Classify active vs archived albums
  const activeAlbums = albums.filter(album => {
    const albumTickets = tickets.filter(t => t.albumId === album.id);
    const isFullyBilled = albumTickets.length > 0 && albumTickets.every(t => t.isBilled);
    return !album.isArchived && !isFullyBilled;
  });

  const archivedAlbums = albums.filter(album => {
    const albumTickets = tickets.filter(t => t.albumId === album.id);
    const isFullyBilled = albumTickets.length > 0 && albumTickets.every(t => t.isBilled);
    return album.isArchived || isFullyBilled;
  });

  const displayAlbums = tabFilter === 'archived' ? archivedAlbums : activeAlbums;

  return (
    <div className="space-y-4">
      
      {/* Prominent Action Bar Right Above Albums */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
        
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-bold text-slate-100 font-sans flex items-center space-x-2">
            <Folder className="w-5 h-5 text-blue-400" />
            <span>Álbumes de Comprobantes</span>
          </h3>

          {/* Active / Archived Tabs */}
          <div className="flex items-center space-x-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => setTabFilter('active')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                tabFilter === 'active'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Activos ({activeAlbums.length})
            </button>

            <button
              onClick={() => setTabFilter('archived')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                tabFilter === 'archived'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Archivados ({archivedAlbums.length})</span>
            </button>
          </div>
        </div>
        
        {/* Buttons right above Albums: Scan Ticket + New Album */}
        <div className="flex items-center space-x-2">
          {/* Main Scan / Upload Ticket Button */}
          <button
            onClick={handleUpload}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-glow transition-all active:scale-95"
          >
            <Upload className="w-4 h-4" />
            <span>Escanear / Cargar Ticket</span>
          </button>

          <button
            onClick={handleCreate}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Nuevo Álbum</span>
          </button>
        </div>

      </div>

      {/* Grid of Albums (2 columns on mobile, 4 on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* All Tickets Option Card (Visible in Active tab) */}
        {tabFilter === 'active' && (
          <div
            onClick={() => onSelectAlbum(null)}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              selectedAlbumId === null
                ? 'bg-blue-600/15 border-blue-500/50 ring-1 ring-blue-500/50 shadow-glow'
                : 'glass-card border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Folder className="w-5 h-5" />
              </div>
              {selectedAlbumId === null && (
                <span className="p-1 rounded-full bg-blue-500 text-white">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-100">Todos los Comprobantes</h4>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} registrados globalmente
              </p>
              <p className="text-[10px] text-amber-400/80 font-medium mt-1">
                🔒 Vista Global (Selecciona un álbum para agregar)
              </p>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Total acumulado:</span>
              <span className="font-semibold text-slate-200">
                {formatCurrency(tickets.reduce((acc, t) => acc + (Number(t.total) || 0), 0))}
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Album Cards */}
        {displayAlbums.map((album) => {
          const albumTickets = tickets.filter(t => t.albumId === album.id);
          const totalAmount = albumTickets.reduce((acc, t) => acc + (Number(t.total) || 0), 0);
          const billedTickets = albumTickets.filter(t => t.isBilled);
          const billedPercentage = albumTickets.length > 0 
            ? Math.round((billedTickets.length / albumTickets.length) * 100) 
            : 0;

          const isFullyBilled = albumTickets.length > 0 && billedPercentage === 100;
          const isArchived = album.isArchived || isFullyBilled;
          const archiveDate = album.archivedAt || new Date().toLocaleDateString('es-MX');

          const isSelected = selectedAlbumId === album.id;

          return (
            <div
              key={album.id}
              onClick={() => onSelectAlbum(album.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-600/15 border-blue-500/50 ring-1 ring-blue-500/50 shadow-glow'
                  : isArchived
                  ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-500/60'
                  : 'glass-card border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${isArchived ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                  {isArchived ? <FolderArchive className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                </div>

                {/* Album Action Buttons */}
                <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  {!isArchived && isFullyBilled && handleArchive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive(album.id);
                      }}
                      className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                      title="Archivar álbum facturado"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {handleEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(album);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                      title="Renombrar álbum"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {handleDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(album.id || album);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      title="Eliminar álbum"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-100 truncate max-w-[150px]">
                    {album.name}
                  </h4>
                  {isArchived && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                      Archivado
                    </span>
                  )}
                </div>
                
                <p className="text-xs text-slate-400 mt-0.5">
                  {albumTickets.length} ticket{albumTickets.length !== 1 ? 's' : ''} ({billedPercentage}% facturado)
                </p>

                {isArchived && (
                  <p className="text-[10px] text-emerald-400 font-medium mt-1 flex items-center space-x-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Facturado & Archivado el {archiveDate}</span>
                  </p>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mt-3 space-y-1">
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${
                      billedPercentage === 100 ? 'bg-emerald-400' : 'bg-blue-500'
                    }`}
                    style={{ width: `${billedPercentage}%` }}
                  />
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total:</span>
                  <span className="font-semibold text-slate-200">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {displayAlbums.length === 0 && tabFilter === 'archived' && (
          <div className="col-span-full p-8 text-center glass-panel rounded-xl border border-slate-800 text-slate-400 text-xs">
            <FolderArchive className="w-8 h-8 mx-auto mb-2 text-slate-500" />
            <p>No tienes álbumes archivados aún.</p>
            <p className="text-[11px] text-slate-500 mt-1">Los álbumes facturados al 100% o descargados en paquete ZIP se archivarán automáticamente aquí.</p>
          </div>
        )}

      </div>
    </div>
  );
}
