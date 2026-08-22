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

// Schema including Discount detection for tickets, percentages, and promotions
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
    billingUrl: { type: "string" }
  },
  required: ["businessName", "purchaseDate", "items", "subtotal", "iva", "total"]
};

/**
 * Robust AI extraction with Percentage & Currency Discount math using gemini-3.5-flash
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
- discount: Monto total en DINERO (MXN) de cualquier DESCUENTO, AHORRO, PROMOCIÓN, REBAJA o CUPÓN. Si el ticket muestra un porcentaje como "20% de descuento", "DTO 20%" o "-20%", DEBES CALCULAR LA CANTIDAD EXACTA EN DINERO (Ejemplo: si la suma original es $910 y el total final es $890, el discount es 20.00). Si la suma de productos a precio regular es mayor al total final pagado, la diferencia ES EL DISCOUNT.
- iva: IVA numérico (o 0 si no se desglose).
- tip: Propina numérica (o 0).
- total: Importe TOTAL final pagado impreso en el ticket.
- billingUrl: Enlace o sitio web de facturación impreso en el ticket (si existe).`;

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

  const itemsRawSum = items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0); // e.g. 180 + 630 + 100 = 910
  const itemsAmountSum = items.reduce((acc, i) => acc + (i.amount || (i.quantity * i.unitPrice)), 0); // e.g. 180 + 630 + 80 = 890
  
  let rawSubtotal = Number(data.subtotal) || 0;
  let rawDiscount = Number(data.discount) || 0;
  const rawIva = Number(data.iva) || 0;
  const rawTip = Number(data.tip) || 0;
  const rawTotal = Number(data.total) || 0;

  // 1. If rawSubtotal is 0 or less than itemsRawSum, set rawSubtotal = itemsRawSum
  if (itemsRawSum > 0 && (rawSubtotal === 0 || rawSubtotal < itemsRawSum)) {
    rawSubtotal = itemsRawSum;
  }

  // 2. Check if line item discount exists (itemsRawSum > itemsAmountSum)
  if (itemsRawSum > itemsAmountSum && (itemsRawSum - itemsAmountSum) > 0.05) {
    const lineDiscount = Number((itemsRawSum - itemsAmountSum).toFixed(2));
    if (rawDiscount < lineDiscount) {
      rawDiscount = lineDiscount;
    }
  }

  // 3. Check overall mathematical discount (rawSubtotal - rawTotal)
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
    isSimulation: true,
    simulationReason: reason,
  };
};
