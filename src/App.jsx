import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthGuard from './components/AuthGuard';
import StatsOverview from './components/Analytics/StatsOverview';
import AlbumGrid from './components/Albums/AlbumGrid';
import AlbumModal from './components/Albums/AlbumModal';
import TicketsTable from './components/Tickets/TicketsTable';
import TicketUploadModal from './components/Tickets/TicketUploadModal';
import TicketDrawer from './components/Tickets/TicketDrawer';
import EmailBillingModal from './components/Tickets/EmailBillingModal';
import AdminDashboardModal from './components/Admin/AdminDashboardModal';
import ApiKeyModal from './components/ApiKeyModal';

import { 
  isFirebaseConfigured, 
  auth, 
  db, 
  storage, 
  logoutUser, 
  subscribeToAuthChanges 
} from './services/firebase';

import { exportBilledTicketsZip } from './services/zipExporter';
import { exportExecutivePDFReport } from './services/pdfExporter';

import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { 
  FolderX, AlertTriangle 
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);

  // Theme State ('dark' | 'light')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('fs_theme') || 'dark';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('fs_theme', nextTheme);
  };

  // Core Data State (100% Cloud Firestore Realtime Sync)
  const [albums, setAlbums] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);

  // Modals & Drawers UI State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [emailModalTicket, setEmailModalTicket] = useState(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [noAlbumWarningModal, setNoAlbumWarningModal] = useState({ isOpen: false, message: '' });

  // Album Modal state
  const [albumModal, setAlbumModal] = useState({ isOpen: false, mode: 'create', album: null });

  // 1. Auth Subscription & Profile Registration
  useEffect(() => {
    if (isFirebaseConfigured) {
      const unsubscribe = subscribeToAuthChanges((currentUser) => {
        setUser(currentUser);
        if (currentUser && db) {
          setDoc(doc(db, 'user_profiles', currentUser.uid), {
            uid: currentUser.uid,
            email: currentUser.email || 'Sin correo',
            displayName: currentUser.displayName || currentUser.email || 'Usuario Google',
            photoURL: currentUser.photoURL || null,
            lastActive: new Date().toISOString(),
          }, { merge: true }).catch(err => console.warn('User profile sync notice:', err.message));
        } else if (!currentUser) {
          setAlbums([]);
          setTickets([]);
          setSelectedAlbumId(null);
          setSelectedTicket(null);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  const handleLogout = async () => {
    if (isFirebaseConfigured) {
      await logoutUser();
    }
    setUser(null);
    setAlbums([]);
    setTickets([]);
    setSelectedAlbumId(null);
    setSelectedTicket(null);
  };

  // 2. Pure Cloud Firestore Realtime Subscriptions
  useEffect(() => {
    const activeUid = user?.uid;

    if (!activeUid || !isFirebaseConfigured || !db) {
      setAlbums([]);
      setTickets([]);
      setSelectedAlbumId(null);
      setSelectedTicket(null);
      return;
    }

    // Subscribe to Albums in Cloud Firestore (Excluding any legacy 'General' album)
    const albumsRef = collection(db, 'albums');
    const qAlbums = query(albumsRef, where('userId', '==', activeUid));
    const unsubAlbums = onSnapshot(qAlbums, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const customAlbums = list.filter(a => a.name && a.name.trim().toLowerCase() !== 'general');
      setAlbums(customAlbums);
    }, (err) => console.warn('Snapshot albums error:', err.message));

    // Subscribe to Tickets in Cloud Firestore
    const ticketsRef = collection(db, 'tickets');
    const qTickets = query(ticketsRef, where('userId', '==', activeUid));
    const unsubTickets = onSnapshot(qTickets, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTickets(list);
    }, (err) => console.warn('Snapshot tickets error:', err.message));

    return () => {
      unsubAlbums();
      unsubTickets();
    };
  }, [user?.uid]);

  // Open Upload Handler with Album Requirement Validation
  const handleOpenUpload = () => {
    if (!selectedAlbumId) {
      if (albums.length === 0) {
        setNoAlbumWarningModal({
          isOpen: true,
          message: 'No tienes ningún álbum creado todavía. Para escanear o guardar tickets, primero debes crear un álbum.'
        });
      } else {
        setNoAlbumWarningModal({
          isOpen: true,
          message: 'Estás viendo "Todos los comprobantes". No es posible agregar tickets aquí. Por favor selecciona un álbum de tu lista para continuar.'
        });
      }
      return;
    }

    const currentAlbum = albums.find(a => a.id === selectedAlbumId);
    if (!currentAlbum) {
      setNoAlbumWarningModal({
        isOpen: true,
        message: 'Por favor selecciona un álbum activo antes de agregar comprobantes.'
      });
      return;
    }

    setIsUploadOpen(true);
  };

  // ----------------------------------------------------
  // Album Actions (100% Cloud Firestore)
  // ----------------------------------------------------
  const handleCreateAlbum = async (name) => {
    const activeUserId = user?.uid;
    if (!activeUserId || !isFirebaseConfigured || !db) return;

    const cleanName = name.trim();
    if (!cleanName) return;

    try {
      const docRef = await addDoc(collection(db, 'albums'), {
        userId: activeUserId,
        userEmail: user?.email || 'Usuario',
        name: cleanName,
        createdAt: new Date().toISOString(),
        isArchived: false,
      });
      setSelectedAlbumId(docRef.id);
    } catch (err) {
      console.error('Error al crear álbum en Cloud Firestore:', err);
      alert('Error al crear álbum en la nube: ' + err.message);
    }
  };

  const handleEditAlbum = async (name) => {
    if (!albumModal.album || !user?.uid || !db) return;
    const cleanName = name.trim();
    if (!cleanName) return;

    try {
      await updateDoc(doc(db, 'albums', albumModal.album.id), { name: cleanName });
    } catch (err) {
      console.error('Error al editar álbum en Cloud Firestore:', err);
    }
  };

  const handleDeleteAlbum = async (albumId) => {
    if (!user?.uid || !db) return;

    if (selectedAlbumId === albumId) {
      setSelectedAlbumId(null);
    }

    try {
      await deleteDoc(doc(db, 'albums', albumId));
    } catch (err) {
      console.error('Error al eliminar álbum en Cloud Firestore:', err);
    }
  };

  const handleToggleArchiveAlbum = async (albumId) => {
    const alb = albums.find(a => a.id === albumId);
    if (!alb || !user?.uid || !db) return;

    const nextArchived = !alb.isArchived;
    const todayStr = new Date().toLocaleDateString('es-MX');

    try {
      await updateDoc(doc(db, 'albums', albumId), {
        isArchived: nextArchived,
        archivedAt: nextArchived ? todayStr : null
      });
    } catch (err) {
      console.error('Error al archivar álbum en Cloud Firestore:', err);
    }
  };

  // ----------------------------------------------------
  // Ticket Actions (100% Cloud Storage & Cloud Firestore)
  // ----------------------------------------------------
  const handleSaveNewTicket = async (ticketData) => {
    const activeUserId = user?.uid;
    if (!activeUserId || !isFirebaseConfigured || !db) return;

    let finalImageUrl = ticketData.imageUrl || '';

    // 1. Upload photo file to Firebase Storage if available (with 4s timeout safeguard)
    if (ticketData.imageFile && storage) {
      try {
        const fileRef = ref(storage, `users/${activeUserId}/tickets/${Date.now()}_${ticketData.imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
        
        const storageUploadPromise = (async () => {
          const uploadSnap = await uploadBytes(fileRef, ticketData.imageFile);
          return await getDownloadURL(uploadSnap.ref);
        })();

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Storage timeout (4s)')), 4000)
        );

        finalImageUrl = await Promise.race([storageUploadPromise, timeoutPromise]);
      } catch (uploadErr) {
        console.warn('Fallback a imagen WebP optimizada por timeout/aviso de Storage:', uploadErr.message);
        finalImageUrl = ticketData.imageUrl || '';
      }
    }

    // Target Album ID validation
    const targetAlbumId = ticketData.albumId || selectedAlbumId || albums[0]?.id;

    // 2. Save ticket document directly into Cloud Firestore
    const payload = {
      albumId: targetAlbumId,
      userId: activeUserId,
      userEmail: user?.email || 'Usuario',
      imageUrl: finalImageUrl,
      businessName: ticketData.businessName || 'Comercio General',
      purchaseDate: ticketData.purchaseDate || new Date().toISOString().split('T')[0],
      items: ticketData.items || [],
      subtotal: Number(ticketData.subtotal) || 0,
      discount: Number(ticketData.discount) || 0,
      iva: Number(ticketData.iva) || 0,
      tip: Number(ticketData.tip) || 0,
      total: Number(ticketData.total) || 0,
      billingUrl: ticketData.billingUrl || '',
      billingEmail: ticketData.billingEmail || '',
      qrData: ticketData.qrData || '',
      isBilled: false,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    try {
      return await addDoc(collection(db, 'tickets'), payload);
    } catch (err) {
      console.error('Error al guardar ticket en Cloud Firestore:', err);
    }
  };

  const handleToggleBilled = async (ticketId, isBilled) => {
    if (!user?.uid || !db) return;

    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, isBilled } : null);
    }

    try {
      await updateDoc(doc(db, 'tickets', ticketId), { isBilled });
    } catch (err) {
      console.error('Error al actualizar estado en Cloud Firestore:', err);
    }
  };

  const handleSaveEditedTicket = async (ticketData) => {
    if (!user?.uid || !db) return;
    setSelectedTicket(ticketData);

    try {
      const { id, ...dataToUpdate } = ticketData;
      await updateDoc(doc(db, 'tickets', id), dataToUpdate);
    } catch (err) {
      console.error('Error al guardar ticket en Cloud Firestore:', err);
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    if (!user?.uid || !db) return;

    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(null);
    }

    try {
      await deleteDoc(doc(db, 'tickets', ticketId));
    } catch (err) {
      console.error('Error al eliminar ticket en Cloud Firestore:', err);
    }
  };

  // Export handlers
  const handleExportZip = () => {
    const selectedAlbum = albums.find(a => a.id === selectedAlbumId);
    const albumTickets = selectedAlbumId 
      ? tickets.filter(t => t.albumId === selectedAlbumId)
      : tickets;

    exportBilledTicketsZip(albumTickets, selectedAlbum?.name || 'Todos los comprobantes');
  };

  const handleExportPdf = () => {
    const selectedAlbum = albums.find(a => a.id === selectedAlbumId);
    const albumTickets = selectedAlbumId 
      ? tickets.filter(t => t.albumId === selectedAlbumId)
      : tickets;

    exportExecutivePDFReport(albumTickets, selectedAlbum?.name || 'Todos los comprobantes');
  };

  return (
    <div className={`min-screen-vh flex flex-col font-sans transition-colors duration-300 ${
      theme === 'light' ? 'theme-light bg-slate-100 text-slate-800' : 'theme-dark bg-slate-950 text-slate-100'
    }`}>
      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenApiKeyModal={() => setApiKeyModalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
      />

      <AuthGuard user={user}>
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          
          {/* Analytics Summary */}
          <StatsOverview 
            tickets={tickets}
            albums={albums}
            selectedAlbumId={selectedAlbumId}
            onOpenUpload={handleOpenUpload}
            onExportZip={handleExportZip}
            onExportPdf={handleExportPdf}
          />

          {/* Albums Collection */}
          <AlbumGrid
            albums={albums}
            tickets={tickets}
            selectedAlbumId={selectedAlbumId}
            onSelectAlbum={setSelectedAlbumId}
            onCreateAlbum={() => setAlbumModal({ isOpen: true, mode: 'create', album: null })}
            onEditAlbum={(album) => setAlbumModal({ isOpen: true, mode: 'edit', album })}
            onDeleteAlbum={handleDeleteAlbum}
            onToggleArchiveAlbum={handleToggleArchiveAlbum}
            onOpenUpload={handleOpenUpload}
          />

          {/* Tickets Breakdown Table */}
          <TicketsTable
            tickets={tickets}
            albums={albums}
            selectedAlbumId={selectedAlbumId}
            onToggleBilled={handleToggleBilled}
            onSelectTicket={(ticket) => setSelectedTicket(ticket)}
            onDeleteTicket={handleDeleteTicket}
            onOpenEmailModal={(ticket) => setEmailModalTicket(ticket)}
          />
        </main>
      </AuthGuard>

      {/* Upload Ticket Modal */}
      <TicketUploadModal
        isOpen={isUploadOpen}
        albums={albums}
        selectedAlbumId={selectedAlbumId}
        onClose={() => setIsUploadOpen(false)}
        onSaveTicket={handleSaveNewTicket}
      />

      {/* Detail & Edit Ticket Drawer */}
      <TicketDrawer
        isOpen={Boolean(selectedTicket)}
        ticket={selectedTicket}
        albums={albums}
        onClose={() => setSelectedTicket(null)}
        onSave={handleSaveEditedTicket}
        onDelete={handleDeleteTicket}
        onOpenEmailModal={(ticket) => setEmailModalTicket(ticket)}
      />

      {/* Email Billing Modal */}
      <EmailBillingModal
        isOpen={Boolean(emailModalTicket)}
        ticket={emailModalTicket}
        onClose={() => setEmailModalTicket(null)}
      />

      {/* Admin Dashboard Modal (zippo0189) */}
      <AdminDashboardModal
        isOpen={isAdminModalOpen}
        user={user}
        onClose={() => setIsAdminModalOpen(false)}
        currentAlbums={albums}
        currentTickets={tickets}
      />

      {/* Album Create/Edit Modal */}
      <AlbumModal
        isOpen={albumModal.isOpen}
        mode={albumModal.mode}
        initialName={albumModal.album?.name || ''}
        onClose={() => setAlbumModal({ isOpen: false, mode: 'create', album: null })}
        onSubmit={(name) => {
          if (albumModal.mode === 'create') {
            handleCreateAlbum(name);
          } else {
            handleEditAlbum(name);
          }
        }}
      />

      {/* Warning Modal when user tries to upload ticket without selecting/creating an album */}
      {noAlbumWarningModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-amber-500/40 p-6 space-y-4 text-center shadow-glass relative">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <FolderX className="w-7 h-7" />
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-slate-100">Álbum Requerido</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {noAlbumWarningModal.message}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNoAlbumWarningModal({ isOpen: false, message: '' });
                  setAlbumModal({ isOpen: true, mode: 'create', album: null });
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-glow transition-all"
              >
                + Crear Nuevo Álbum
              </button>
              
              <button
                type="button"
                onClick={() => setNoAlbumWarningModal({ isOpen: false, message: '' })}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
      />
    </div>
  );
}
