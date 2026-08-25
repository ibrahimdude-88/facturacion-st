import React, { useState, useEffect, useRef } from 'react';
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
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc 
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

  // Core Data State (Instant Local Cache + Cloud Firestore Realtime Sync)
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

  // 1. Auth Subscription & User State Reset
  useEffect(() => {
    if (isFirebaseConfigured) {
      const unsubscribe = subscribeToAuthChanges((currentUser) => {
        setUser(currentUser);
        if (!currentUser) {
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

  // Helper to persist user state in LocalStorage & State
  const updateLocalAndCloudState = (newAlbums, newTickets) => {
    const activeUid = user?.uid;
    if (!activeUid) return;
    
    if (newAlbums !== null && newAlbums !== undefined) {
      setAlbums(newAlbums);
      localStorage.setItem(`fs_albums_${activeUid}`, JSON.stringify(newAlbums));
    }
    if (newTickets !== null && newTickets !== undefined) {
      setTickets(newTickets);
      localStorage.setItem(`fs_tickets_${activeUid}`, JSON.stringify(newTickets));
    }
  };

  // 2. Hybrid Persistence Engine (Instant Local Restore + Firestore Realtime Sync)
  useEffect(() => {
    const activeUid = user?.uid;

    if (!activeUid) {
      setAlbums([]);
      setTickets([]);
      setSelectedAlbumId(null);
      setSelectedTicket(null);
      return;
    }

    // 1. Immediately restore cached local data for 0ms render on refresh (F5)
    const cachedAlbums = localStorage.getItem(`fs_albums_${activeUid}`);
    const cachedTickets = localStorage.getItem(`fs_tickets_${activeUid}`);
    const defaultCleanAlbum = [{ 
      id: 'alb_gen_' + activeUid.slice(0, 6), 
      userId: activeUid, 
      userEmail: user?.email || 'Usuario', 
      name: 'General', 
      createdAt: new Date().toISOString(), 
      isArchived: false 
    }];

    if (cachedAlbums) {
      try {
        const parsed = JSON.parse(cachedAlbums);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAlbums(parsed);
        } else {
          setAlbums(defaultCleanAlbum);
        }
      } catch (e) {
        setAlbums(defaultCleanAlbum);
      }
    } else {
      setAlbums(defaultCleanAlbum);
    }

    if (cachedTickets) {
      try {
        const parsed = JSON.parse(cachedTickets);
        if (Array.isArray(parsed)) {
          setTickets(parsed);
        }
      } catch (e) {}
    }

    if (isFirebaseConfigured && db) {
      // Subscribe to Albums in Firestore
      const albumsRef = collection(db, 'albums');
      const qAlbums = query(albumsRef, where('userId', '==', activeUid));
      const unsubAlbums = onSnapshot(qAlbums, (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (list.length > 0) {
          updateLocalAndCloudState(list, null);
        } else {
          // If Firestore has no documents yet, push initial General album to Firestore
          addDoc(collection(db, 'albums'), defaultCleanAlbum[0])
            .catch(err => console.warn('Firestore album init notice:', err.message));
        }
      }, (err) => console.warn('Snapshot albums:', err.message));

      // Subscribe to Tickets in Firestore
      const ticketsRef = collection(db, 'tickets');
      const qTickets = query(ticketsRef, where('userId', '==', activeUid));
      const unsubTickets = onSnapshot(qTickets, (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (list.length > 0) {
          updateLocalAndCloudState(null, list);
        }
      }, (err) => console.warn('Snapshot tickets:', err.message));

      return () => {
        unsubAlbums();
        unsubTickets();
      };
    }
  }, [user?.uid]);

  // ----------------------------------------------------
  // Album Actions (Instant UI + Cloud Firestore Backup)
  // ----------------------------------------------------
  const handleCreateAlbum = async (name) => {
    const activeUserId = user?.uid;
    if (!activeUserId) return;

    const tempId = 'alb_' + Date.now();
    const cleanName = name.trim();
    if (!cleanName) return;

    const newAlbum = {
      id: tempId,
      userId: activeUserId,
      userEmail: user?.email || 'Usuario',
      name: cleanName,
      createdAt: new Date().toISOString(),
      isArchived: false,
    };

    const updatedAlbums = [...albums, newAlbum];
    updateLocalAndCloudState(updatedAlbums, null);

    if (isFirebaseConfigured && db) {
      try {
        const docRef = await addDoc(collection(db, 'albums'), {
          userId: activeUserId,
          userEmail: user?.email || 'Usuario',
          name: cleanName,
          createdAt: new Date().toISOString(),
          isArchived: false,
        });

        // Replace temp ID with Firestore document ID
        setAlbums(prev => {
          const list = prev.map(a => a.id === tempId ? { ...a, id: docRef.id } : a);
          localStorage.setItem(`fs_albums_${activeUserId}`, JSON.stringify(list));
          return list;
        });
      } catch (err) {
        console.warn('Firestore album create notice:', err.message);
      }
    }
  };

  const handleEditAlbum = async (name) => {
    if (!albumModal.album || !user?.uid) return;
    const cleanName = name.trim();
    if (!cleanName) return;

    const updatedAlbums = albums.map(a => a.id === albumModal.album.id ? { ...a, name: cleanName } : a);
    updateLocalAndCloudState(updatedAlbums, null);

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'albums', albumModal.album.id), { name: cleanName });
      } catch (err) {
        console.warn('Firestore album update notice:', err.message);
      }
    }
  };

  const handleDeleteAlbum = async (albumId) => {
    if (!user?.uid) return;
    const updatedAlbums = albums.filter(a => a.id !== albumId);
    updateLocalAndCloudState(updatedAlbums, null);

    if (selectedAlbumId === albumId) {
      setSelectedAlbumId(null);
    }

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'albums', albumId));
      } catch (err) {
        console.warn('Firestore album delete notice:', err.message);
      }
    }
  };

  const handleToggleArchiveAlbum = async (albumId) => {
    const alb = albums.find(a => a.id === albumId);
    if (!alb || !user?.uid) return;

    const nextArchived = !alb.isArchived;
    const todayStr = new Date().toLocaleDateString('es-MX');

    const updatedAlbums = albums.map(a => a.id === albumId ? { ...a, isArchived: nextArchived, archivedAt: nextArchived ? todayStr : null } : a);
    updateLocalAndCloudState(updatedAlbums, null);

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'albums', albumId), {
          isArchived: nextArchived,
          archivedAt: nextArchived ? todayStr : null
        });
      } catch (err) {
        console.warn('Firestore album archive notice:', err.message);
      }
    }
  };

  // ----------------------------------------------------
  // Ticket Actions (Instant UX + Cloud Storage Backup)
  // ----------------------------------------------------
  const handleSaveNewTicket = async (ticketData) => {
    const activeUserId = user?.uid;
    if (!activeUserId) return;

    const newTicketId = 'tkt_' + Date.now();

    const payload = {
      id: newTicketId,
      albumId: ticketData.albumId || (albums[0]?.id || 'alb_1'),
      userId: activeUserId,
      userEmail: user?.email || 'Usuario',
      imageUrl: ticketData.imageUrl || '',
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

    const updatedTickets = [payload, ...tickets];
    updateLocalAndCloudState(null, updatedTickets);

    if (isFirebaseConfigured && db) {
      try {
        const { id, ...docData } = payload;
        const docRef = await addDoc(collection(db, 'tickets'), docData);

        if (ticketData.imageFile && storage) {
          const fileRef = ref(storage, `users/${activeUserId}/tickets/${docRef.id}_${Date.now()}.webp`);
          const uploadSnap = await uploadBytes(fileRef, ticketData.imageFile);
          const storageUrl = await getDownloadURL(uploadSnap.ref);

          await updateDoc(doc(db, 'tickets', docRef.id), { imageUrl: storageUrl });

          setTickets(prev => {
            const list = prev.map(t => t.id === newTicketId ? { ...t, id: docRef.id, imageUrl: storageUrl } : t);
            localStorage.setItem(`fs_tickets_${activeUserId}`, JSON.stringify(list));
            return list;
          });
        }
      } catch (err) {
        console.warn('Firestore ticket create notice:', err.message);
      }
    }
  };

  const handleToggleBilled = async (ticketId, isBilled) => {
    if (!user?.uid) return;
    const updatedTickets = tickets.map(t => t.id === ticketId ? { ...t, isBilled } : t);
    updateLocalAndCloudState(null, updatedTickets);

    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, isBilled } : null);
    }

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'tickets', ticketId), { isBilled });
      } catch (err) {
        console.warn('Firestore toggle billed notice:', err.message);
      }
    }
  };

  const handleSaveEditedTicket = async (ticketData) => {
    if (!user?.uid) return;
    const updatedTickets = tickets.map(t => t.id === ticketData.id ? ticketData : t);
    updateLocalAndCloudState(null, updatedTickets);
    setSelectedTicket(ticketData);

    if (isFirebaseConfigured && db) {
      try {
        const { id, ...dataToUpdate } = ticketData;
        await updateDoc(doc(db, 'tickets', id), dataToUpdate);
      } catch (err) {
        console.warn('Firestore ticket update notice:', err.message);
      }
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    if (!user?.uid) return;
    const updatedTickets = tickets.filter(t => t.id !== ticketId);
    updateLocalAndCloudState(null, updatedTickets);

    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(null);
    }

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'tickets', ticketId));
      } catch (err) {
        console.warn('Firestore ticket delete notice:', err.message);
      }
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
