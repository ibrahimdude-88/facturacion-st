import React, { useState, useEffect } from 'react';
import { 
  X, ShieldCheck, Users, Receipt, Folder, DollarSign, Tag, TrendingUp, 
  Search, RefreshCw, Calendar, Store, CheckCircle2, Clock, Crown, BarChart2 
} from 'lucide-react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../services/firebase';
import { formatCurrency } from '../Analytics/StatsOverview';

export default function AdminDashboardModal({ isOpen, user, onClose, currentAlbums, currentTickets }) {
  const [loading, setLoading] = useState(false);
  const [allTickets, setAllTickets] = useState([]);
  const [allAlbums, setAllAlbums] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const fetchGlobalData = async () => {
    if (!isOpen) return;
    setLoading(true);

    if (isFirebaseConfigured && db) {
      try {
        const albumsSnap = await getDocs(collection(db, 'albums'));
        setAllAlbums(albumsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const ticketsSnap = await getDocs(collection(db, 'tickets'));
        setAllTickets(ticketsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.warn('Error fetching global data:', err.message);
      } finally {
        setLoading(false);
      }
    } else {
      setAllAlbums(currentAlbums || []);
      setAllTickets(currentTickets || []);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);

    if (isFirebaseConfigured && db) {
      // 1. Realtime Listeners for ALL Albums across ALL Users
      const unsubAlbums = onSnapshot(collection(db, 'albums'), (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllAlbums(list);
        setLoading(false);
      }, (err) => {
        console.warn('Realtime albums notice:', err.message);
        setLoading(false);
      });

      // 2. Realtime Listeners for ALL Tickets across ALL Users
      const unsubTickets = onSnapshot(collection(db, 'tickets'), (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllTickets(list);
        setLoading(false);
      }, (err) => {
        console.warn('Realtime tickets notice:', err.message);
        setLoading(false);
      });

      return () => {
        unsubAlbums();
        unsubTickets();
      };
    } else {
      setAllAlbums(currentAlbums || []);
      setAllTickets(currentTickets || []);
      setLoading(false);
    }
  }, [isOpen, currentAlbums, currentTickets]);

  if (!isOpen) return null;

  // Aggregate User Statistics
  const userStatsMap = {};

  allTickets.forEach(tkt => {
    const uid = tkt.userId || 'guest';
    const emailToDisplay = tkt.userEmail || (uid === user?.uid ? user.email : (uid.length > 15 ? `Usuario (${uid.slice(0, 8)}...)` : uid));

    if (!userStatsMap[uid]) {
      userStatsMap[uid] = {
        userId: uid,
        email: emailToDisplay,
        ticketCount: 0,
        albumCount: 0,
        totalAmount: 0,
        totalDiscount: 0,
        billedCount: 0,
        latestDate: null,
      };
    }

    if (tkt.userEmail && userStatsMap[uid].email.startsWith('Usuario (')) {
      userStatsMap[uid].email = tkt.userEmail;
    }

    userStatsMap[uid].ticketCount += 1;
    userStatsMap[uid].totalAmount += Number(tkt.total) || 0;
    userStatsMap[uid].totalDiscount += Number(tkt.discount) || 0;
    if (tkt.isBilled) userStatsMap[uid].billedCount += 1;

    const tDate = tkt.purchaseDate || tkt.createdAt;
    if (tDate && (!userStatsMap[uid].latestDate || tDate > userStatsMap[uid].latestDate)) {
      userStatsMap[uid].latestDate = tDate;
    }
  });

  allAlbums.forEach(alb => {
    const uid = alb.userId || 'guest';
    const emailToDisplay = alb.userEmail || (uid === user?.uid ? user.email : (uid.length > 15 ? `Usuario (${uid.slice(0, 8)}...)` : uid));

    if (!userStatsMap[uid]) {
      userStatsMap[uid] = {
        userId: uid,
        email: emailToDisplay,
        ticketCount: 0,
        albumCount: 0,
        totalAmount: 0,
        totalDiscount: 0,
        billedCount: 0,
        latestDate: null,
      };
    }
    userStatsMap[uid].albumCount += 1;
  });

  const userList = Object.values(userStatsMap);
  const filteredUsers = userList.filter(u => 
    u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.userId.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  // Global KPIs
  const totalGlobalTickets = allTickets.length;
  const totalGlobalAlbums = allAlbums.length;
  const totalGlobalAmount = allTickets.reduce((acc, t) => acc + (Number(t.total) || 0), 0);
  const totalGlobalDiscount = allTickets.reduce((acc, t) => acc + (Number(t.discount) || 0), 0);
  const totalGlobalBilled = allTickets.filter(t => t.isBilled).length;
  const globalBilledPercent = totalGlobalTickets > 0 ? Math.round((totalGlobalBilled / totalGlobalTickets) * 100) : 0;
  const totalUniqueUsers = userList.length;

  // Top Merchants Breakdown
  const merchantMap = {};
  allTickets.forEach(t => {
    const name = t.businessName || 'Comercio General';
    merchantMap[name] = (merchantMap[name] || 0) + 1;
  });
  const topMerchants = Object.entries(merchantMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="glass-panel w-full max-w-5xl p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-glass space-y-6 relative my-auto max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-glow-amber">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-100">Panel de Administración General</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Acceso Superusuario ({user?.email})
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Métricas globales en tiempo real de todas las cuentas registradas en FacturaSnap AI.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchGlobalData}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
              title="Recargar datos de la nube"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Dashboard Body */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          
          {/* Global KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            
            {/* Total Users */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold uppercase">Cuentas</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-xl font-extrabold text-slate-100 block">
                {totalUniqueUsers}
              </span>
              <span className="text-[10px] text-blue-400 font-medium">Usuarios activos</span>
            </div>

            {/* Total Tickets */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold uppercase">Tickets</span>
                <Receipt className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="text-xl font-extrabold text-slate-100 block">
                {totalGlobalTickets}
              </span>
              <span className="text-[10px] text-indigo-400 font-medium">Escaneados</span>
            </div>

            {/* Total Albums */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold uppercase">Álbumes</span>
                <Folder className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-xl font-extrabold text-slate-100 block">
                {totalGlobalAlbums}
              </span>
              <span className="text-[10px] text-purple-400 font-medium">Categorías</span>
            </div>

            {/* Total Amount MXN */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold uppercase">Monto Total</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-lg font-extrabold text-emerald-400 block truncate">
                {formatCurrency(totalGlobalAmount)}
              </span>
              <span className="text-[10px] text-slate-400">Procesado en MXN</span>
            </div>

            {/* Total Discounts */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold uppercase">Ahorros</span>
                <Tag className="w-4 h-4 text-emerald-300" />
              </div>
              <span className="text-lg font-extrabold text-slate-100 block truncate">
                {formatCurrency(totalGlobalDiscount)}
              </span>
              <span className="text-[10px] text-emerald-400 font-medium">Descuentos IA</span>
            </div>

            {/* Billed Rate % */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold uppercase">Facturado</span>
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-xl font-extrabold text-cyan-300 block">
                {globalBilledPercent}%
              </span>
              <span className="text-[10px] text-slate-400">{totalGlobalBilled} de {totalGlobalTickets}</span>
            </div>

          </div>

          {/* Top Merchants & Usage Insights Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Top Merchants */}
            <div className="lg:col-span-6 p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                <Store className="w-4 h-4 text-blue-400" />
                <span>Comercios Más Escaneados en el Sistema</span>
              </h4>
              <div className="space-y-2">
                {topMerchants.map(([merchant, count], i) => (
                  <div key={merchant} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-bold text-[11px] flex items-center justify-center">
                        #{i + 1}
                      </span>
                      <span className="font-semibold text-slate-200">{merchant}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-extrabold text-[11px]">
                      {count} ticket{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Admin Health Card */}
            <div className="lg:col-span-6 p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                <BarChart2 className="w-4 h-4 text-emerald-400" />
                <span>Salud del Sistema e IA Gemini 3.5/3.6</span>
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                  <span className="text-slate-400">Modelo Activo de IA:</span>
                  <span className="font-bold text-emerald-400">Google Gemini 3.5 Flash / 3.6 Flash</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                  <span className="text-slate-400">Base de Datos NoSQL:</span>
                  <span className="font-bold text-blue-400">Firebase Cloud Firestore</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                  <span className="text-slate-400">Límite de Seguridad Gemini:</span>
                  <span className="font-bold text-purple-400">15 tickets / minuto por usuario</span>
                </div>
              </div>
            </div>

          </div>

          {/* User Accounts Detail Table */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Desglose por Cuenta de Usuario ({userList.length})</span>
              </h4>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Filtrar por correo o UID..."
                  className="pl-8 pr-3 py-1.5 rounded-lg glass-input text-xs w-full sm:w-64"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/60">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Usuario / Cuenta</th>
                      <th className="py-2.5 px-4 text-center">Tickets</th>
                      <th className="py-2.5 px-4 text-center">Álbumes</th>
                      <th className="py-2.5 px-4 text-right">Monto Total</th>
                      <th className="py-2.5 px-4 text-right">Ahorros</th>
                      <th className="py-2.5 px-4 text-center">Última Actividad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.map((u) => {
                      const isCurrentAdmin = u.userId === user?.uid;

                      return (
                        <tr key={u.userId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                                isCurrentAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-300'
                              }`}>
                                {isCurrentAdmin ? <Crown className="w-3.5 h-3.5" /> : u.email.slice(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-slate-100 block">
                                  {u.email}
                                  {isCurrentAdmin && (
                                    <span className="ml-2 px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                      Admin (Tú)
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  ID: {u.userId}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center font-extrabold text-slate-100">
                            {u.ticketCount}
                          </td>

                          <td className="py-3 px-4 text-center font-semibold text-slate-300">
                            {u.albumCount}
                          </td>

                          <td className="py-3 px-4 text-right font-extrabold text-emerald-400">
                            {formatCurrency(u.totalAmount)}
                          </td>

                          <td className="py-3 px-4 text-right font-bold text-emerald-300">
                            {formatCurrency(u.totalDiscount)}
                          </td>

                          <td className="py-3 px-4 text-center text-slate-400 whitespace-nowrap">
                            {u.latestDate || 'Sin fecha'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>👑 Sistema Administrado por <strong>zippo0189</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
          >
            Cerrar Panel
          </button>
        </div>

      </div>
    </div>
  );
}
