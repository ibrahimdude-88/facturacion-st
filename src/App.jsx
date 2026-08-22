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

  // Core Data State per User
  const [albums, setAlbums] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);

  // Modals & Drawers UI State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  // Album Modal state
  const [albumModal, setAlbumModal] = useState({ isOpen: false, mode: 'create', album: null });

  // 1. Auth Subscription & User Isolation Reset
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

  // Helper to persist user-scoped local state (keyed by user UID)
  const updateLocalState = (newAlbums, newTickets) => {
    const activeUid = user?.uid || 'guest';
    
    if (newAlbums !== null && newAlbums !== undefined) {
      setAlbums(newAlbums);
      localStorage.setItem(`fs_albums_${activeUid}`, JSON.stringify(newAlbums));
    }
    if (newTickets !== null && newTickets !== undefined) {
      setTickets(newTickets);
      localStorage.setItem(`fs_tickets_${activeUid}`, JSON.stringify(newTickets));
    }
  };

  // 2. Multi-User Isolated Sync
  useEffect(() => {
    const activeUid = user?.uid;

    if (!activeUid) {
      setAlbums([]);
      setTickets([]);
      setSelectedAlbumId(null);
      setSelectedTicket(null);
      return;
    }

    // Reset selection when changing accounts
    setSelectedAlbumId(null);
    setSelectedTicket(null);

    // 1. Immediately load local storage state on refresh for instant render
    const savedAlbums = localStorage.getItem(`fs_albums_${activeUid}`);
    const savedTickets = localStorage.getItem(`fs_tickets_${activeUid}`);
    const defaultCleanAlbum = [{ id: 'alb_gen_' + activeUid.slice(0, 6), userId: activeUid, name: 'General', createdAt: new Date().toISOString() }];

    if (savedAlbums) {
      try {
        const parsed = JSON.parse(savedAlbums);
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

    if (savedTickets) {
      try {
        const parsed = JSON.parse(savedTickets);
        if (Array.isArray(parsed)) {
          setTickets(parsed);
        }
      } catch (e) {}
    }

    const isRealUser = isFirebaseConfigured && !isDemoUser && activeUid !== 'demo_user_123';

    if (isRealUser) {
      // Sync Albums strictly by userId
      const albumsRef = collection(db, 'albums');
      const qAlbums = query(albumsRef, where('userId', '==', activeUid));
      const unsubAlbums = onSnapshot(qAlbums, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (list.length > 0) {
          setAlbums(list);
          localStorage.setItem(`fs_albums_${activeUid}`, JSON.stringify(list));
        } else {
          // Check if local cache has albums created locally before overwriting with empty
          const cached = localStorage.getItem(`fs_albums_${activeUid}`);
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setAlbums(parsed);
                // Upload any pending local album to Firestore
                parsed.forEach(alb => {
                  if (alb.id.startsWith('alb_')) {
                    addDoc(collection(db, 'albums'), {
                      userId: activeUid,
                      name: alb.name,
                      createdAt: alb.createdAt || new Date().toISOString(),
                      isArchived: Boolean(alb.isArchived)
                    }).catch(() => {});
                  }
                });
                return;
              }
            } catch (e) {}
          }
          setAlbums(defaultCleanAlbum);
          localStorage.setItem(`fs_albums_${activeUid}`, JSON.stringify(defaultCleanAlbum));
        }
      }, (err) => console.warn('Snapshot albums:', err));

      // Sync Tickets strictly by userId
      const ticketsRef = collection(db, 'tickets');
      const qTickets = query(ticketsRef, where('userId', '==', activeUid));
      const unsubTickets = onSnapshot(qTickets, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (list.length > 0) {
          setTickets(list);
          localStorage.setItem(`fs_tickets_${activeUid}`, JSON.stringify(list));
        }
      }, (err) => console.warn('Snapshot tickets:', err));

      return () => {
        unsubAlbums();
        unsubTickets();
      };
    }
  }, [user?.uid, isDemoUser]);

  // ----------------------------------------------------
  // Album Actions (Multi-User Safe & Persistent)
  // ----------------------------------------------------
  const handleCreateAlbum = async (name) => {
    const activeUserId = user?.uid || 'guest';
    const tempId = 'alb_' + Date.now();
    const newAlbum = {
      id: tempId,
      userId: activeUserId,
      name,
      createdAt: new Date().toISOString(),
      isArchived: false,
    };

    const updatedAlbums = [...albums, newAlbum];
    updateLocalState(updatedAlbums, null);

    const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';
    if (isRealUser) {
      try {
        const docRef = await addDoc(collection(db, 'albums'), {
          userId: user.uid,
          name,
          createdAt: new Date().toISOString(),
          isArchived: false,
        });

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

  const handleEditAlbum = (name) => {
    if (!albumModal.album) return;
    const updatedAlbums = albums.map(a => a.id === albumModal.album.id ? { ...a, name } : a);
    updateLocalState(updatedAlbums, null);

    const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';
    if (isRealUser) {
      updateDoc(doc(db, 'albums', albumModal.album.id), { name })
        .catch(err => console.warn('Firestore album update notice:', err.message));
    }
  };

  const handleDeleteAlbum = (albumId) => {
    const updatedAlbums = albums.filter(a => a.id !== albumId);
    updateLocalState(updatedAlbums, null);

    if (selectedAlbumId === albumId) {
      setSelectedAlbumId(null);
    }

    const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';
    if (isRealUser) {
      deleteDoc(doc(db, 'albums', albumId))
        .catch(err => console.warn('Firestore album delete notice:', err.message));
    }
  };

  // ----------------------------------------------------
  // Ticket Actions (Instant UX + Automatic Drawer Close)
  // ----------------------------------------------------
  const handleSaveNewTicket = (ticketData) => {
    const activeUserId = user?.uid || 'guest';
    const newTicketId = 'tkt_' + Date.now();
    const finalImageUrl = ticketData.imageUrl || '';

    const payload = {
      id: newTicketId,
      albumId: ticketData.albumId || (albums[0]?.id || 'alb_1'),
      userId: activeUserId,
      imageUrl: finalImageUrl,
      businessName: ticketData.businessName || 'Comercio General',
      purchaseDate: ticketData.purchaseDate || new Date().toISOString().split('T')[0],
      items: ticketData.items || [],
      subtotal: Number(ticketData.subtotal) || 0,
      iva: Number(ticketData.iva) || 0,
      tip: Number(ticketData.tip) || 0,
      total: Number(ticketData.total) || 0,
      billingUrl: ticketData.billingUrl || null,
      qrData: ticketData.qrData || null,
      isBilled: false,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    const updatedTickets = [payload, ...tickets];
    updateLocalState(null, updatedTickets);

    const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';
    if (isRealUser) {
      const { id, ...firestoreDoc } = payload;
      addDoc(collection(db, 'tickets'), firestoreDoc).catch(err => console.warn('Firestore ticket create notice:', err.message));

      if (ticketData.imageFile) {
        const fileRef = ref(storage, `users/${user.uid}/tickets/${Date.now()}_${ticketData.imageFile.name}`);
        uploadBytes(fileRef, ticketData.imageFile)
          .then(() => getDownloadURL(fileRef))
          .then(storageUrl => {
            const listWithStorageUrl = tickets.map(t => t.id === newTicketId ? { ...t, imageUrl: storageUrl } : t);
            updateLocalState(null, listWithStorageUrl);
          })
          .catch(e => console.warn('Storage background upload notice:', e.message));
      }
    }
  };

  const handleToggleBilled = (ticketId, isBilled) => {
    const updatedTickets = tickets.map(t => t.id === ticketId ? { ...t, isBilled } : t);
    updateLocalState(null, updatedTickets);

    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, isBilled });
    }

    // Auto-archive album if all tickets in it are now 100% billed
    const targetTicket = tickets.find(t => t.id === ticketId);
    if (targetTicket) {
      const albumTickets = updatedTickets.filter(t => t.albumId === targetTicket.albumId);
      const isAllBilledNow = albumTickets.length > 0 && albumTickets.every(t => t.isBilled);
      
      if (isAllBilledNow) {
        const todayStr = new Date().toLocaleDateString('es-MX');
        const updatedAlbums = albums.map(a => a.id === targetTicket.albumId ? { ...a, isArchived: true, archivedAt: todayStr } : a);
        updateLocalState(updatedAlbums, null);

        const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';
        if (isRealUser) {
          updateDoc(doc(db, 'albums', targetTicket.albumId), { isArchived: true, archivedAt: todayStr })
            .catch(err => console.warn('Firestore album archive notice:', err.message));
        }
      }
    }

    const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';
    if (isRealUser) {
      updateDoc(doc(db, 'tickets', ticketId), { isBilled })
        .catch(err => console.warn('Firestore toggle billed notice:', err.message));
    }
  };

  const handleUpdateTicket = (updatedTicket) => {
    const updatedTickets = tickets.map(t => t.id === updatedTicket.id ? updatedTicket : t);
    updateLocalState(null, updatedTickets);

    if (selectedTicket?.id === updatedTicket.id) {
      setSelectedTicket(null);
    }

    const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';
    if (isRealUser) {
      const { id, ...data } = updatedTicket;
      updateDoc(doc(db, 'tickets', id))
        .catch(err => console.warn('Firestore ticket update notice:', err.message));
    }
  };

  const handleDeleteTicket = (ticketId) => {
    const updatedTickets = tickets.filter(t => t.id !== ticketId);
    updateLocalState(null, updatedTickets);

    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(null);
    }

    const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';
    if (isRealUser) {
      deleteDoc(doc(db, 'tickets', ticketId))
        .catch(err => console.warn('Firestore ticket delete notice:', err.message));
    }
  };

  // ZIP Package Export & Storage Image Cleanup
  const handleExportZIP = () => {
    const activeTickets = selectedAlbumId 
      ? tickets.filter(t => t.albumId === selectedAlbumId)
      : tickets;

    if (activeTickets.length === 0) return;

    const currentAlbumObj = albums.find(a => a.id === selectedAlbumId);
    const albumName = currentAlbumObj ? currentAlbumObj.name : 'Todos_los_Comprobantes';

    exportBilledTicketsZip(activeTickets, albums, albumName, (exportedIds) => {
      if (!exportedIds || exportedIds.length === 0) return;

      // 1. Clear imageUrl in local state & localStorage while preserving all items/financial data
      const updatedTickets = tickets.map(t => {
        if (exportedIds.includes(t.id)) {
          return { ...t, imageUrl: null, isBilled: true };
        }
        return t;
      });
      updateLocalState(null, updatedTickets);

      // 2. Clear imageUrl in Firestore & delete files from Storage to free up space
      const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';
      if (isRealUser) {
        exportedIds.forEach(tktId => {
          updateDoc(doc(db, 'tickets', tktId), { imageUrl: null, isBilled: true })
            .catch(err => console.warn('Firestore image URL clear notice:', err.message));
        });
      }
    });
  };

  // Executive PDF Report Export Functionality
  const handleExportPDF = () => {
    const activeTickets = selectedAlbumId 
      ? tickets.filter(t => t.albumId === selectedAlbumId)
      : tickets;

    if (activeTickets.length === 0) return;

    const currentAlbumObj = albums.find(a => a.id === selectedAlbumId);
    const albumName = currentAlbumObj ? currentAlbumObj.name : 'Todos los Comprobantes';

    exportExecutivePDFReport(activeTickets, albums, albumName);
  };

  const selectedAlbumObj = albums.find(a => a.id === selectedAlbumId);

  const handleArchiveAlbum = (albumId) => {
    const todayStr = new Date().toLocaleDateString('es-MX');
    const updatedAlbums = albums.map(a => a.id === albumId ? { ...a, isArchived: true, archivedAt: todayStr } : a);
    updateLocalState(updatedAlbums, null);

    const isRealUser = isFirebaseConfigured && !isDemoUser && user?.uid && user.uid !== 'demo_user_123';
    if (isRealUser) {
      updateDoc(doc(db, 'albums', albumId), { isArchived: true, archivedAt: todayStr })
        .catch(err => console.warn('Firestore album archive notice:', err.message));
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'theme-dark bg-slate-950 text-slate-100' : 'theme-light bg-slate-50 text-slate-900'} flex flex-col font-sans transition-colors duration-300`}>
      
      {/* Top Navbar */}
      <Navbar
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
        openApiKeyInfo={() => setApiKeyModalOpen(true)}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-8">
        <AuthGuard user={user} onDemoLogin={handleDemoLogin}>
          
          {/* 1. Analytics & Overview Header */}
          <StatsOverview
            tickets={selectedAlbumId ? tickets.filter(t => t.albumId === selectedAlbumId) : tickets}
            selectedAlbumName={selectedAlbumObj?.name}
            onUploadClick={() => setIsUploadOpen(true)}
            onExportZIP={handleExportZIP}
            onExportPDF={handleExportPDF}
          />

          {/* 2. Albums Grid Section */}
          <AlbumGrid
            albums={albums}
            tickets={tickets}
            selectedAlbumId={selectedAlbumId}
            onSelectAlbum={(id) => setSelectedAlbumId(id)}
            onUploadClick={() => setIsUploadOpen(true)}
            onCreateAlbumClick={() => setAlbumModal({ isOpen: true, mode: 'create', album: null })}
            onEditAlbumClick={(album) => setAlbumModal({ isOpen: true, mode: 'edit', album })}
            onDeleteAlbumClick={(album) => setAlbumModal({ isOpen: true, mode: 'delete', album })}
            onArchiveAlbumClick={handleArchiveAlbum}
          />

          {/* 3. Tickets Dynamic Table */}
          <TicketsTable
            tickets={tickets}
            albums={albums}
            selectedAlbumId={selectedAlbumId}
            onToggleBilled={handleToggleBilled}
            onSelectTicket={(ticket) => setSelectedTicket(ticket)}
            onDeleteTicket={handleDeleteTicket}
          />

        </AuthGuard>
      </main>

      {/* Modals and Drawers */}
      <TicketUploadModal
        isOpen={isUploadOpen}
        albums={albums}
        selectedAlbumId={selectedAlbumId}
        onClose={() => setIsUploadOpen(false)}
        onSaveTicket={handleSaveNewTicket}
      />

      <TicketDrawer
        isOpen={Boolean(selectedTicket)}
        ticket={selectedTicket}
        albums={albums}
        onClose={() => setSelectedTicket(null)}
        onSave={handleUpdateTicket}
        onDelete={handleDeleteTicket}
      />

      <AlbumModal
        isOpen={albumModal.isOpen}
        mode={albumModal.mode}
        album={albumModal.album}
        onClose={() => setAlbumModal({ isOpen: false, mode: 'create', album: null })}
        onSubmit={albumModal.mode === 'create' ? handleCreateAlbum : handleEditAlbum}
        onDelete={handleDeleteAlbum}
      />

      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
      />

    </div>
  );
}
