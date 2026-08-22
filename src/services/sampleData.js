// Default initial clean state for new users
export const INITIAL_ALBUMS = [
  {
    id: 'alb_1',
    userId: 'default_user',
    name: 'General',
    createdAt: new Date().toISOString(),
  }
];

export const INITIAL_TICKETS = [];

// Demo data only loaded when explicitly clicking "Explorar en Modo Demostración"
export const DEMO_SAMPLE_ALBUMS = [
  {
    id: 'alb_demo_1',
    userId: 'demo_user_123',
    name: 'Gastos de Representación (Agosto)',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'alb_demo_2',
    userId: 'demo_user_123',
    name: 'Viaje a Monterrey (Conferencia Tech)',
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
  }
];

export const DEMO_SAMPLE_TICKETS = [
  {
    id: 'tkt_demo_101',
    albumId: 'alb_demo_1',
    userId: 'demo_user_123',
    imageUrl: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=800&auto=format&fit=crop&q=80',
    businessName: 'Starbucks Coffee Zona Rosa',
    purchaseDate: '2026-08-15',
    items: [
      { description: 'Flat White 16oz', quantity: 2, unitPrice: 85.00, amount: 170.00 },
      { description: 'Crossaint de Jamón y Queso', quantity: 1, unitPrice: 79.00, amount: 79.00 },
    ],
    subtotal: 214.65,
    iva: 34.35,
    tip: 25.00,
    total: 274.00,
    billingUrl: 'https://factura.alsea.com.mx',
    qrData: 'https://factura.alsea.com.mx?ticket=8492049182',
    isBilled: false,
    status: 'completed',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  }
];
