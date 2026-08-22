import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export const isGeminiConfigured = Boolean(
  apiKey && 
  apiKey.trim().length > 5 && 
  apiKey !== 'TU_GEMINI_API_KEY'
);

let genAI = null;

if (isGeminiConfigured) {
  try {
    genAI = new GoogleGenerativeAI(apiKey.trim());
  } catch (err) {
    console.error('Error al inicializar GoogleGenerativeAI:', err);
  }
}

// Schema including Discount and Billing Email detection
const ticketResponseSchema = {
  type: "object",
  properties: {
    businessName: { type: "string", description: "Nombre comercial impreso en el encabezado" },
    purchaseDate: { type: "string", description: "Fecha YYYY-MM-DD" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unitPrice: { type: "number" },
          amount: { type: "number" }
        },
        required: ["description", "quantity", "unitPrice", "amount"]
      }
    },
    subtotal: { type: "number", description: "Subtotal previo a aplicar cualquier descuento" },
    discount: { type: "number", description: "Monto total en dinero (MXN) de descuento, ahorro o cupón. Si es porcentaje (ej. 20%), calcula la cantidad exacta en dinero." },
    iva: { type: "number" },
    tip: { type: "number" },
    total: { type: "number" },
    billingUrl: { type: "string" },
    billingEmail: { type: "string", description: "Correo electrónico de facturación o contacto impreso en el ticket (ej. facturacion@empresa.com), o cadena vacía si no hay." }
  },
  required: ["businessName", "purchaseDate", "items", "subtotal", "iva", "total"]
};

/**
 * Robust AI extraction with Discount & Billing Email detection using gemini-3.5-flash
 */
export const extractTicketWithGemini = async (base64Image, mimeType = 'image/webp') => {
  if (!isGeminiConfigured || !genAI) {
    return getUnparsedFallback('API Key no configurada en .env');
  }

  const prompt = `Analiza detenidamente esta imagen de ticket de compra. Extrae un JSON estricto con:
- businessName: Nombre comercial o razón social en el encabezado del ticket.
- purchaseDate: Fecha de la compra en formato YYYY-MM-DD. Si no es visible, usa la fecha de hoy.
- items: Lista completa de productos o servicios impresos con [{description, quantity, unitPrice, amount}].
- subtotal: Subtotal numérico original PREVIO a aplicar cualquier descuento (suma de precios originales).
- discount: Monto total en DINERO (MXN) de cualquier DESCUENTO, AHORRO, PROMOCIÓN, REBAJA o CUPÓN. Si el ticket muestra un porcentaje como "20% de descuento", "DTO 20%" o "-20%", DEBES CALCULAR LA CANTIDAD EXACTA EN DINERO.
- iva: IVA numérico (o 0 si no se desglose).
- tip: Propina numérica (o 0).
- total: Importe TOTAL final pagado impreso en el ticket.
- billingUrl: Enlace o sitio web de facturación impreso en el ticket (si existe).
- billingEmail: Correo electrónico de facturación impreso en el ticket (ejemplo: facturacion@tienda.com, contacto@comercio.mx). Si no existe, dejar como "".`;

  const imagePart = {
    inlineData: {
      data: base64Image,
      mimeType: mimeType,
    },
  };

  const modelsToTry = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash'];

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: ticketResponseSchema,
          temperature: 0.0,
          maxOutputTokens: 1500,
        },
      });

      const apiCallPromise = model.generateContent([prompt, imagePart]);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout de lectura Gemini (15s)')), 15000)
      );

      const result = await Promise.race([apiCallPromise, timeoutPromise]);
      const responseText = result.response.text();
      
      const parsedData = safeParseJSON(responseText);
      if (parsedData && (parsedData.businessName || parsedData.total > 0 || parsedData.items?.length > 0)) {
        const sanitized = sanitizeTicketData(parsedData);
        sanitized.isSimulation = false;
        return sanitized;
      }
    } catch (err) {
      console.warn(`Falló modelo ${modelName}:`, err.message);
    }
  }

  return getUnparsedFallback('Error en extracción por Inteligencia Artificial');
};

const safeParseJSON = (text) => {
  if (!text) return null;
  try {
    let clean = text.trim();
    if (clean.startsWith('```json')) clean = clean.substring(7);
    if (clean.startsWith('```')) clean = clean.substring(3);
    if (clean.endsWith('```')) clean = clean.substring(0, clean.length - 3);
    clean = clean.trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('Error parseando JSON de Gemini:', err);
    return null;
  }
};

const sanitizeTicketData = (data) => {
  const items = Array.isArray(data.items) 
    ? data.items.map(item => ({
        description: item.description ? String(item.description).trim() : 'Producto General',
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        amount: Number(item.amount) || 0,
      }))
    : [];

  const itemsRawSum = items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);
  const itemsAmountSum = items.reduce((acc, i) => acc + (i.amount || (i.quantity * i.unitPrice)), 0);
  
  let rawSubtotal = Number(data.subtotal) || 0;
  let rawDiscount = Number(data.discount) || 0;
  const rawIva = Number(data.iva) || 0;
  const rawTip = Number(data.tip) || 0;
  const rawTotal = Number(data.total) || 0;

  if (itemsRawSum > 0 && (rawSubtotal === 0 || rawSubtotal < itemsRawSum)) {
    rawSubtotal = itemsRawSum;
  }

  if (itemsRawSum > itemsAmountSum && (itemsRawSum - itemsAmountSum) > 0.05) {
    const lineDiscount = Number((itemsRawSum - itemsAmountSum).toFixed(2));
    if (rawDiscount < lineDiscount) {
      rawDiscount = lineDiscount;
    }
  }

  if (rawSubtotal > 0 && rawTotal > 0 && (rawSubtotal - rawTotal) > 0.05) {
    const MathDiff = Number((rawSubtotal - rawTotal).toFixed(2));
    if (MathDiff > 0.05 && rawDiscount < MathDiff) {
      rawDiscount = MathDiff;
    }
  }

  return {
    businessName: data.businessName ? String(data.businessName).trim() : 'Comercio General',
    purchaseDate: data.purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(data.purchaseDate) 
      ? data.purchaseDate 
      : new Date().toISOString().split('T')[0],
    items: items,
    subtotal: Number(rawSubtotal.toFixed(2)),
    discount: Number(rawDiscount.toFixed(2)),
    iva: Number(rawIva.toFixed(2)),
    tip: Number(rawTip.toFixed(2)),
    total: Number(rawTotal.toFixed(2)),
    billingUrl: data.billingUrl ? String(data.billingUrl).trim() : '',
    billingEmail: data.billingEmail ? String(data.billingEmail).trim() : '',
  };
};

const getUnparsedFallback = (reason = '') => {
  return {
    businessName: 'Ticket sin procesar',
    purchaseDate: new Date().toISOString().split('T')[0],
    items: [{ description: 'Consumo / Compra General', quantity: 1, unitPrice: 0, amount: 0 }],
    subtotal: 0,
    discount: 0,
    iva: 0,
    tip: 0,
    total: 0,
    billingUrl: '',
    billingEmail: '',
    isSimulation: true,
    simulationReason: reason,
  };
};
