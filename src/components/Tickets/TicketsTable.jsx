import React, { useState } from 'react';
import { 
  CheckCircle2, Clock, ExternalLink, Eye, Trash2, Search, Filter, 
  Receipt, QrCode, FileText, ArrowUpDown, ChevronRight, Mail, Download 
} from 'lucide-react';
import { formatCurrency } from '../Analytics/StatsOverview';

export const ensureAbsoluteUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#' || trimmed === '/' || trimmed.startsWith('javascript:')) return null;
  if (/^https?:\/\//i.test(trimmed)) return null;
  return `https://${trimmed}`;
};

export const handleOpenGmailBilling = (ticket) => {
  const email = ticket.billingEmail || '';
  const biz = ticket.businessName || 'Comercio';
  const date = ticket.purchaseDate || '';
  const totalStr = formatCurrency(ticket.total || 0);

  // 1. Download ticket photo automatically to user's downloads folder so it can be attached
  if (ticket.imageUrl) {
    try {
      const link = document.createElement('a');
      link.href = ticket.imageUrl;
      const bizClean = biz.replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Ticket_${bizClean}_${date}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn('No se pudo descargar automáticamente la foto:', err);
    }
  }

  // 2. Build pre-filled Gmail Compose URL
  const subject = encodeURIComponent(`Solicitud de Facturación (CFDI) — ${biz} (${date})`);
  const bodyText = 
`Estimado equipo de ${biz},

Solicito amablemente la emisión de la factura electrónica (CFDI) correspondiente a mi compra realizada el ${date} por un importe total de ${totalStr}.

Adjunto la fotografía del comprobante de compra que se ha descargado automáticamente en mi dispositivo.

Datos de Facturación:
- Nombre / Razón Social: [Tu Nombre o Razón Social]
- RFC: [Tu RFC]
- Uso de CFDI: G03 - Gastos en general
- Régimen Fiscal: [Tu Régimen Fiscal]
- Código Postal: [Tu Código Postal]

Quedo a la espera de su amable respuesta.

Atentamente,`;

  const body = encodeURIComponent(bodyText);

  const gmailUrl = email 
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${subject}&body=${body}`
    : `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;

  window.open(gmailUrl, '_blank');
};

