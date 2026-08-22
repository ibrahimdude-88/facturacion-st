import React, { useState, useEffect } from 'react';
import { 
  X, Mail, Download, Copy, Check, ExternalLink, Send, Image as ImageIcon, FileText, Sparkles 
} from 'lucide-react';
import { formatCurrency } from '../Analytics/StatsOverview';

export default function EmailBillingModal({ isOpen, ticket, onClose }) {
  const [emailTo, setEmailTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  useEffect(() => {
    if (ticket) {
      const biz = ticket.businessName || 'Comercio General';
      const date = ticket.purchaseDate || new Date().toISOString().split('T')[0];
      const totalStr = formatCurrency(ticket.total || 0);

      setEmailTo(ticket.billingEmail || '');
      setSubject(`Solicitud de Facturación (CFDI) — ${biz} (${date})`);
      setBody(
`Estimado equipo de ${biz},

Solicito amablemente la emisión de la factura electrónica (CFDI) correspondiente a mi compra realizada el ${date} por un importe total de ${totalStr}.

Adjunto a este correo la fotografía del comprobante de compra.

Mis datos de facturación son los siguientes:
- Nombre / Razón Social: [Tu Nombre o Razón Social]
- RFC: [Tu RFC]
- Uso de CFDI: G03 - Gastos en general
- Régimen Fiscal: [Tu Régimen Fiscal]
- Código Postal: [Tu Código Postal]

Quedo a la espera de su amable confirmación.

Atentamente,`
      );
      setCopiedText(false);
      setCopiedImage(false);
    }
  }, [ticket, isOpen]);

  if (!isOpen || !ticket) return null;

  const handleDownloadPhoto = () => {
    if (!ticket.imageUrl) return;
    try {
      const link = document.createElement('a');
      link.href = ticket.imageUrl;
      const bizClean = (ticket.businessName || 'Ticket').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Ticket_${bizClean}_${ticket.purchaseDate || 'Fecha'}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn('Error al descargar imagen:', err);
    }
  };

  const handleCopyPhotoToClipboard = async () => {
    if (!ticket.imageUrl) return;
    try {
      // Fetch blob and copy to clipboard if supported
      const response = await fetch(ticket.imageUrl);
      const blob = await response.blob();
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type || 'image/png']: blob })
        ]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 3000);
      } else {
        handleDownloadPhoto();
      }
    } catch (err) {
      console.warn('Fallback a descarga directa por restricción del navegador:', err);
      handleDownloadPhoto();
    }
  };

  const handleCopyMessageText = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(body);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    }
  };

  const handleOpenGmail = () => {
    // Also auto-download image so user has it ready in Downloads to attach in Gmail
    handleDownloadPhoto();

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailTo)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };

  const handleOpenDefaultMailClient = () => {
    handleDownloadPhoto();
    const mailtoUrl = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="glass-panel w-full max-w-2xl p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-glass space-y-5 relative my-auto">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Enviar Correo de Facturación</h3>
            <p className="text-xs text-slate-400">
              Redacta, edita tus datos y envía la solicitud por correo electrónico a la empresa.
            </p>
          </div>
        </div>

        {/* Photo Attachment & Download Banner */}
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {ticket.imageUrl ? (
              <img 
                src={ticket.imageUrl} 
                alt="Foto Ticket" 
                className="w-12 h-12 object-cover rounded-lg border border-slate-700 shrink-0" 
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                <ImageIcon className="w-6 h-6" />
              </div>
            )}
            <div>
              <span className="text-xs font-bold text-slate-200 block">Imagen del Ticket lista</span>
              <span className="text-[11px] text-slate-400">Descárgala o cópiala para adjuntarla en tu correo.</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleCopyPhotoToClipboard}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-all"
              title="Copiar imagen al portapapeles"
            >
              {copiedImage ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedImage ? '¡Imagen Copiada!' : 'Copiar Foto'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPhoto}
              className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-all"
              title="Descargar imagen en carpeta de Descargas"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Descargar Foto</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="space-y-3 text-xs">
          {/* Email To */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Correo Electrónico Destinatario (Emisor)
            </label>
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="facturacion@comercio.com"
              className="w-full px-3 py-2 rounded-xl glass-input text-xs"
            />
          </div>

          {/* Email Subject */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Asunto del Correo
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input text-xs font-medium"
            />
          </div>

          {/* Email Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-300 font-semibold">
                Cuerpo del Mensaje (Editable)
              </label>
              <button
                type="button"
                onClick={handleCopyMessageText}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1"
              >
                {copiedText ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedText ? '¡Texto Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input text-xs font-mono leading-relaxed resize-y"
            />
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleOpenDefaultMailClient}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center justify-center space-x-1.5"
              title="Abrir con tu aplicación de correo por defecto (Outlook, Apple Mail, etc.)"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Cliente Predeterminado</span>
            </button>

            <button
              type="button"
              onClick={handleOpenGmail}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-glow transition-all flex items-center justify-center space-x-2 active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Abrir en Gmail Web</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
