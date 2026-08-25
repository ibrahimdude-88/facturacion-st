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

  // Album Modal state
  const [albumModal, setAlbumModal] = useState({ isOpen: false, mode: 'create', album: null });

  // 1. Auth Subscription & Profile Registration
  useEffect(() => {
    if (isFirebaseConfigured) {
      const unsubscribe = subscribeToAuthChanges((currentUser) => {
        setUser(currentUser);
        if (currentUser && db) {
          // Register or update user profile in Firestore
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

    // Subscribe to Albums in Cloud Firestore
    const albumsRef = collection(db, 'albums');
    const qAlbums = query(albumsRef, where('userId', '==', activeUid));
    const unsubAlbums = onSnapshot(qAlbums, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      if (list.length > 0) {
        setAlbums(list);
      } else {
        // Auto-create default 'General' album in Cloud Firestore if user has no albums
        addDoc(collection(db, 'albums'), {
          userId: activeUid,
          userEmail: user?.email || 'Usuario',
          name: 'General',
          createdAt: new Date().toISOString(),
          isArchived: false,
        }).catch(err => console.warn('Firestore album init notice:', err.message));
      }
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

  // ----------------------------------------------------
  // Album Actions (100% Cloud Firestore)
  // ----------------------------------------------------
  const handleCreateAlbum = async (name) => {
    const activeUserId = user?.uid;
    if (!activeUserId || !isFirebaseConfigured || !db) return;

    const cleanName = name.trim();
    if (!cleanName) return;

    try {
      await addDoc(collection(db, 'albums'), {
        userId: activeUserId,
        userEmail: user?.email || 'Usuario',
        name: cleanName,
        createdAt: new Date().toISOString(),
        isArchived: false,
      });
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

    // 1. Upload photo file to Firebase Storage if available
    if (ticketData.imageFile && storage) {
      try {
        const fileRef = ref(storage, `users/${activeUserId}/tickets/${Date.now()}_${ticketData.imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
        const uploadSnap = await uploadBytes(fileRef, ticketData.imageFile);
        finalImageUrl = await getDownloadURL(uploadSnap.ref);
      } catch (uploadErr) {
        console.warn('Advertencia de carga en Firebase Storage:', uploadErr.message);
      }
    }

    // 2. Save ticket document directly into Cloud Firestore
    const payload = {
      albumId: ticketData.albumId || (albums[0]?.id || 'alb_1'),
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
      await addDoc(collection(db, 'tickets'), payload);
    } catch (err) {
      console.error('Error al guardar ticket en Cloud Firestore:', err);
      alert('Error al guardar el ticket en la nube de Firebase: ' + err.message);
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

    exportBilledTicketsZip(albumTickets, selectedAlbum?.name || 'General');
  };

  const handleExportPdf = () => {
    const selectedAlbum = albums.find(a => a.id === selectedAlbumId);
    const albumTickets = selectedAlbumId 
      ? tickets.filter(t => t.albumId === selectedAlbumId)
      : tickets;

    exportExecutivePDFReport(albumTickets, selectedAlbum?.name || 'General');
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
            onOpenUpload={() => setIsUploadOpen(true)}
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
            onOpenUpload={() => setIsUploadOpen(true)}
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

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
      />
    </div>
  );
}
