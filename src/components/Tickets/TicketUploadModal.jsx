import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Upload, Camera, Sparkles, QrCode, Image as ImageIcon, 
  CheckCircle2, Loader2, AlertCircle, ExternalLink, Plus, Trash2, Folder, Layers, Clock, ShieldAlert, Mail 
} from 'lucide-react';
import { compressTicketImage } from '../../services/imageCompressor';
import { scanQRCodeFromImage } from '../../services/qrScanner';
import { extractTicketWithGemini } from '../../services/gemini';
import { formatCurrency } from '../Analytics/StatsOverview';

const MAX_TICKETS_PER_MINUTE = 15;
const RATE_LIMIT_WINDOW_MS = 60000; // 60 seconds

export default function TicketUploadModal({ isOpen, albums, selectedAlbumId, onClose, onSaveTicket }) {
  const [step, setStep] = useState('idle'); // 'idle' | 'processing' | 'review'
  
  // Rate Limiting & Waiting Cooldown state
  const [uploadTimestamps, setUploadTimestamps] = useState([]);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [rateLimitNotice, setRateLimitNotice] = useState('');

  // Progress & Accurate Estimated Time state
  const [processingProgress, setProcessingProgress] = useState({ 
    completed: 0, 
    total: 0, 
    percent: 0,
    text: '',
    estimatedSecondsLeft: 0
  });

  // List of processed tickets in batch
  const [batchTickets, setBatchTickets] = useState([]);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const cooldownIntervalRef = useRef(null);

  // Load and clean rate limit timestamps
  useEffect(() => {
    const saved = localStorage.getItem('fs_rate_limit_timestamps');
    const now = Date.now();
    let currentTimestamps = saved ? JSON.parse(saved) : [];
    
    // Filter timestamps older than 60s
    currentTimestamps = currentTimestamps.filter(t => (now - t) < RATE_LIMIT_WINDOW_MS);
    setUploadTimestamps(currentTimestamps);
    localStorage.setItem('fs_rate_limit_timestamps', JSON.stringify(currentTimestamps));

    // Calculate active cooldown if max tickets reached
    if (currentTimestamps.length >= MAX_TICKETS_PER_MINUTE) {
      const oldestInWindow = currentTimestamps[0];
      const remainingMs = RATE_LIMIT_WINDOW_MS - (now - oldestInWindow);
      const remainingSecs = Math.max(1, Math.ceil(remainingMs / 1000));
      setCooldownSeconds(remainingSecs);
    }
  }, [isOpen]);

  // Cooldown countdown interval
  useEffect(() => {
    if (cooldownSeconds > 0) {
      cooldownIntervalRef.current = setInterval(() => {
        setCooldownSeconds(prev => {
          if (prev <= 1) {
            clearInterval(cooldownIntervalRef.current);
            setRateLimitNotice('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
      };
    }
  }, [cooldownSeconds]);

  // Clean processing timer on unmount/close
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // Calculate current available slots
  const now = Date.now();
  const activeCountInWindow = uploadTimestamps.filter(t => (now - t) < RATE_LIMIT_WINDOW_MS).length;
  const availableSlots = Math.max(0, MAX_TICKETS_PER_MINUTE - activeCountInWindow);
  const isCooldownActive = cooldownSeconds > 0 || availableSlots === 0;

  // Real-Time Parallel Batch Processing with Accurate Countdown
  const handleMultipleFilesSelect = async (fileList) => {
    let files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const currentTime = Date.now();
    const validTimestamps = uploadTimestamps.filter(t => (currentTime - t) < RATE_LIMIT_WINDOW_MS);

    // Enforce 15 tickets per minute limit
    if (validTimestamps.length >= MAX_TICKETS_PER_MINUTE) {
      const oldest = validTimestamps[0];
      const remainingMs = RATE_LIMIT_WINDOW_MS - (currentTime - oldest);
      const remainingSecs = Math.ceil(remainingMs / 1000);
      setCooldownSeconds(remainingSecs);
      setRateLimitNotice(`Límite de 15 tickets por minuto alcanzado. Tiempo de espera activo.`);
      return;
    }

    const totalSelectedCount = files.length;

    if (totalSelectedCount > availableSlots) {
      const trimmedCount = totalSelectedCount - availableSlots;
      setRateLimitNotice(`⚠️ Seleccionaste ${totalSelectedCount} tickets. Para no superar el límite de 15 por minuto, se procesaron ${availableSlots} ticket(s). El ticket restante podrás subirlo en unos segundos.`);
      files = files.slice(0, availableSlots);
    } else {
      setRateLimitNotice('');
    }

    const newTimestamps = [...validTimestamps, ...files.map(() => Date.now())];
    setUploadTimestamps(newTimestamps);
    localStorage.setItem('fs_rate_limit_timestamps', JSON.stringify(newTimestamps));

    const totalCount = files.length;
    // Precise parallel batch estimation: ~2s for 1-4 tickets, ~3s for 5+ tickets
    const realEstimatedSeconds = totalCount <= 4 ? 2 : 3;

    setStep('processing');
    setBatchTickets([]);
    setProcessingProgress({ 
      completed: 0, 
      total: totalCount, 
      percent: 15,
      text: `Analizando ${totalCount} ticket(s) en simultáneo...`,
      estimatedSecondsLeft: realEstimatedSeconds
    });

    // Real-time 1-second ticking countdown timer
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setProcessingProgress(prev => ({
        ...prev,
        estimatedSecondsLeft: Math.max(1, prev.estimatedSecondsLeft - 1)
      }));
    }, 1000);

    try {
      let completedCounter = 0;

      // Process images in parallel
      const parallelPromises = files.map(async (file, i) => {
        const [compressed, decodedQR] = await Promise.all([
          compressTicketImage(file),
          scanQRCodeFromImage(file)
        ]);

        const base64Clean = compressed.dataUrl.split(',')[1];
        const extractedInfo = await extractTicketWithGemini(base64Clean, compressed.file.type);

        completedCounter++;
        const currentPercent = Math.round((completedCounter / totalCount) * 100);

        setProcessingProgress(prev => ({
          ...prev,
          completed: completedCounter,
          percent: Math.min(95, currentPercent),
          text: `Procesados ${completedCounter} de ${totalCount} tickets`
        }));

        return {
          id: 'temp_' + i + '_' + Date.now(),
          albumId: getValidAlbumId(),
          businessName: extractedInfo.businessName || `Ticket #${i + 1}`,
          purchaseDate: extractedInfo.purchaseDate || new Date().toISOString().split('T')[0],
          items: extractedInfo.items || [],
          subtotal: extractedInfo.subtotal || 0,
          discount: extractedInfo.discount || 0,
          iva: extractedInfo.iva || 0,
          tip: extractedInfo.tip || 0,
          total: extractedInfo.total || 0,
          billingUrl: extractedInfo.billingUrl || (decodedQR?.startsWith('http') ? decodedQR : ''),
          billingEmail: extractedInfo.billingEmail || '',
          qrData: decodedQR || extractedInfo.billingUrl || '',
          isBilled: false,
          imageFile: compressed.file,
          imageUrl: compressed.dataUrl,
          simulationNotice: extractedInfo.isSimulation ? extractedInfo.simulationReason : null,
        };
      });

      const processedList = await Promise.all(parallelPromises);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setProcessingProgress(prev => ({ ...prev, percent: 100, estimatedSecondsLeft: 0 }));

      setBatchTickets(processedList);
      setActiveReviewIndex(0);
      setStep('review');
    } catch (err) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      console.error('Error en procesamiento en paralelo:', err);
      setStep('idle');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!isCooldownActive && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMultipleFilesSelect(e.dataTransfer.files);
    }
  };

  // Modify active ticket data in batch
  const updateActiveTicketField = (field, value) => {
    const updated = [...batchTickets];
    updated[activeReviewIndex] = { ...updated[activeReviewIndex], [field]: value };
    setBatchTickets(updated);
  };

  // Bulk set album for all tickets in batch
  const applyAlbumToAll = (albumId) => {
    const updated = batchTickets.map(t => ({ ...t, albumId }));
    setBatchTickets(updated);
  };

  // Remove single ticket from batch
  const handleRemoveFromBatch = (indexToRemove) => {
    const updated = batchTickets.filter((_, idx) => idx !== indexToRemove);
    if (updated.length === 0) {
      setStep('idle');
      return;
    }
    setBatchTickets(updated);
    if (activeReviewIndex >= updated.length) {
      setActiveReviewIndex(updated.length - 1);
    }
  };

  // Item row change in active ticket
  const handleItemChange = (itemIdx, field, value) => {
    const activeTkt = batchTickets[activeReviewIndex];
    const updatedItems = [...activeTkt.items];
    updatedItems[itemIdx] = { ...updatedItems[itemIdx], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const q = Number(field === 'quantity' ? value : updatedItems[itemIdx].quantity) || 0;
      const p = Number(field === 'unitPrice' ? value : updatedItems[itemIdx].unitPrice) || 0;
      updatedItems[itemIdx].amount = Number((q * p).toFixed(2));
    }

    updateActiveTicketField('items', updatedItems);
  };

  const handleAddItem = () => {
    const activeTkt = batchTickets[activeReviewIndex];
    const updatedItems = [...activeTkt.items, { description: 'Nuevo Producto', quantity: 1, unitPrice: 0, amount: 0 }];
    updateActiveTicketField('items', updatedItems);
  };

  const handleRemoveItem = (itemIdx) => {
    const activeTkt = batchTickets[activeReviewIndex];
    const updatedItems = activeTkt.items.filter((_, idx) => idx !== itemIdx);
    updateActiveTicketField('items', updatedItems);
  };

  const getValidAlbumId = () => {
    if (selectedAlbumId && albums.some(a => a.id === selectedAlbumId)) {
      return selectedAlbumId;
    }
    if (albums && albums.length > 0) {
      return albums[0].id;
    }
    return null;
  };

  // Save ALL tickets in batch asynchronously to Firebase Cloud
  const handleSaveAllBatch = async () => {
    if (isSavingBatch || batchTickets.length === 0) return;
    setIsSavingBatch(true);
    try {
      const fallbackAlbumId = getValidAlbumId();

      for (let i = 0; i < batchTickets.length; i++) {
        const ticketData = batchTickets[i];
        const cleanTicket = {
          ...ticketData,
          albumId: (ticketData.albumId && albums.some(a => a.id === ticketData.albumId))
            ? ticketData.albumId
            : fallbackAlbumId
        };
        await onSaveTicket(cleanTicket);
      }
      onClose();
    } catch (err) {
      console.error('Error al guardar el lote de tickets:', err);
      alert('Ocurrió un error al guardar tickets en Firebase: ' + (err.message || err));
    } finally {
      setIsSavingBatch(false);
    }
  };

  const activeTicket = batchTickets[activeReviewIndex] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="glass-panel w-full max-w-4xl rounded-2xl border border-slate-800 shadow-glass overflow-hidden my-6 relative">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Cargar Tickets</h3>
              <p className="text-xs text-slate-400">
                Máximo 15 tickets por minuto | Análisis por lote simultáneo en ~2s
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Cooldown Banner if 15 tickets limit reached */}
        {isCooldownActive && (
          <div className="bg-amber-950/80 border-b border-amber-500/40 p-3 px-5 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-spin" />
              <span className="font-semibold">
                Límite de 15 tickets por minuto alcanzado. Tiempo de espera activo.
              </span>
            </div>

            <div className="font-extrabold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/30 shrink-0 font-mono">
              Espera: {cooldownSeconds}s
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 sm:p-6 max-h-[78vh] overflow-y-auto">
          
          {/* STEP 1: Upload Multiple Files Drop Zone */}
          {step === 'idle' && (
            <div className="space-y-6">
              
              {rateLimitNotice && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{rateLimitNotice}</span>
                </div>
              )}

              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all ${
                  isCooldownActive
                    ? 'border-slate-800 bg-slate-900/20 opacity-60 cursor-not-allowed'
                    : 'border-slate-700 hover:border-blue-500 bg-slate-900/40 hover:bg-blue-600/5 group cursor-pointer'
                }`}
                onClick={() => !isCooldownActive && fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                
                <h4 className="mt-4 text-base font-bold text-slate-200">
                  {isCooldownActive
                    ? `Tiempo de espera activo (${cooldownSeconds}s)`
                    : `Arrastra uno o varios tickets aquí (Máximo 15 por minuto)`}
                </h4>
                
                <p className="text-xs text-slate-400 mt-1">
                  {isCooldownActive
                    ? `Podrás subir más comprobantes en ${cooldownSeconds} segundos.`
                    : `Selección múltiple soportada.`}
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={isCooldownActive}
                  onChange={(e) => e.target.files?.length > 0 && handleMultipleFilesSelect(e.target.files)}
                  className="hidden"
                />

                {/* Mobile Camera Option */}
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    disabled={isCooldownActive}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isCooldownActive) cameraInputRef.current?.click();
                    }}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold border ${
                      isCooldownActive
                        ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Camera className="w-4 h-4 text-blue-400" />
                    <span>Seleccionar / Tomar Fotos</span>
                  </button>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isCooldownActive}
                    capture="environment"
                    onChange={(e) => e.target.files?.length > 0 && handleMultipleFilesSelect(e.target.files)}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Features list */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-2.5">
                  <Layers className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>1. Máximo 15 tickets por minuto.</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-2.5">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>2. Cooldown de espera dinámico.</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>3. Análisis en tiempo real de ~2 segundos.</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Processing Progress & Accurate Countdown Timer */}
          {step === 'processing' && (
            <div className="py-10 px-4 text-center space-y-6 max-w-lg mx-auto">
              
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                <Sparkles className="w-8 h-8 text-blue-400 animate-pulse" />
              </div>
              
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-slate-100">Analizando Lote en Paralelo</h4>
                <p className="text-xs text-blue-400 font-semibold">{processingProgress.text}</p>
                
                {/* Dynamic Progress Bar */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span>Progreso del análisis</span>
                    <span className="font-bold text-blue-400">{processingProgress.percent}%</span>
                  </div>
                  
                  <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800 shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-300 shadow-glow"
                      style={{ width: `${Math.max(10, processingProgress.percent)}%` }}
                    />
                  </div>
                </div>

                {/* Real Countdown Timer Pill */}
                <div className="pt-3 flex items-center justify-center">
                  <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                    <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span>Tiempo estimado restante:</span>
                    <span className="font-extrabold text-amber-400 font-mono">
                      ~{processingProgress.estimatedSecondsLeft} seg{processingProgress.estimatedSecondsLeft !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* STEP 3: Batch Review & Bulk Save */}
          {step === 'review' && activeTicket && (
            <div className="space-y-5">
              
              {rateLimitNotice && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{rateLimitNotice}</span>
                </div>
              )}

              {/* Top Batch Navigation Bar */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs">
                    Lote ({batchTickets.length} tickets)
                  </span>
                  <span className="text-xs text-slate-300 font-semibold">
                    Revisando ticket #{activeReviewIndex + 1} de {batchTickets.length}
                  </span>
                </div>

                {/* Bulk Album Assign Selector */}
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-400">Asignar a todos:</span>
                  <select
                    onChange={(e) => applyAlbumToAll(e.target.value)}
                    className="px-2.5 py-1 rounded-lg glass-input text-xs"
                  >
                    {albums.map((alb) => (
                      <option key={alb.id} value={alb.id} className="bg-slate-900">
                        {alb.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Batch Carousel Chips */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                {batchTickets.map((tkt, idx) => (
                  <button
                    key={tkt.id}
                    onClick={() => setActiveReviewIndex(idx)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-medium shrink-0 transition-all ${
                      activeReviewIndex === idx
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 ring-1 ring-blue-500/40'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>#{idx + 1} {tkt.businessName}</span>
                    <span className="font-bold text-slate-300">${tkt.total}</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFromBatch(idx);
                      }}
                      className="hover:text-rose-400 p-0.5 rounded"
                      title="Quitar de este lote"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </button>
                ))}
              </div>

              {/* Active Ticket Review View */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                
                {/* Left Column: Image Preview */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 max-h-[300px] flex items-center justify-center p-2">
                    <img
                      src={activeTicket.imageUrl}
                      alt="Ticket preview"
                      className="max-h-[280px] w-auto object-contain rounded-lg shadow-md"
                    />
                  </div>

                  {activeTicket.qrData && (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
                        <QrCode className="w-3.5 h-3.5" />
                        <span>QR Detectado:</span>
                      </div>
                      <p className="text-slate-300 break-all text-[11px] font-mono">
                        {activeTicket.qrData}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right Column: Editable Data */}
                <div className="lg:col-span-7 space-y-4">
                  
                  {activeTicket.discount > 0 && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Descuento / Ahorro detectado en este ticket:</span>
                      </div>
                      <span className="font-extrabold text-sm bg-emerald-500/20 px-2.5 py-0.5 rounded-lg border border-emerald-500/40">
                        -${activeTicket.discount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Álbum Destino
                      </label>
                      <select
                        value={activeTicket.albumId}
                        onChange={(e) => updateActiveTicketField('albumId', e.target.value)}
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
                        Fecha de Compra
                      </label>
                      <input
                        type="date"
                        value={activeTicket.purchaseDate}
                        onChange={(e) => updateActiveTicketField('purchaseDate', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Comercio / Emisor
                    </label>
                    <input
                      type="text"
                      value={activeTicket.businessName}
                      onChange={(e) => updateActiveTicketField('businessName', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Enlace Portal de Facturación
                      </label>
                      <input
                        type="text"
                        value={activeTicket.billingUrl || ''}
                        onChange={(e) => updateActiveTicketField('billingUrl', e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-purple-300 mb-1 flex items-center space-x-1">
                        <Mail className="w-3.5 h-3.5 text-purple-400" />
                        <span>Correo de Facturación</span>
                      </label>
                      <input
                        type="email"
                        value={activeTicket.billingEmail || ''}
                        onChange={(e) => updateActiveTicketField('billingEmail', e.target.value)}
                        placeholder="facturacion@empresa.com"
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>

                  {/* Items List */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        Productos / Servicios ({activeTicket.items?.length || 0})
                      </label>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="text-[11px] font-semibold text-blue-400 flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Agregar Renglón</span>
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {activeTicket.items?.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-center space-x-2 text-xs bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(itemIdx, 'description', e.target.value)}
                            className="flex-1 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs"
                          />
                          <input
                            type="number"
                            step="0.5"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(itemIdx, 'quantity', e.target.value)}
                            className="w-12 px-1.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-center"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(itemIdx, 'unitPrice', e.target.value)}
                            className="w-16 px-1.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-right"
                          />
                          <span className="w-16 font-bold text-slate-200 text-right pr-1">
                            ${Number(item.amount || 0).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(itemIdx)}
                            className="p-1 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial Totals (5 columns: Subtotal, Descuento, IVA, Propina, Total) */}
                  <div className="grid grid-cols-5 gap-2 pt-1 border-t border-slate-800">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Subtotal</label>
                      <input
                        type="number"
                        step="0.01"
                        value={activeTicket.subtotal}
                        onChange={(e) => updateActiveTicketField('subtotal', Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg glass-input text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-emerald-400 font-semibold mb-0.5">Descuento</label>
                      <input
                        type="number"
                        step="0.01"
                        value={activeTicket.discount || 0}
                        onChange={(e) => updateActiveTicketField('discount', Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">IVA</label>
                      <input
                        type="number"
                        step="0.01"
                        value={activeTicket.iva}
                        onChange={(e) => updateActiveTicketField('iva', Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg glass-input text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Propina</label>
                      <input
                        type="number"
                        step="0.01"
                        value={activeTicket.tip || 0}
                        onChange={(e) => updateActiveTicketField('tip', Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg glass-input text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-blue-400 font-bold mb-0.5">Total</label>
                      <input
                        type="number"
                        step="0.01"
                        value={activeTicket.total}
                        onChange={(e) => updateActiveTicketField('total', Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-extrabold"
                      />
                    </div>
                  </div>

                </div>

              </div>

              {/* Action Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep('idle')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Volver a cargar
                </button>

                <button
                  type="button"
                  disabled={isSavingBatch}
                  onClick={handleSaveAllBatch}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white shadow-glow transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {isSavingBatch ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Subiendo tickets a la nube de Firebase...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Guardar Todos los Tickets ({batchTickets.length})</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
