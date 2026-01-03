// src/app/dashboard/admin/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../firebase/config';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy, addDoc, deleteDoc, doc, where, updateDoc, getDoc } from 'firebase/firestore';
import { LogOut, DollarSign, Activity, CheckCircle, TrendingUp, Award, Plus, Trash2, Tag, ShoppingBag, Users, FileCheck, X, Shield, GraduationCap, MapPin, User } from 'lucide-react';
import { sendNotification } from '../../../utils/notifications'; // Utilidad de notificaciones

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('finanzas'); // 'finanzas', 'catalogo', 'equipo'
  
  // ESTADOS FINANZAS
  const [orders, setOrders] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [activeJobs, setActiveJobs] = useState(0);
  const [completedJobs, setCompletedJobs] = useState(0);
  const [topTechnician, setTopTechnician] = useState('Nadie aún');

  // ESTADO: VISUALIZAR LISTAS DE ORDENES
  const [viewOrdersType, setViewOrdersType] = useState(null); // 'active' | 'closed' | null

  // ESTADOS CATÁLOGO
  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState({ name: '', price: '', icon: '🔧' });
  
  // ESTADOS TÉCNICOS Y CERTIFICACIONES
  const [allTechnicians, setAllTechnicians] = useState([]);
  const [selectedTech, setSelectedTech] = useState(null); 
  const [techCerts, setTechCerts] = useState([]); 

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push('/login'); else setUser(currentUser);
    });

    // 1. ESCUCHAR ÓRDENES
    const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
      calculateMetrics(data);
    });

    // 2. ESCUCHAR CATÁLOGO
    const qServices = query(collection(db, "services"));
    const unsubServices = onSnapshot(qServices, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 3. ESCUCHAR TÉCNICOS
    const qTechs = query(collection(db, "technicians"));
    const unsubTechs = onSnapshot(qTechs, (snapshot) => {
      const techs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Lógica de notificación: Si hay un nuevo registro pendiente que no estaba antes
      const hasNewPending = techs.some(t => t.status === 'pending');
      if (hasNewPending && activeTab !== 'equipo') {
          // Opcional: Notificar localmente o vía push al admin si está en otra pestaña
          console.log("Hay técnicos pendientes de aprobación.");
      }

      techs.sort((a, b) => (a.status === 'pending' ? -1 : 1));
      setAllTechnicians(techs);
    });

    return () => { unsubscribeAuth(); unsubOrders(); unsubServices(); unsubTechs(); };
  }, [router, activeTab]);

  // ESCUCHAR CERTIFICACIONES
  useEffect(() => {
    if (selectedTech) {
        const q = query(collection(db, "technicians", selectedTech.id, "certifications"));
        const unsub = onSnapshot(q, (snap) => {
            setTechCerts(snap.docs.map(d => ({id: d.id, ...d.data()})));
        });
        return () => unsub();
    } else { setTechCerts([]); }
  }, [selectedTech]);

  // --- LÓGICA FINANZAS ---
  const calculateMetrics = (data) => {
    let revenue = 0; let active = 0; let completed = 0; const techCounts = {};
    data.forEach(order => {
      if (order.status === 'terminado' || order.status === 'cerrado') {
        revenue += Number(order.price) || 0;
        completed++;
        if (order.technicianId) techCounts[order.technicianId] = (techCounts[order.technicianId] || 0) + 1;
      } else { active++; }
    });
    setTotalRevenue(revenue); setActiveJobs(active); setCompletedJobs(completed);
    const bestTechId = Object.keys(techCounts).reduce((a, b) => techCounts[a] > techCounts[b] ? a : b, null);
    setTopTechnician(bestTechId ? `Técnico ${bestTechId.slice(0,5)}...` : 'Nadie aún');
  };

  // --- LÓGICA CATÁLOGO ---
  const handleAddService = async (e) => { e.preventDefault(); if(!newService.name || !newService.price) return; await addDoc(collection(db, "services"), { name: newService.name, price: Number(newService.price), icon: newService.icon }); setNewService({ name: '', price: '', icon: '🔧' }); alert("✅ Agregado"); };
  const handleDeleteService = async (id) => { if(confirm("¿Borrar servicio?")) await deleteDoc(doc(db, "services", id)); };
  
  // --- LÓGICA GESTIÓN ÓRDENES ---
  const handleDeleteOrder = async (orderId) => {
      if(!confirm("⚠️ ¿Estás seguro de eliminar esta orden para siempre?")) return;
      try {
          await deleteDoc(doc(db, "orders", orderId));
      } catch (error) { alert("Error al borrar"); }
  };

  // --- LÓGICA GESTIÓN TÉCNICOS ---
  const approveTech = async (techId) => { 
      if(!confirm("¿Aprobar ingreso?")) return; 
      await updateDoc(doc(db, "technicians", techId), { status: 'approved' }); 
      // 🔔 NOTIFICAR AL TÉCNICO
      await sendNotification("🎉 ¡Felicidades! Tu cuenta ha sido aprobada. Ya puedes aceptar trabajos.", [techId]);
      alert("✅ Aprobado"); 
      setSelectedTech(null); 
  };
  
  const rejectTech = async (techId) => { 
      if(!confirm("¿Rechazar solicitud?")) return; 
      await updateDoc(doc(db, "technicians", techId), { status: 'rejected' }); 
      alert("Solicitud rechazada");
      setSelectedTech(null); 
  };

  // --- LÓGICA CERTIFICACIONES ---
  const approveCert = async (certId) => {
    if(!confirm("¿Validar título? +10 pts")) return;
    try {
        await updateDoc(doc(db, "technicians", selectedTech.id, "certifications", certId), { status: 'approved' });
        const techRef = doc(db, "technicians", selectedTech.id);
        const techSnap = await getDoc(techRef);
        const currentScore = techSnap.data().score || 0;
        await updateDoc(techRef, { score: currentScore + 10 }); 
        
        // 🔔 NOTIFICAR AL TÉCNICO
        await sendNotification("🎓 Tu certificación ha sido validada. ¡Has ganado +10 puntos!", [selectedTech.id]);
        
        alert("✅ Validado");
    } catch (error) { alert("Error"); }
  };

  const handleLogout = async () => { await signOut(auth); router.push('/login'); };
  const pendingCount = allTechnicians.filter(t => t.status === 'pending').length;

  const filteredOrders = orders.filter(o => {
      if (viewOrdersType === 'active') return o.status !== 'terminado' && o.status !== 'cerrado';
      if (viewOrdersType === 'closed') return o.status === 'terminado' || o.status === 'cerrado';
      return false;
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-indigo-900 px-6 pt-12 pb-20 rounded-b-[2.5rem] shadow-xl relative z-10">
        <div className="flex justify-between items-center text-white mb-6">
          <div className="flex items-center gap-3">
             <img src="https://i.postimg.cc/J7y2CTsc/unnamed.jpg" alt="Logo FixGo" className="w-14 h-14 rounded-xl shadow-md border-2 border-white/20"/>
             <div><h1 className="text-xl font-bold">FixGo Admin</h1><p className="text-indigo-200 text-sm">Panel Ejecutivo</p></div>
          </div>
          <button onClick={handleLogout} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition"><LogOut size={20} /></button>
        </div>
        
        <div className="flex bg-indigo-800/50 p-1 rounded-xl backdrop-blur-sm">
          <button onClick={() => setActiveTab('finanzas')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'finanzas' ? 'bg-white text-indigo-900' : 'text-indigo-200'}`}>💰 Finanzas</button>
          <button onClick={() => setActiveTab('catalogo')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'catalogo' ? 'bg-white text-indigo-900' : 'text-indigo-200'}`}>🏷️ Catálogo</button>
          <button onClick={() => setActiveTab('equipo')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'equipo' ? 'bg-white text-indigo-900' : 'text-indigo-200'}`}>👮 Equipo {pendingCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1 animate-pulse">{pendingCount}</span>}</button>
        </div>
      </div>

      <div className="px-6 -mt-8 relative z-20 space-y-6">
        {activeTab === 'finanzas' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="bg-white p-6 rounded-2xl shadow-lg border border-indigo-50 flex items-center justify-between">
                 <div><p className="text-slate-400 text-sm font-medium mb-1">Ingresos Totales</p><h2 className="text-4xl font-bold text-slate-800">${totalRevenue.toLocaleString()}</h2></div>
                 <div className="bg-green-100 p-3 rounded-full"><DollarSign size={32} className="text-green-600" /></div>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                 <div onClick={() => setViewOrdersType('active')} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:bg-yellow-50 transition active:scale-95 group">
                    <p className="text-2xl font-bold text-slate-800 group-hover:text-yellow-600">{activeJobs}</p>
                    <p className="text-xs text-slate-400 group-hover:text-yellow-600">Trabajos Activos</p>
                 </div>
                 <div onClick={() => setViewOrdersType('closed')} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:bg-green-50 transition active:scale-95 group">
                    <p className="text-2xl font-bold text-slate-800 group-hover:text-green-600">{completedJobs}</p>
                    <p className="text-xs text-slate-400 group-hover:text-green-600">Completados</p>
                 </div>
             </div>

             <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 rounded-2xl shadow-lg text-white flex items-center gap-4"><div className="bg-white/20 p-3 rounded-full"><Award size={32} className="text-yellow-300" /></div><div><p className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Líder de Calidad</p><p className="text-xl font-bold">{topTechnician}</p></div></div>
          </div>
        )}

        {activeTab === 'catalogo' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100"><h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Plus size={20}/> Nuevo Servicio</h3><form onSubmit={handleAddService} className="space-y-3"><div className="grid grid-cols-4 gap-3"><input type="text" placeholder="Nombre" className="col-span-3 p-3 bg-slate-50 rounded-xl border border-slate-200" value={newService.name} onChange={e=>setNewService({...newService, name: e.target.value})} /><select className="col-span-1 p-3 bg-slate-50 rounded-xl border border-slate-200" value={newService.icon} onChange={e=>setNewService({...newService, icon: e.target.value})}><option>🔧</option><option>❄️</option><option>💡</option><option>🏊</option></select></div><div className="flex gap-3"><input type="number" placeholder="Precio Sugerido" className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200" value={newService.price} onChange={e=>setNewService({...newService, price: e.target.value})} /><button type="submit" className="bg-indigo-600 text-white px-6 rounded-xl font-bold">Añadir</button></div></form></div>
            <div className="space-y-3">{services.map(srv => (<div key={srv.id} className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center"><div className="flex items-center gap-3"><span className="text-2xl">{srv.icon}</span><div><p className="font-bold">{srv.name}</p><p className="text-xs text-slate-400">${srv.price}</p></div></div><button onClick={() => handleDeleteService(srv.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={18} /></button></div>))}</div>
          </div>
        )}

        {activeTab === 'equipo' && (
          <div className="space-y-4 animate-in fade-in">
            {allTechnicians.length === 0 ? (<div className="text-center py-10 text-slate-400"><Users size={40} className="mx-auto mb-2 opacity-20"/><p>No hay personal registrado</p></div>) : (
                allTechnicians.map(tech => (
                    <div key={tech.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-3"><div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${tech.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : 'bg-indigo-50 text-indigo-600'}`}>{tech.name ? tech.name[0] : '?'}</div><div><h3 className="font-bold text-slate-800">{tech.name || 'Sin nombre'}</h3><p className="text-xs text-slate-500">{tech.phone}</p>{tech.status === 'pending' && <span className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Por Aprobar</span>}{tech.status === 'approved' && <span className="text-green-600 text-[10px] font-bold">Activo • {tech.score || 0} pts</span>}</div></div>
                        <button onClick={() => setSelectedTech(tech)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-200">Revisar</button>
                    </div>
                ))
            )}
          </div>
        )}

        {viewOrdersType && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl relative animate-in zoom-in max-h-[90vh] flex flex-col">
                    <div className={`p-4 text-white flex justify-between items-center ${viewOrdersType === 'active' ? 'bg-yellow-500' : 'bg-green-600'}`}>
                        <h3 className="font-bold text-lg">{viewOrdersType === 'active' ? 'Órdenes en Curso' : 'Historial de Servicios'}</h3>
                        <button onClick={() => setViewOrdersType(null)} className="p-1 hover:bg-white/20 rounded-full"><X size={24}/></button>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto bg-slate-50 space-y-3">
                        {filteredOrders.map(order => (
                            <div key={order.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-gray-800">{order.service}</h4>
                                    <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={12}/> {order.location}</p>
                                    <p className="text-[10px] text-indigo-600 mt-1 uppercase font-bold">{order.status}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-sm">${order.price}</span>
                                    <button onClick={() => handleDeleteOrder(order.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {selectedTech && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative animate-in zoom-in max-h-[90vh] overflow-y-auto">
                    <div className="bg-indigo-900 p-4 text-white flex justify-between items-center"><h3 className="font-bold">Expediente</h3><button onClick={() => setSelectedTech(null)} className="p-1 hover:bg-white/20 rounded-full"><X size={20}/></button></div>
                    <div className="p-6 space-y-6">
                        <div className="flex justify-between items-start"><div><h2 className="text-2xl font-bold text-gray-800">{selectedTech.name}</h2><p className="text-gray-500 text-sm">{selectedTech.phone}</p></div><div className="text-center bg-indigo-50 p-2 rounded-lg"><span className="block text-xs text-indigo-400 font-bold uppercase">Ranking</span><span className="text-2xl font-black text-indigo-700">{selectedTech.score || 0}</span></div></div>
                        <div><h4 className="font-bold text-gray-800 mb-2 border-b pb-1 flex items-center gap-2"><Shield size={16}/> Verificación KYC</h4><div className="grid grid-cols-2 gap-2 mt-2"><a href={selectedTech.idUrl} target="_blank" className="bg-gray-100 rounded-lg p-3 text-center text-xs font-bold text-blue-600 border block">Documento ID</a><a href={selectedTech.recordUrl} target="_blank" className="bg-gray-100 rounded-lg p-3 text-center text-xs font-bold text-blue-600 border block">Récord Judicial</a></div></div>
                        <div><h4 className="font-bold text-gray-800 mb-2 border-b pb-1 flex items-center gap-2"><GraduationCap size={16}/> Certificaciones ({techCerts.length})</h4><div className="space-y-3 mt-3">{techCerts.map(cert => (<div key={cert.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200"><div className="flex justify-between items-start mb-2"><span className="font-bold text-sm text-gray-800">{cert.name}</span>{cert.status === 'approved' ? <CheckCircle size={16} className="text-green-500"/> : <span className="text-[10px] bg-yellow-100 px-2 py-0.5 rounded-full">Pendiente</span>}</div><div className="h-32 bg-white rounded border mb-3 overflow-hidden"><img src={cert.imageUrl} className="w-full h-full object-contain" /></div>{cert.status === 'pending' && (<button onClick={() => approveCert(cert.id)} className="w-full bg-green-600 text-white py-2 rounded text-xs font-bold">Validar y Sumar Puntos</button>)}</div>))}</div></div>
                        {selectedTech.status === 'pending' && (<div className="pt-4 border-t mt-4 flex gap-3"><button onClick={() => rejectTech(selectedTech.id)} className="flex-1 border border-red-200 text-red-600 py-3 rounded-xl font-bold">Rechazar</button><button onClick={() => approveTech(selectedTech.id)} className="flex-1 bg-black text-white py-3 rounded-xl font-bold">Autorizar Ingreso</button></div>)}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}