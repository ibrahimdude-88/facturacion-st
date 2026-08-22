# 🧾 FacturaSnap AI - Gestión Inteligente de Tickets y Facturación

Aplicación web Full-Stack moderna para la gestión inteligente de comprobantes de compra, desgloses fiscales y seguimiento de facturación electrónica. Desarrollada con **React (Vite)**, **Tailwind CSS**, **Google Gemini 2.5 Flash AI** y **Firebase Suite ($0 Free Tier)**.

---

## ⚡ Características Principales

1. **Autenticación Exclusiva con Google (Google Sign-In):**
   - Rutas protegidas, gestión de sesiones seguras y persistencia.
2. **Escaneo QR en Navegador (Cliente):**
   - Lectura rápida usando `jsQR` directamente en el navegador antes de la subida para extraer URLs de portales de facturación o folios fiscales.
3. **Compresión Automática de Imágenes (< 500 KB):**
   - Compresión con HTML Canvas API a formato WebP/JPEG optimizando el uso de **Firebase Storage** dentro de la capa gratuita ($0 costo).
4. **Extracción con Inteligencia Artificial (Gemini 2.5 Flash):**
   - Análisis visual estructurado (`responseSchema` JSON) que captura: Nombre del negocio/emisor, fecha, productos/servicios con cantidades y precios unitarios, subtotal, IVA, propina, total y URL de facturación.
5. **Dashboard de Álbumes y Métricas:**
   - Organización por álbumes (ej. *"Gastos Agosto"*, *"Viajes"*).
   - Indicadores visuales de porcentaje de facturación completada y montos acumulados.
6. **Tabla Dinámica y Visor Drawer Interactivo (Split View):**
   - Switch de estado "Facturado" (`isBilled`) en tiempo real.
   - Visor de fotos con zoom, rotación y pantalla completa a la izquierda; desglose y edición de campos a la derecha.
   - Filtros rápidos por estado ("Todos", "Pendientes", "Facturados"), buscador en vivo y exportación a archivo **CSV**.

---

## 🛠️ Requisitos Previos e Instalación Local

### 1. Clonar e Instalar Dependencias
```bash
# Entrar al proyecto
cd Facturacion

# Instalar paquetes npm
npm install

# Iniciar servidor de desarrollo local
npm run dev
```

---

## 🔐 Configuración de Firebase Console y Gemini API

### Paso 1: Configurar Proyecto en Firebase Console ($0 Free Tier)
1. Ingresa a [Firebase Console](https://console.firebase.google.com/) y crea un nuevo proyecto.
2. **Firebase Authentication:**
   - Ve a *Authentication* -> *Sign-in method*.
   - Habilita el proveedor **Google** y guarda los cambios.
3. **Cloud Firestore:**
   - Ve a *Firestore Database* -> *Crear base de datos*.
   - Selecciona el modo de producción y aplica las reglas del archivo [`firestore.rules`](./firestore.rules).
4. **Firebase Storage:**
   - Ve a *Storage* -> *Comenzar*.
   - Aplica las reglas del archivo [`storage.rules`](./storage.rules).
5. **Registrar Aplicación Web:**
   - En la configuración del proyecto, añade una aplicación Web (`</>`) y copia el objeto `firebaseConfig`.

### Paso 2: Obtener Gemini 2.5 Flash API Key
1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Crea una API Key para utilizar el modelo `gemini-2.5-flash`.

### Paso 3: Configurar Variables de Entorno (`.env`)
Crea un archivo `.env` en la raíz del proyecto basándote en `.env.example`:

```env
VITE_FIREBASE_API_KEY=tu_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
VITE_FIREBASE_APP_ID=tu_app_id

VITE_GEMINI_API_KEY=tu_gemini_api_key
```

---

## 🚀 Despliegue en Firebase Hosting y Dominio Personalizado

### Paso 1: Compilar la Aplicación
```bash
npm run build
```

### Paso 2: Iniciar Sesión y Desplegar con Firebase CLI
```bash
# Iniciar sesión en Firebase (si no lo has hecho antes)
npx firebase login

# Vincular tu proyecto de Firebase
npx firebase use --add

# Desplegar a Firebase Hosting
npx firebase deploy --only hosting
```

---

## 🌐 Vinculación a una URL / Dominio Personalizado

Para que tu aplicación funcione con tu propio dominio (ej: `https://facturas.tudominio.com`):

### 1. Vincular Dominio en Firebase Hosting:
1. En Firebase Console, ve a **Hosting**.
2. Haz clic en **Agregar dominio personalizado**.
3. Ingresa tu dominio o subdominio (ej: `facturas.tudominio.com`).
4. Firebase te proporcionará los **Registros A** y **Registro TXT** de verificación.
5. Inicia sesión en tu proveedor de DNS (Cloudflare, GoDaddy, Namecheap, etc.) y añade los registros proporcionados.
6. Firebase Hosting generará automáticamente un **Certificado SSL Gratuito**.

### 2. Autorizar el Dominio en Firebase Authentication (¡CRÍTICO!):
Para que el inicio de sesión con Google funcione en tu URL personalizada:
1. Ve a **Authentication** en Firebase Console.
2. Selecciona la pestaña **Settings** (Configuración) -> **Authorized Domains** (Dominios autorizados).
3. Haz clic en **Add Domain** (Agregar dominio).
4. Escribe tu dominio personalizado (ej: `facturas.tudominio.com`).
5. ¡Listo! Ahora Google Sign-In funcionará sin bloqueos de origen en tu propia URL.

---

## 📄 Estructura del Proyecto

```
Facturacion/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx               # Barra superior con perfil Google y badges
│   │   ├── AuthGuard.jsx            # Pantalla de acceso e inicio de sesión Google
│   │   ├── ApiKeyModal.jsx          # Información de estado de credenciales
│   │   ├── Analytics/
│   │   │   └── StatsOverview.jsx    # Resumen de totales, IVA, facturados y exportación CSV
│   │   ├── Albums/
│   │   │   ├── AlbumGrid.jsx        # Tarjetas de álbumes con % de facturación
│   │   │   └── AlbumModal.jsx       # Modal de creación/edición de álbumes
│   │   └── Tickets/
│   │       ├── TicketUploadModal.jsx # Carga, lectura QR local y Gemini 2.5 Flash
│   │       ├── TicketsTable.jsx     # Tabla dinámica con filtros y switch Facturado
│   │       ├── TicketDrawer.jsx     # Visor expandible split-screen (Zoom + Desglose)
│   │       └── TicketItemRow.jsx    # Renglón de producto editable
│   ├── services/
│   │   ├── firebase.js              # Inicialización de Auth, Firestore y Storage
│   │   ├── gemini.js                # Extracción estructurada Gemini 2.5 Flash
│   │   ├── qrScanner.js             # Lectura QR local con jsQR
│   │   ├── imageCompressor.js       # Compresión Canvas API a WebP < 500 KB
│   │   └── sampleData.js            # Datos iniciales para modo offline/demo
│   ├── App.jsx                      # Estado global y sync en tiempo real
│   ├── main.jsx                     # Punto de entrada React
│   └── index.css                    # Clases Tailwind y efectos Glassmorphism
├── firestore.rules                  # Reglas de seguridad NoSQL
├── storage.rules                    # Reglas de seguridad para imágenes
├── firebase.json                    # Configuración de Hosting SPA
├── .firebaserc                      # Id de proyecto Firebase
├── .env.example                     # Plantilla de variables de entorno
└── package.json                     # Dependencias del proyecto
```
