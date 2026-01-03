// src/app/dashboard/admin/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../firebase/config';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy, addDoc, deleteDoc, doc, where, updateDoc, getDoc } from 'firebase/firestore';
import { LogOut, DollarSign, Activity, CheckCircle, TrendingUp, Award, Plus, Trash2, Tag, ShoppingBag, Users, FileCheck, X, Shield, GraduationCap } from 'lucide-react';

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

  // ESTADOS CATÁLOGO
  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState({ name: '', price: '', icon: '🔧' });
  
  // ESTADOS TÉCNICOS Y CERTIFICACIONES
  const [allTechnicians, setAllTechnicians] = useState([]);
  const [selectedTech, setSelectedTech] = useState(null); 
  const [techCerts, setTechCerts] = useState([]); // Certificaciones del técnico seleccionado

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push('/login'); else setUser(currentUser);
    });

    // 1. ESCUCHAR ÓRDENES (Para Finanzas)
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

    // 3. ESCUCHAR TODOS LOS TÉCNICOS (Para Gestión de Equipo y KYC)
    const qTechs = query(collection(db, "technicians"));
    const unsubTechs = onSnapshot(qTechs, (snapshot) => {
      const techs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenar: Pendientes primero
      techs.sort((a, b) => (a.status === 'pending' ? -1 : 1));
      setAllTechnicians(techs);
    });

    return () => { unsubscribeAuth(); unsubOrders(); unsubServices(); unsubTechs(); };
  }, [router]);

  // --- ESCUCHAR CERTIFICACIONES CUANDO SE ABRE UN TÉCNICO ---
  useEffect(() => {
    if (selectedTech) {
        const q = query(collection(db, "technicians", selectedTech.id, "certifications"));
        const unsub = onSnapshot(q, (snap) => {
            setTechCerts(snap.docs.map(d => ({id: d.id, ...d.data()})));
        });
        return () => unsub();
    } else {
        setTechCerts([]);
    }
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
  
  // --- LÓGICA GESTIÓN TÉCNICOS (KYC) ---
  const approveTech = async (techId) => {
    if(!confirm("¿Aprobar ingreso de este técnico?")) return;
    await updateDoc(doc(db, "technicians", techId), { status: 'approved' });
    alert("✅ Técnico Aprobado");
    setSelectedTech(null);
  };
  const rejectTech = async (techId) => {
    if(!confirm("¿Rechazar solicitud?")) return;
    await updateDoc(doc(db, "technicians", techId), { status: 'rejected' });
    setSelectedTech(null);
  };

  // --- LÓGICA CERTIFICACIONES (GAMIFICACIÓN) ---
  const approveCert = async (certId) => {
    if(!confirm("¿Validar este título? Se sumarán 10 puntos al técnico.")) return;
    try {
        // 1. Marcar certificado como aprobado
        await updateDoc(doc(db, "technicians", selectedTech.id, "certifications", certId), {
            status: 'approved'
        });
        
        // 2. Sumar puntos al score del técnico
        const techRef = doc(db, "technicians", selectedTech.id);
        const techSnap = await getDoc(techRef);
        const currentScore = techSnap.data().score || 0;
        
        await updateDoc(techRef, { score: currentScore + 10 });
        alert("✅ Título validado. +10 Puntos sumados.");
    } catch (error) { console.error(error); alert("Error actualizando puntos"); }
  };

  const rejectCert = async (certId) => {
    if(!confirm("¿Rechazar título?")) return;
    await updateDoc(doc(db, "technicians", selectedTech.id, "certifications", certId), {
        status: 'rejected'
    });
  };

  const handleLogout = async () => { await signOut(auth); router.push('/login'); };

  // Calcular cuántos pendientes hay para el badge
  const pendingCount = allTechnicians.filter(t => t.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      
      {/* HEADER ADMIN CON LOGO INTEGRADO */}
      <div className="bg-indigo-900 px-6 pt-12 pb-20 rounded-b-[2.5rem] shadow-xl relative z-10">
        <div className="flex justify-between items-center text-white mb-6">
          
          {/* SECCIÓN LOGO + TEXTO */}
          <div className="flex items-center gap-3">
             <img 
               src="https://i.postimg.cc/J7y2CTsc/unnamed.jpg" 
               alt="Logo FixGo"
               className="w-14 h-14 rounded-xl shadow-md border-2 border-white/20"
             />
             <div>
                <h1 className="text-xl font-bold">FixGo Admin</h1>
                <p className="text-indigo-200 text-sm">Bienvenido CEO</p>
             </div>
          </div>

          <button onClick={handleLogout} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition"><LogOut size={20} /></button>
        </div>
        
        {/* NAVEGACIÓN TABS */}
        <div className="flex bg-indigo-800/50 p-1 rounded-xl backdrop-blur-sm">
          <button onClick={() => setActiveTab('finanzas')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'finanzas' ? 'bg-white text-indigo-900' : 'text-indigo-200'}`}>💰 Finanzas</button>
          <button onClick={() => setActiveTab('catalogo')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'catalogo' ? 'bg-white text-indigo-900' : 'text-indigo-200'}`}>🏷️ Catálogo</button>
          <button onClick={() => setActiveTab('equipo')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'equipo' ? 'bg-white text-indigo-900' : 'text-indigo-200'}`}>
            👮 Equipo {pendingCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{pendingCount}</span>}
          </button>
        </div>
      </div>

      <div className="px-6 -mt-8 relative z-20 space-y-6">
        
        {/* 1. VISTA FINANZAS */}
        {activeTab === 'finanzas' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="bg-white p-6 rounded-2xl shadow-lg border border-indigo-50 flex items-center justify-between"><div><p className="text-slate-400 text-sm font-medium mb-1">Ingresos</p><h2 className="text-4xl font-bold text-slate-800">${totalRevenue.toLocaleString()}</h2></div><div className="bg-green-100 p-3 rounded-full"><DollarSign size={32} className="text-green-600" /></div></div>
             <div className="grid grid-cols-2 gap-4"><div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100"><p className="text-2xl font-bold text-slate-800">{activeJobs}</p><p className="text-xs text-slate-400">Activos</p></div><div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100"><p className="text-2xl font-bold text-slate-800">{completedJobs}</p><p className="text-xs text-slate-400">Cerrados</p></div></div>
             <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 rounded-2xl shadow-lg text-white flex items-center gap-4"><div className="bg-white/20 p-3 rounded-full"><Award size={32} className="text-yellow-300" /></div><div><p className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Mejor Técnico</p><p className="text-xl font-bold">{topTechnician}</p></div></div>
          </div>
        )}

        {/* 2. VISTA CATÁLOGO */}
        {activeTab === 'catalogo' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100"><h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Plus size={20}/> Agregar Servicio</h3><form onSubmit={handleAddService} className="space-y-3"><div className="grid grid-cols-4 gap-3"><input type="text" placeholder="Nombre" className="col-span-3 p-3 bg-slate-50 rounded-xl border border-slate-200" value={newService.name} onChange={e=>setNewService({...newService, name: e.target.value})} /><select className="col-span-1 p-3 bg-slate-50 rounded-xl border border-slate-200" value={newService.icon} onChange={e=>setNewService({...newService, icon: e.target.value})}><option>🔧</option><option>❄️</option><option>💡</option><option>🏊</option></select></div><div className="flex gap-3"><input type="number" placeholder="Precio" className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200" value={newService.price} onChange={e=>setNewService({...newService, price: e.target.value})} /><button type="submit" className="bg-indigo-600 text-white px-6 rounded-xl font-bold">Crear</button></div></form></div>
            <div className="space-y-3">{services.map(srv => (<div key={srv.id} className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center"><div className="flex items-center gap-3"><span className="text-2xl">{srv.icon}</span><div><p className="font-bold">{srv.name}</p><p className="text-xs text-slate-400">${srv.price}</p></div></div><button onClick={() => handleDeleteService(srv.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={18} /></button></div>))}</div>
          </div>
        )}

        {/* 3. VISTA EQUIPO / SOLICITUDES */}
        {activeTab === 'equipo' && (
          <div className="space-y-4 animate-in fade-in">
            {allTechnicians.length === 0 ? (
                <div className="text-center py-10 text-slate-400"><Users size={40} className="mx-auto mb-2 opacity-20"/><p>No hay técnicos registrados</p></div>
            ) : (
                allTechnicians.map(tech => (
                    <div key={tech.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${tech.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                {tech.name ? tech.name[0] : '?'}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">{tech.name || 'Sin nombre'}</h3>
                                <p className="text-xs text-slate-500">{tech.phone}</p>
                                {tech.status === 'pending' && <span className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Pendiente Aprobación</span>}
                                {tech.status === 'approved' && <span className="text-green-600 text-[10px] font-bold">Activo • {tech.score || 0} pts</span>}
                            </div>
                        </div>
                        <button onClick={() => setSelectedTech(tech)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-200">
                            {tech.status === 'pending' ? 'Revisar' : 'Gestionar'}
                        </button>
                    </div>
                ))
            )}
          </div>
        )}

        {/* --- MODAL MAESTRO: REVISIÓN DE TÉCNICO Y CURSOS --- */}
        {selectedTech && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative animate-in zoom-in max-h-[90vh] overflow-y-auto">
                    <div className="bg-indigo-900 p-4 text-white flex justify-between items-center">
                        <h3 className="font-bold">Perfil del Técnico</h3>
                        <button onClick={() => setSelectedTech(null)} className="p-1 hover:bg-white/20 rounded-full"><X size={20}/></button>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        {/* Cabecera del Técnico */}
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">{selectedTech.name}</h2>
                                <p className="text-gray-500 text-sm">{selectedTech.phone}</p>
                            </div>
                            <div className="text-center bg-indigo-50 p-2 rounded-lg">
                                <span className="block text-xs text-indigo-400 font-bold uppercase">Score</span>
                                <span className="text-2xl font-black text-indigo-700">{selectedTech.score || 0}</span>
                            </div>
                        </div>
                        
                        {/* SECCIÓN 1: KYC (Cédula y Récord) */}
                        <div>
                            <h4 className="font-bold text-gray-800 mb-2 border-b pb-1 flex items-center gap-2"><Shield size={16}/> Documentos Legales</h4>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <a href={selectedTech.idUrl} target="_blank" rel="noreferrer" className="bg-gray-100 rounded-lg p-3 text-center text-xs font-bold text-blue-600 hover:bg-blue-50 transition border border-gray-200 block">
                                    Ver Cédula
                                </a>
                                <a href={selectedTech.recordUrl} target="_blank" rel="noreferrer" className="bg-gray-100 rounded-lg p-3 text-center text-xs font-bold text-blue-600 hover:bg-blue-50 transition border border-gray-200 block">
                                    Ver Récord
                                </a>
                            </div>
                        </div>

                        {/* SECCIÓN 2: CERTIFICACIONES Y CURSOS */}
                        <div>
                            <h4 className="font-bold text-gray-800 mb-2 border-b pb-1 flex items-center gap-2"><GraduationCap size={16}/> Títulos y Cursos ({techCerts.length})</h4>
                            
                            <div className="space-y-3 mt-3">
                                {techCerts.length === 0 && <p className="text-sm text-gray-400 italic text-center py-2">Este técnico no ha subido títulos aún.</p>}
                                
                                {techCerts.map(cert => (
                                    <div key={cert.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-sm text-gray-800">{cert.name}</span>
                                            {cert.status === 'approved' && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Aprobado</span>}
                                            {cert.status === 'pending' && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">Pendiente</span>}
                                            {cert.status === 'rejected' && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">Rechazado</span>}
                                        </div>
                                        
                                        {/* Imagen del título */}
                                        <div className="h-32 bg-white rounded border mb-3 overflow-hidden">
                                            <img src={cert.imageUrl} className="w-full h-full object-contain" />
                                        </div>
                                        
                                        {/* Botones de acción (Solo si está pendiente) */}
                                        {cert.status === 'pending' && (
                                            <div className="flex gap-2">
                                                <button onClick={() => rejectCert(cert.id)} className="flex-1 bg-white border border-red-200 text-red-600 py-2 rounded text-xs font-bold hover:bg-red-50 transition">
                                                    Rechazar
                                                </button>
                                                <button onClick={() => approveCert(cert.id)} className="flex-1 bg-green-600 text-white py-2 rounded text-xs font-bold hover:bg-green-700 shadow-sm transition">
                                                    Validar (+10 pts)
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* SECCIÓN 3: ACCIONES DE APROBACIÓN DE INGRESO (Solo si es nuevo) */}
                        {selectedTech.status === 'pending' && (
                            <div className="pt-4 border-t mt-4 bg-yellow-50 -mx-6 -mb-6 p-6">
                                <p className="text-xs text-center text-yellow-700 font-bold mb-3">Este técnico solicita ingresar a la plataforma</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => rejectTech(selectedTech.id)} className="bg-white border border-red-200 text-red-600 py-3 rounded-xl font-bold hover:bg-red-50">Rechazar Ingreso</button>
                                    <button onClick={() => approveTech(selectedTech.id)} className="bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 shadow-lg">Aprobar Ingreso</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}