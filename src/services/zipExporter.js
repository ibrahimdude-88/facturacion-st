import JSZip from 'jszip';
import { buildPDFDoc } from './pdfExporter';

const sanitizeFilename = (name) => {
  if (!name) return 'Comercio_General';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .trim();
};

/**
 * Export ZIP package containing ONLY:
 * 1. PDF Report (Reporte_General_Album.pdf) with active clickable links and KPI summaries
 * 2. Renamed ticket photographs by business name + date in 'imagenes_tickets/'
 * 3. Calls onCompleteCleanup callback to clear storage images while keeping album metadata intact
 */
export const exportBilledTicketsZip = async (tickets, albums, albumName = 'Facturas', onCompleteCleanup) => {
  const zip = new JSZip();

  // 1. Generate PDF Report ArrayBuffer & add to ZIP root
  const cleanAlbumName = sanitizeFilename(albumName);
  const doc = buildPDFDoc(tickets, albums, albumName);
  const pdfArrayBuffer = doc.output('arraybuffer');

  zip.file(`Reporte_General_${cleanAlbumName}.pdf`, pdfArrayBuffer);

  // 2. Add images folder inside ZIP
  const imgFolder = zip.folder('imagenes_tickets');
  const processedTicketIds = [];

  for (let i = 0; i < tickets.length; i++) {
    const tkt = tickets[i];
    const bizClean = sanitizeFilename(tkt.businessName);
    const dateClean = tkt.purchaseDate || 'SinFecha';
    const shortId = (tkt.id || `${i}`).slice(-6);

    let ext = 'webp';
    if (tkt.imageUrl && tkt.imageUrl.includes('image/png')) ext = 'png';
    if (tkt.imageUrl && (tkt.imageUrl.includes('image/jpg') || tkt.imageUrl.includes('image/jpeg'))) ext = 'jpg';

    const filename = `${bizClean}_${dateClean}_${shortId}.${ext}`;

    try {
      if (tkt.imageUrl && tkt.imageUrl.startsWith('data:image')) {
        const base64Data = tkt.imageUrl.split(',')[1];
        imgFolder.file(filename, base64Data, { base64: true });
        processedTicketIds.push(tkt.id);
      } else if (tkt.imageUrl && tkt.imageUrl.startsWith('http')) {
        const res = await fetch(tkt.imageUrl);
        const blob = await res.blob();
        imgFolder.file(filename, blob);
        processedTicketIds.push(tkt.id);
      }
    } catch (err) {
      console.warn(`No se pudo agregar imagen de ${filename} al ZIP:`, err);
    }
  }

  // 3. Generate ZIP blob & trigger browser download
  const content = await zip.generateAsync({ type: 'blob' });
  const dateSuffix = new Date().toISOString().split('T')[0];
  const zipFilename = `Paquete_${cleanAlbumName}_${dateSuffix}.zip`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = zipFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 4. Trigger image cleanup while preserving structured ticket info in the album
  if (onCompleteCleanup && typeof onCompleteCleanup === 'function') {
    setTimeout(() => {
      onCompleteCleanup(processedTicketIds);
    }, 500);
  }
};
