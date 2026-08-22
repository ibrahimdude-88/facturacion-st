import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

const ensureAbsoluteUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const clean = url.trim();
  if (!clean || clean === '#' || clean === '/') return '';
  if (/^https?:\/\//i.test(clean)) return clean;
  return `https://${clean}`;
};

/**
 * Build jsPDF Document instance for Reporte General de Comprobantes
 */
export const buildPDFDoc = (tickets, albums, albumName = 'Todos los Comprobantes') => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // ~297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // ~210mm

  // Colors Palette
  const darkNavy = [15, 23, 42]; // #0F172A
  const primaryBlue = [37, 99, 235]; // #2563EB
  const emeraldGreen = [16, 185, 129]; // #10B981
  const textDark = [30, 41, 59]; // #1E293B
  const textMuted = [100, 116, 139]; // #64748B

  // 1. Top Header Banner
  doc.setFillColor(...darkNavy);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent Line under header
  doc.setFillColor(...primaryBlue);
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Header Title: Reporte General de Comprobantes
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('FacturaSnap AI — Reporte General de Comprobantes', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Álbum: ${albumName} | Fecha de emisión: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}`, 14, 21);

  // 2. Financial KPI Cards
  const totalAmount = tickets.reduce((acc, t) => acc + (Number(t.total) || 0), 0);
  const totalIva = tickets.reduce((acc, t) => acc + (Number(t.iva) || 0), 0);
  const billedCount = tickets.filter(t => t.isBilled).length;

  const cardY = 36;
  const cardWidth = 84;
  const cardHeight = 22;

  // KPI 1: Total General
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, cardY, cardWidth, cardHeight, 3, 3, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text('TOTAL REGISTRADO', 18, cardY + 7);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryBlue);
  doc.text(formatCurrency(totalAmount), 18, cardY + 16);

  // KPI 2: Impuestos IVA
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(106, cardY, cardWidth, cardHeight, 3, 3, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text('TOTAL IMPUESTOS (IVA 16%)', 110, cardY + 7);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkNavy);
  doc.text(formatCurrency(totalIva), 110, cardY + 16);

  // KPI 3: Estado de Facturación
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(198, cardY, cardWidth, cardHeight, 3, 3, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text('ESTADO DE FACTURACIÓN', 202, cardY + 7);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...emeraldGreen);
  doc.text(`${billedCount} de ${tickets.length} Facturados (${tickets.length > 0 ? Math.round((billedCount / tickets.length) * 100) : 0}%)`, 202, cardY + 16);

  // 3. Table Data Preparation (including Descuento)
  const tableHeaders = [['ID', 'Comercio / Emisor', 'Fecha', 'Álbum', 'Subtotal', 'Descuento', 'IVA', 'Total', 'Estado', 'Portal de Facturación']];

  const tableRows = tickets.map(t => {
    const alb = albums.find(a => a.id === t.albumId);
    const rawUrl = t.billingUrl || t.qrData || '';
    const cleanUrl = ensureAbsoluteUrl(rawUrl);

    return [
      (t.id || '').slice(-8),
      t.businessName || 'Comercio General',
      t.purchaseDate || '',
      alb?.name || 'General',
      formatCurrency(t.subtotal),
      Number(t.discount) > 0 ? `-${formatCurrency(t.discount)}` : '$0.00',
      formatCurrency(t.iva),
      formatCurrency(t.total),
      t.isBilled ? 'Facturado' : 'Pendiente',
      cleanUrl ? 'Abrir Portal' : 'Sin portal'
    ];
  });

  const totalDiscount = tickets.reduce((acc, t) => acc + (Number(t.discount) || 0), 0);

  // Add Summary Row at Bottom
  tableRows.push([
    'TOTAL',
    `Resumen de ${tickets.length} comprobante(s)`,
    '',
    '',
    formatCurrency(tickets.reduce((acc, t) => acc + (Number(t.subtotal) || 0), 0)),
    totalDiscount > 0 ? `-${formatCurrency(totalDiscount)}` : '$0.00',
    formatCurrency(totalIva),
    formatCurrency(totalAmount),
    '',
    ''
  ]);

  // 4. Render Table with jsPDF AutoTable
  autoTable(doc, {
    startY: 64,
    head: tableHeaders,
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: darkNavy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: textDark,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' }, // ID
      1: { cellWidth: 44, fontStyle: 'bold' }, // Comercio
      2: { cellWidth: 20, halign: 'center' }, // Fecha
      3: { cellWidth: 28 }, // Álbum
      4: { cellWidth: 24, halign: 'right' }, // Subtotal
      5: { cellWidth: 24, halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }, // Descuento
      6: { cellWidth: 22, halign: 'right' }, // IVA
      7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }, // Total
      8: { cellWidth: 22, halign: 'center' }, // Estado
      9: { cellWidth: 38, halign: 'center' }, // Portal URL Link
    },
    didParseCell: function (data) {
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = darkNavy;
      }
      if (data.column.index === 8 && data.section === 'body' && data.row.index < tableRows.length - 1) {
        if (data.cell.raw === 'Facturado') {
          data.cell.styles.textColor = emeraldGreen;
          data.cell.styles.fontStyle = 'bold';
        }
      }
      if (data.column.index === 9 && data.section === 'body' && data.row.index < tableRows.length - 1) {
        if (data.cell.raw === 'Abrir Portal') {
          data.cell.styles.textColor = primaryBlue;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawCell: function (data) {
      if (data.column.index === 9 && data.section === 'body' && data.row.index < tableRows.length - 1) {
        const ticketObj = tickets[data.row.index];
        const rawUrl = ticketObj?.billingUrl || ticketObj?.qrData || '';
        const cleanUrl = ensureAbsoluteUrl(rawUrl);

        if (cleanUrl && data.cell.text[0] === 'Abrir Portal') {
          doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: cleanUrl });
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // 5. Add Page Numbers & Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text(`FacturaSnap AI — Reporte General de Comprobantes`, 14, pageHeight - 8);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 30, pageHeight - 8);
  }

  return doc;
};

/**
 * Directly download PDF
 */
export const exportExecutivePDFReport = (tickets, albums, albumName = 'Todos los Comprobantes') => {
  const doc = buildPDFDoc(tickets, albums, albumName);
  const dateSuffix = new Date().toISOString().split('T')[0];
  const pdfFilename = `Reporte_General_${albumName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateSuffix}.pdf`;
  doc.save(pdfFilename);
};
