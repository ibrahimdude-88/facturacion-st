import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthGuard from './components/AuthGuard';
import StatsOverview from './components/Analytics/StatsOverview';
import AlbumGrid from './components/Albums/AlbumGrid';
import AlbumModal from './components/Albums/AlbumModal';
import TicketsTable from './components/Tickets/TicketsTable';
import TicketUploadModal from './components/Tickets/TicketUploadModal';
import TicketDrawer from './components/Tickets/TicketDrawer';
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
  const [isDemoUser, setIsDemoUser] = useState(false);

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
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  // Album Modal state
  const [albumModal, setAlbumModal] = useState({ isOpen: false, mode: 'create', album: null });

  // 1. Auth Subscription & State Reset
  useEffect(() => {
    if (isFirebaseConfigured) {
      const unsubscribe = subscribeToAuthChanges((currentUser) => {
        setUser(currentUser);
        if (!currentUser) {
          setIsDemoUser(false);
          setAlbums([]);
          setTickets([]);
          setSelectedAlbumId(null);
          setSelectedTicket(null);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // Demo user login handler
  const handleDemoLogin = () => {
    const mockUser = {
      uid: 'demo_user_123',
      displayName: 'Usuario Demostración',
      email: 'demo@facturasnap.ai',
      photoURL: null,
    };
    setUser(mockUser);
    setIsDemoUser(true);
  };

  const handleLogout = async () => {
    if (isFirebaseConfigured && !isDemoUser) {
      await logoutUser();
    }
    setUser(null);
    setIsDemoUser(false);
    setAlbums([]);
    setTickets([]);
    setSelectedAlbumId(null);
    setSelectedTicket(null);
  };

  // 2. Pure Cloud Firestore Realtime Sync
  useEffect(() => {
    const activeUid = user?.uid;

    if (!activeUid) {
      setAlbums([]);
      setTickets([]);
      setSelectedAlbumId(null);
      setSelectedTicket(null);
      return;
    }

    setSelectedAlbumId(null);
    setSelectedTicket(null);

    const isRealUser = isFirebaseConfigured && !isDemoUser && activeUid !== 'demo_user_123';

    if (isRealUser) {
      // Realtime Albums Subscription from Firestore
      const albumsRef = collection(db, 'albums');
      const qAlbums = query(albumsRef, where('userId', '==', activeUid));
      const unsubAlbums = onSnapshot(qAlbums, (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (list.length > 0) {
          setAlbums(list);
        } else {
          // Initialize clean default "General" album in Firestore for new accounts
          addDoc(collection(db, 'albums'), {
            userId: activeUid,
            name: 'General',
            createdAt: new Date().toISOString(),
            isArchived: false
          }).catch(err => console.warn('Error al crear álbum por defecto:', err.message));
        }
      }, (err) => console.warn('Snapshot albums:', err.message));

      // Realtime Tickets Subscription from Firestore
      const ticketsRef = collection(db, 'tickets');
      const qTickets = query(ticketsRef, where('userId', '==', activeUid));
      const unsubTickets = onSnapshot(qTickets, (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setTickets(list);
      }, (err) => console.warn('Snapshot tickets:', err.message));

      return () => {
        unsubAlbums();
        unsubTickets();
      };
    } else if (isDemoUser) {
      // Demo session memory state
      const demoAlbum = [{ id: 'alb_demo_gen', userId: 'demo_user_123', name: 'General', createdAt: new Date().toISOString(), isArchived: false }];
      setAlbums(demoAlbum);
      setTickets([]);
    }
  }, [user?.uid, isDemoUser]);

  // ----------------------------------------------------
  // Album Actions (100% Cloud Firestore)
  // ----------------------------------------------------
  const handleCreateAlbum = async (name) => {
    const activeUserId = user?.uid;
    if (!activeUserId) return;

    const isRealUser = isFirebaseConfigured && !isDemoUser && activeUserId !== 'demo_user_123';
    
    if (isRealUser) {
      try {
        await addDoc(collection(db, 'albums'), {
          userId: activeUserId,
          name: name.trim(),
          createdAt: new Date().toISOString(),
          isArchived: false,
        });
      } catch (err) {
        console.error('Error al crear álbum en Firestore:', err);
      }
    } else {
      const newAlb = { id: 'alb_' + Date.now(), userId: activeUserId, name: name.trim(), createdAt: new Date().toISOString(), isArchived: false };
      setAlbums(prev => [...prev, newAlb]);
    }
  };

  const handleEditAlbum = async (name) => {
    if (!albumModal.album) return;
    const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';

    if (isRealUser) {
      try {
        await updateDoc(doc(db, 'albums', albumModal.album.id), { name: name.trim() });
      } catch (err) {
        console.error('Error al editar álbum en Firestore:', err);
      }
    } else {
      setAlbums(prev => prev.map(a => a.id === albumModal.album.id ? { ...a, name: name.trim() } : a));
    }
  };

  const handleDeleteAlbum = async (albumId) => {
    if (selectedAlbumId === albumId) {
      setSelectedAlbumId(null);
    }
    const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';

    if (isRealUser) {
      try {
        await deleteDoc(doc(db, 'albums', albumId));
      } catch (err) {
        console.error('Error al eliminar álbum en Firestore:', err);
      }
    } else {
      setAlbums(prev => prev.filter(a => a.id !== albumId));
    }
  };

  const handleToggleArchiveAlbum = async (albumId) => {
    const alb = albums.find(a => a.id === albumId);
    if (!alb) return;

    const nextArchived = !alb.isArchived;
    const todayStr = new Date().toLocaleDateString('es-MX');
    const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';

    if (isRealUser) {
      try {
        await updateDoc(doc(db, 'albums', albumId), {
          isArchived: nextArchived,
          archivedAt: nextArchived ? todayStr : null
        });
      } catch (err) {
        console.error('Error al archivar álbum en Firestore:', err);
      }
    } else {
      setAlbums(prev => prev.map(a => a.id === albumId ? { ...a, isArchived: nextArchived, archivedAt: nextArchived ? todayStr : null } : a));
    }
  };

  // ----------------------------------------------------
  // Ticket Actions (100% Cloud Firestore + Cloud Storage)
  // ----------------------------------------------------
  const handleSaveNewTicket = async (ticketData) => {
    const activeUserId = user?.uid;
    if (!activeUserId) return;

    const isRealUser = isFirebaseConfigured && !isDemoUser && activeUserId !== 'demo_user_123';
    const targetAlbumId = ticketData.albumId || (albums[0]?.id || '');

    const payload = {
      albumId: targetAlbumId,
      userId: activeUserId,
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

    if (isRealUser) {
      try {
        const docRef = await addDoc(collection(db, 'tickets'), payload);

        // Upload ticket photo to Firebase Cloud Storage if present
        if (ticketData.imageFile) {
          const fileRef = ref(storage, `users/${activeUserId}/tickets/${docRef.id}_${Date.now()}.webp`);
          const uploadSnap = await uploadBytes(fileRef, ticketData.imageFile);
          const storageUrl = await getDownloadURL(uploadSnap.ref);
          await updateDoc(doc(db, 'tickets', docRef.id), { imageUrl: storageUrl });
        }
      } catch (err) {
        console.error('Error al guardar ticket en Firestore:', err);
      }
    } else {
      setTickets(prev => [{ id: 'tkt_' + Date.now(), ...payload }, ...prev]);
    }
  };

  const handleToggleBilled = async (ticketId, isBilled) => {
    const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';

    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, isBilled } : null);
    }

    if (isRealUser) {
      try {
        await updateDoc(doc(db, 'tickets', ticketId), { isBilled });
      } catch (err) {
        console.error('Error al actualizar estado facturado en Firestore:', err);
      }
    } else {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, isBilled } : t));
    }
  };

  const handleSaveEditedTicket = async (ticketData) => {
    const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';

    if (isRealUser) {
      try {
        const { id, ...dataToUpdate } = ticketData;
        await updateDoc(doc(db, 'tickets', id), dataToUpdate);
        setSelectedTicket(ticketData);
      } catch (err) {
        console.error('Error al actualizar ticket en Firestore:', err);
      }
    } else {
      setTickets(prev => prev.map(t => t.id === ticketData.id ? ticketData : t));
      setSelectedTicket(ticketData);
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(null);
    }
    const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';

    if (isRealUser) {
      try {
        await deleteDoc(doc(db, 'tickets', ticketId));
      } catch (err) {
        console.error('Error al eliminar ticket de Firestore:', err);
      }
    } else {
      setTickets(prev => prev.filter(t => t.id !== ticketId));
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
        isDemoUser={isDemoUser}
        onLogout={handleLogout}
        onOpenApiKeyModal={() => setApiKeyModalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <AuthGuard user={user} isDemoUser={isDemoUser} onDemoLogin={handleDemoLogin}>
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