export default function TicketsTable({ 
  tickets, 
  albums, 
  selectedAlbumId, 
  onToggleBilled, 
  onSelectTicket, 
  onDeleteTicket 
}) {
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'pending' | 'billed'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');

  // Filter tickets by selected album, tab, and search query
  let filteredTickets = tickets.filter(ticket => {
    if (selectedAlbumId && ticket.albumId !== selectedAlbumId) return false;

    if (filterTab === 'pending' && ticket.isBilled) return false;
    if (filterTab === 'billed' && !ticket.isBilled) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchBiz = ticket.businessName?.toLowerCase().includes(q);
      const matchItem = ticket.items?.some(i => i.description?.toLowerCase().includes(q));
      const matchDate = ticket.purchaseDate?.includes(q);
      const matchEmail = ticket.billingEmail?.toLowerCase().includes(q);
      if (!matchBiz && !matchItem && !matchDate && !matchEmail) return false;
    }

    return true;
  });

  // Sort tickets
  filteredTickets.sort((a, b) => {
    if (sortBy === 'date-desc') {
      return new Date(b.purchaseDate || b.createdAt) - new Date(a.purchaseDate || a.createdAt);
    }
    if (sortBy === 'date-asc') {
      return new Date(a.purchaseDate || a.createdAt) - new Date(b.purchaseDate || b.createdAt);
    }
    if (sortBy === 'total-desc') {
      return (Number(b.total) || 0) - (Number(a.total) || 0);
    }
    if (sortBy === 'total-asc') {
      return (Number(a.total) || 0) - (Number(b.total) || 0);
    }
    return 0;
  });

  const pendingCount = tickets.filter(t => (selectedAlbumId ? t.albumId === selectedAlbumId : true) && !t.isBilled).length;
  const billedCount = tickets.filter(t => (selectedAlbumId ? t.albumId === selectedAlbumId : true) && t.isBilled).length;
  const totalCount = tickets.filter(t => selectedAlbumId ? t.albumId === selectedAlbumId : true).length;

  return (
    <div className="space-y-4">
      
      {/* Top Filter Bar & Search (Mobile Optimized) */}
      <div className="flex flex-col gap-3">
        
        {/* Quick Filter Tabs */}
        <div className="flex items-center space-x-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800/80 overflow-x-auto self-stretch sm:self-start">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              filterTab === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos ({totalCount})
          </button>

          <button
            onClick={() => setFilterTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 shrink-0 ${
              filterTab === 'pending'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pendientes ({pendingCount})</span>
          </button>

          <button
            onClick={() => setFilterTab('billed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 shrink-0 ${
              filterTab === 'billed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Facturados ({billedCount})</span>
          </button>
        </div>

        {/* Search & Sort Input */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar negocio, producto o correo..."
              className="w-full pl-9 pr-3 py-2 rounded-xl glass-input text-xs"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-xl glass-input text-xs text-slate-300 shrink-0"
          >
            <option value="date-desc" className="bg-slate-900">Más recientes</option>
            <option value="date-asc" className="bg-slate-900">Más antiguos</option>
            <option value="total-desc" className="bg-slate-900">Monto mayor</option>
            <option value="total-asc" className="bg-slate-900">Monto menor</option>
          </select>
        </div>

      </div>

      {/* Main Container */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-glass">
        {filteredTickets.length > 0 ? (
          <div>
            {/* Desktop View Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">Estado</th>
                    <th className="py-3 px-4">Comercio / Emisor</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Álbum</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Facturación (Portal / Correo)</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTickets.map((ticket) => {
                    const albumObj = albums.find(a => a.id === ticket.albumId);
                    const validBillingUrl = ensureAbsoluteUrl(ticket.billingUrl || ticket.qrData);

                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => onSelectTicket(ticket)}
                        className="hover:bg-blue-600/5 transition-colors cursor-pointer group"
                      >
                        {/* Checkbox Toggle "Facturado" */}
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onToggleBilled(ticket.id, !ticket.isBilled)}
                            className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                              ticket.isBilled
                                ? 'bg-emerald-500 border-emerald-400 text-white shadow-glow-emerald'
                                : 'bg-slate-900 border-slate-700 text-transparent hover:border-slate-500'
                            }`}
                            title={ticket.isBilled ? 'Marcado como Facturado' : 'Marcar como Facturado'}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        </td>

                        {/* Business Name & Discount */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2.5">
                            {ticket.imageUrl ? (
                              <img
                                src={ticket.imageUrl}
                                alt=""
                                className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                                <Receipt className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors block truncate max-w-[200px]">
                                  {ticket.businessName || 'Comercio General'}
                                </span>
                                {Number(ticket.discount || 0) > 0 && (
                                  <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">
                                    Descuento -${ticket.discount}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {ticket.items?.length || 0} producto{(ticket.items?.length !== 1) ? 's' : ''}
                                {ticket.billingEmail && ` | 📧 ${ticket.billingEmail}`}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-medium">
                          {ticket.purchaseDate || 'Sin fecha'}
                        </td>

                        {/* Album Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-medium">
                            {albumObj?.name || 'General'}
                          </span>
                        </td>

                        {/* Total */}
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-100 text-sm whitespace-nowrap">
                          {formatCurrency(ticket.total)}
                        </td>

                        {/* Billing Action: Web Portal OR Gmail Email */}
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          {validBillingUrl ? (
                            <a
                              href={validBillingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[11px] font-semibold transition-all"
                              title={`Ir a ${validBillingUrl}`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Portal Factura</span>
                            </a>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenGmailBilling(ticket);
                              }}
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-semibold transition-all"
                              title={ticket.billingEmail ? `Enviar correo a ${ticket.billingEmail} (adjunta foto autodescargada)` : 'Abrir Gmail para solicitar factura'}
                            >
                              <Mail className="w-3.5 h-3.5 text-purple-400" />
                              <span>Enviar Correo</span>
                            </button>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => onSelectTicket(ticket)}
                              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDeleteTicket(ticket.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards View */}
            <div className="block sm:hidden divide-y divide-slate-800/80">
              {filteredTickets.map((ticket) => {
                const albumObj = albums.find(a => a.id === ticket.albumId);
                const validBillingUrl = ensureAbsoluteUrl(ticket.billingUrl || ticket.qrData);

                return (
                  <div
                    key={ticket.id}
                    onClick={() => onSelectTicket(ticket)}
                    className="p-4 space-y-3 active:bg-blue-600/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleBilled(ticket.id, !ticket.isBilled);
                          }}
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                            ticket.isBilled
                              ? 'bg-emerald-500 border-emerald-400 text-white shadow-glow-emerald'
                              : 'bg-slate-900 border-slate-700 text-transparent'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>

                        <div>
                          <h4 className="font-bold text-slate-100 text-sm leading-tight flex items-center space-x-1.5">
                            <span>{ticket.businessName || 'Comercio General'}</span>
                            {Number(ticket.discount || 0) > 0 && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">
                                -${ticket.discount}
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {ticket.purchaseDate} | {albumObj?.name || 'General'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-extrabold text-slate-100 block">
                          {formatCurrency(ticket.total)}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          ticket.isBilled 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {ticket.isBilled ? 'Facturado' : 'Pendiente'}
                        </span>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                      {validBillingUrl ? (
                        <a
                          href={validBillingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-bold"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Portal Web</span>
                        </a>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenGmailBilling(ticket);
                          }}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/30 text-xs font-bold"
                        >
                          <Mail className="w-3.5 h-3.5 text-purple-400" />
                          <span>Enviar Correo (Gmail)</span>
                        </button>
                      )}

                      <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectTicket(ticket)}
                          className="px-2.5 py-1.5 text-slate-300 hover:text-blue-400 bg-slate-900 rounded-lg border border-slate-800 font-semibold"
                        >
                          Ver Detalle
                        </button>
                        <button
                          onClick={() => onDeleteTicket(ticket.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-900 rounded-lg border border-slate-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="p-8 sm:p-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 text-slate-500 flex items-center justify-center border border-slate-800">
              <Receipt className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-300">No se encontraron tickets</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery 
                ? 'No hay comprobantes que coincidan con tu búsqueda.' 
                : 'Aún no has registrado tickets en esta sección. Utiliza el botón "Escanear / Cargar Ticket" para comenzar.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
