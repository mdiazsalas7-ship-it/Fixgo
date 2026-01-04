// src/app/dashboard/tecnico/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '../../../firebase/config';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, onSnapshot, doc, updateDoc, orderBy, addDoc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import QRCode from "react-qr-code"; 
import { CheckCircle, MapPin, Camera, LogOut, X, Briefcase, UploadCloud, Navigation, QrCode, MessageCircle, Send, ShieldAlert, FileText, User, Award, Plus } from 'lucide-react';
import { sendNotification } from '../../../utils/notifications'; 

export default function TechnicianDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // DATOS DEL TÉCNICO
  const [techProfile, setTechProfile] = useState(null); 
  const [kycStatus, setKycStatus] = useState('unknown');
  
  // ESTADOS DASHBOARD
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('disponibles');
  const [showQr, setShowQr] = useState(false);
  
  // ESTADOS PERFIL
  const [showProfile, setShowProfile] = useState(false);
  const [certifications, setCertifications] = useState([]);
  const [newCert, setNewCert] = useState({ name: '', file: null });
  const [uploadingCert, setUploadingCert] = useState(false);

  // Estados Operativos
  const [proofImageFile, setProofImageFile] = useState(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const proofFileInputRef = useRef(null);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const chatScrollRef = useRef(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { router.push('/login'); return; }
      setUser(currentUser);

      // Vincular OneSignal
      import('react-onesignal').then((OneSignal) => {
        OneSignal.default.login(currentUser.uid);
        OneSignal.default.sendTag("role", "tecnico");
      });

      const techRef = doc(db, "technicians", currentUser.uid);
      const unsubscribeTech = onSnapshot(techRef, (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              setTechProfile(data);
              setKycStatus(data.status);
          } else {
              setKycStatus('missing_docs');
          }
          setLoading(false);
      });

      const certsQuery = query(collection(db, "technicians", currentUser.uid, "certifications"));
      const unsubscribeCerts = onSnapshot(certsQuery, (snap) => {
          setCertifications(snap.docs.map(d => ({id: d.id, ...d.data()})));
      });

      return () => { unsubscribeTech(); unsubscribeCerts(); };
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (user && kycStatus === 'approved') {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snapshot) => { setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
        return () => unsub();
    }
  }, [user, kycStatus]);

  const handleUploadCert = async (e) => {
      e.preventDefault();
      if(!newCert.name || !newCert.file) return alert("Faltan datos");
      setUploadingCert(true);
      try {
          const storageRef = ref(storage, `certs/${user.uid}/${Date.now()}_${newCert.file.name}`);
          const snap = await uploadBytes(storageRef, newCert.file);
          const url = await getDownloadURL(snap.ref);

          await addDoc(collection(db, "technicians", user.uid, "certifications"), {
              name: newCert.name,
              imageUrl: url,
              status: 'pending',
              uploadedAt: serverTimestamp()
          });
          setNewCert({ name: '', file: null });
          alert("🎓 Título subido. Esperando validación.");
      } catch (err) { console.error(err); alert("Error"); }
      finally { setUploadingCert(false); }
  };

  const getBadge = (points = 0) => {
      if (points >= 50) return { icon: '🥇', label: 'Maestro', color: 'text-yellow-500', bg: 'bg-yellow-100' };
      if (points >= 20) return { icon: '🥈', label: 'Profesional', color: 'text-gray-500', bg: 'bg-gray-100' };
      return { icon: '🥉', label: 'Técnico', color: 'text-orange-600', bg: 'bg-orange-100' };
  };

  const handleLogout = async () => { await signOut(auth); router.push('/login'); };

  const acceptJob = async (order) => { 
    if(!confirm("¿Aceptas el trabajo?")) return; 
    try { 
      await updateDoc(doc(db, "orders", order.id), { status: 'asignado', technicianId: user.uid, technicianPhone: user.phoneNumber }); 
      await sendNotification("✅ ¡Tu técnico FixGo aceptó el trabajo y va en camino!", [order.userId]);
      alert("✅ Trabajo aceptado."); 
      setSelectedOrder(null); 
      setActiveTab('mis_trabajos'); 
    } catch (error) { alert("Error"); } 
  };

  const finishJob = async (order) => { 
    if (!proofImageFile) { alert("⚠️ FOTO OBLIGATORIA"); return; } 
    if(!confirm("¿Terminaste el trabajo?")) return; 
    setIsUploading(true); 
    try { 
      const storageRef = ref(storage, `proofs/${order.id}/${Date.now()}_final.jpg`); 
      const snapshot = await uploadBytes(storageRef, proofImageFile); 
      const downloadURL = await getDownloadURL(snapshot.ref); 
      await updateDoc(doc(db, "orders", order.id), { status: 'terminado', completedAt: new Date(), proofImageUrl: downloadURL }); 
      await sendNotification("🏆 ¡Trabajo completado! Por favor, califica el servicio.", [order.userId]);
      alert("🏆 ¡Trabajo completado!"); 
      setSelectedOrder(null); 
    } catch (error) { alert("Error: " + error.message); } finally { setIsUploading(false); } 
  };

  const handleProofImageSelect = (e) => { const file = e.target.files[0]; if (file) { setProofImageFile(file); setProofPreviewUrl(URL.createObjectURL(file)); } };
  const clearProofImage = () => { setProofImageFile(null); setProofPreviewUrl(null); if (proofFileInputRef.current) proofFileInputRef.current.value = ''; };

  // 🔥 NUEVA FUNCIÓN WAZE INTELIGENTE 🚗
  const openWaze = (order) => {
    // 1. Intentamos usar coordenadas GPS (Más preciso)
    const lat = order.lat || order.latitude || order.latitud || order.locationLat;
    const lng = order.lng || order.longitude || order.longitud || order.locationLng;

    if (lat && lng) {
        const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
        window.open(wazeUrl, '_blank');
    } else {
        // 2. Si no hay GPS, usamos la dirección escrita + Venezuela
        const query = encodeURIComponent(order.location + ", Venezuela");
        window.open(`https://waze.com/ul?q=${query}&navigate=yes`, '_blank');
    }
  };
  
  const [kycData, setKycData] = useState({ name: '', idPhoto: null, recordPhoto: null });
  const [uploadingKyc, setUploadingKyc] = useState(false);
  const submitKyc = async (e) => { e.preventDefault(); if (!kycData.name || !kycData.idPhoto || !kycData.recordPhoto) { alert("Completa todo."); return; } setUploadingKyc(true); try { const idRef = ref(storage, `kyc/${user.uid}/id_card.jpg`); const idSnap = await uploadBytes(idRef, kycData.idPhoto); const idUrl = await getDownloadURL(idSnap.ref); const recRef = ref(storage, `kyc/${user.uid}/police_record.jpg`); const recSnap = await uploadBytes(recRef, kycData.recordPhoto); const recUrl = await getDownloadURL(recSnap.ref); await setDoc(doc(db, "technicians", user.uid), { phone: user.phoneNumber, name: kycData.name, idUrl: idUrl, recordUrl: recUrl, status: 'pending', joinedAt: serverTimestamp(), score: 0 }); setKycStatus('pending'); alert("Enviado."); } catch (error) { console.error(error); } finally { setUploadingKyc(false); } };
  
  useEffect(() => { if (selectedOrder && showChat) { const q = query(collection(db, "orders", selectedOrder.id, "messages"), orderBy("createdAt", "asc")); const unsub = onSnapshot(q, (snap) => { setMessages(snap.docs.map(d => ({id: d.id, ...d.data()}))); setTimeout(() => chatScrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }); return () => unsub(); } }, [selectedOrder, showChat]);
  
  const sendMessage = async (e) => { 
    e.preventDefault(); 
    if (!newMessage.trim()) return; 
    try { 
      await addDoc(collection(db, "orders", selectedOrder.id, "messages"), { text: newMessage, senderId: user.uid, createdAt: serverTimestamp() }); 
      await sendNotification(`💬 Nuevo mensaje: ${newMessage}`, [selectedOrder.userId]);
      setNewMessage(''); 
    } catch (error) { console.error(error); } 
  };

  useEffect(() => { if (!selectedOrder) { clearProofImage(); setShowQr(false); setShowChat(false); } }, [selectedOrder]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>Cargando...</p></div>;
  if (kycStatus === 'missing_docs') return (<div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center"><div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md"><h1 className="text-2xl font-bold mb-4">Registro Técnico</h1><form onSubmit={submitKyc} className="space-y-4"><input type="text" placeholder="Nombre" className="w-full p-2 border rounded" onChange={e => setKycData({...kycData, name: e.target.value})} /><p className="text-xs">Foto Cédula:</p><input type="file" onChange={e => setKycData({...kycData, idPhoto: e.target.files[0]})} /><p className="text-xs">Récord Policivo:</p><input type="file" onChange={e => setKycData({...kycData, recordPhoto: e.target.files[0]})} /><button type="submit" disabled={uploadingKyc} className="w-full bg-black text-white p-3 rounded font-bold">{uploadingKyc ? 'Subiendo...' : 'Enviar'}</button></form><button onClick={handleLogout} className="mt-4 text-sm text-gray-500">Salir</button></div></div>);
  if (kycStatus === 'pending') return (<div className="min-h-screen flex items-center justify-center bg-yellow-50"><div className="text-center"><h1 className="text-2xl font-bold">En Revisión ⏳</h1><p>Estamos validando tus documentos.</p><button onClick={handleLogout} className="mt-4 text-blue-600">Salir</button></div></div>);
  if (kycStatus === 'rejected') return (<div className="min-h-screen flex items-center justify-center bg-red-50"><div className="text-center"><h1 className="text-2xl font-bold text-red-600">Rechazado</h1><p>Documentos inválidos.</p><button onClick={() => setKycStatus('missing_docs')} className="mt-4 bg-black text-white px-4 py-2 rounded">Reintentar</button></div></div>);

  const badge = getBadge(techProfile?.score || 0);
  const availableOrders = orders.filter(o => o.status === 'pendiente');
  const myOrders = orders.filter(o => o.status === 'asignado' && o.technicianId === user?.uid);

  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      <div className="bg-gray-900 px-6 pt-12 pb-20 rounded-b-[2rem] shadow-lg relative z-10">
        <div className="flex justify-between items-center text-white mb-6">
          <div className="flex items-center gap-3">
              <img src="https://i.postimg.cc/J7y2CTsc/unnamed.jpg" alt="FixGo Logo" className="w-12 h-12 rounded-xl shadow-md border-2 border-white/20" />
              <div onClick={() => setShowProfile(true)} className="cursor-pointer">
                  <h1 className="text-xl font-bold">Hola, {techProfile?.name.split(' ')[0]}</h1>
                  <p className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block ${badge.bg} ${badge.color}`}>
                    {badge.icon} {badge.label} • {techProfile?.score || 0} pts
                  </p>
              </div>
          </div>
          <button onClick={handleLogout} className="bg-white/20 p-2 rounded-full"><LogOut size={20} /></button>
        </div>
        <div className="flex bg-gray-800 p-1 rounded-xl">
          <button onClick={() => setActiveTab('disponibles')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'disponibles' ? 'bg-yellow-400 text-black' : 'text-gray-400'}`}>Disponibles ({availableOrders.length})</button>
          <button onClick={() => setActiveTab('mis_trabajos')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'mis_trabajos' ? 'bg-green-500 text-white' : 'text-gray-400'}`}>Mis Trabajos ({myOrders.length})</button>
        </div>
      </div>

      <div className="px-6 -mt-8 relative z-20 space-y-4">
        {(activeTab === 'disponibles' ? availableOrders : myOrders).map(order => (
            <div key={order.id} onClick={() => setSelectedOrder(order)} className="bg-white p-4 rounded-xl shadow-md border-l-4 cursor-pointer hover:scale-[1.02] transition flex gap-4 items-center" style={{ borderLeftColor: activeTab === 'disponibles' ? '#FACC15' : '#22C55E' }}>
              <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden">{order.imageUrl ? <img src={order.imageUrl} className="w-full h-full object-cover"/> : <Camera className="m-auto mt-5 text-gray-400"/>}</div>
              <div className="flex-1">
                <div className="flex justify-between">
                    <h3 className="font-bold text-gray-800">{order.service}</h3>
                    <span className="text-xs font-bold bg-gray-100 text-black px-2 py-1 rounded-full">${order.price}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1"><MapPin size={10} className="inline"/> {order.location}</p>
              </div>
            </div>
        ))}
      </div>

      {showProfile && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative animate-in zoom-in max-h-[90vh] overflow-y-auto">
                <button onClick={() => setShowProfile(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={24}/></button>
                <div className="p-6">
                    <div className="text-center mb-6">
                        <div className="text-6xl mb-2">{badge.icon}</div>
                        <h2 className="text-2xl font-bold text-gray-900">{techProfile.name}</h2>
                        <p className={`text-sm font-bold ${badge.color}`}>{badge.label}</p>
                        <div className="mt-4 bg-gray-100 rounded-lg p-3">
                            <p className="text-xs text-gray-500 uppercase">Puntuación de Prioridad</p>
                            <p className="text-3xl font-black text-gray-800">{techProfile.score || 0}</p>
                        </div>
                    </div>
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Award size={18}/> Mis Certificaciones</h3>
                    <div className="space-y-2 mb-6 max-h-40 overflow-y-auto">
                        {certifications.length === 0 && <p className="text-sm text-gray-400 italic">No tienes títulos cargados.</p>}
                        {certifications.map(cert => (
                            <div key={cert.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                                <span className="text-sm font-medium">{cert.name}</span>
                                {cert.status === 'approved' && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">+10 Pts</span>}
                                {cert.status === 'pending' && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Revisión</span>}
                                {cert.status === 'rejected' && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded-full">Rechazado</span>}
                            </div>
                        ))}
                    </div>
                    <div className="border-t pt-4">
                        <h3 className="font-bold text-gray-800 mb-2 text-sm">Subir Nuevo Título (+10 Puntos)</h3>
                        <form onSubmit={handleUploadCert} className="space-y-2">
                            <input type="text" placeholder="Nombre" className="w-full text-sm p-2 border rounded-lg" value={newCert.name} onChange={e => setNewCert({...newCert, name: e.target.value})} />
                            <input type="file" className="w-full text-sm text-slate-500" accept="image/*" onChange={e => setNewCert({...newCert, file: e.target.files[0]})} />
                            <button type="submit" disabled={uploadingCert} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:bg-gray-400">{uploadingCert ? 'Subiendo...' : 'Enviar para Validación'}</button>
                        </form>
                    </div>
                </div>
             </div>
          </div>
      )}

      {selectedOrder && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200 max-h-[95vh] overflow-y-auto flex flex-col">
              {showChat ? (
                  <div className="flex flex-col h-[500px]">
                      <div className="bg-gray-900 p-4 text-white flex justify-between items-center"><h3 className="font-bold">Chat</h3><button onClick={() => setShowChat(false)}>Cerrar</button></div>
                      
                      {/* 🟢 ZONA DE MENSAJES CORREGIDA */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                          {messages.map((msg) => { 
                            const isMe = msg.senderId === user.uid; 
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    {/* Aquí forzamos text-gray-800 cuando NO soy yo, para que se lea en gris */}
                                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${isMe ? 'bg-black text-white' : 'bg-gray-200 text-gray-800'}`}>
                                        {msg.text}
                                    </div>
                                </div>
                            )
                          })}
                          <div ref={chatScrollRef} />
                      </div>

                      <form onSubmit={sendMessage} className="p-3 bg-white border-t flex gap-2">
                          {/* 🟢 INPUT CORREGIDO: text-gray-900 */}
                          <input type="text" className="flex-1 bg-gray-100 text-gray-900 rounded-full px-4 py-3 outline-none" placeholder="..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                          <button type="submit" className="bg-black text-white p-3 rounded-full"><Send size={20} /></button>
                      </form>
                  </div>
              ) : (
                  <>
                      <button onClick={() => setSelectedOrder(null)} className="absolute top-4 right-4 z-10 bg-black/50 text-white p-2 rounded-full"><X size={20} /></button>
                      <div className="h-64 bg-gray-200 w-full relative shrink-0">{selectedOrder.imageUrl ? <img src={selectedOrder.imageUrl} className="w-full h-full object-cover"/> : <div className="p-20 text-center text-gray-400">Sin foto</div>}</div>
                      <div className="p-6 space-y-4">
                          {selectedOrder.status === 'pendiente' && <button onClick={() => acceptJob(selectedOrder)} className="w-full bg-yellow-400 py-3 rounded-xl font-bold">Aceptar Trabajo</button>}
                          {selectedOrder.status === 'asignado' && !showQr && (
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => openWaze(selectedOrder)} className="p-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs flex flex-col items-center"><Navigation size={20}/>Waze</button>
                                <button onClick={() => setShowQr(true)} className="p-2 bg-gray-900 text-white rounded-xl font-bold text-xs flex flex-col items-center"><QrCode size={20}/>Pase</button>
                                <button onClick={() => setShowChat(true)} className="p-2 bg-green-50 text-green-600 rounded-xl font-bold text-xs flex flex-col items-center"><MessageCircle size={20}/>Chat</button>
                            </div>
                          )}
                          {showQr && <div className="text-center"><QRCode value={`S:${selectedOrder.id}`} size={150}/><button onClick={() => setShowQr(false)} className="block w-full mt-2 text-red-500">Ocultar</button></div>}
                          {selectedOrder.status === 'asignado' && !showQr && (
                              <div className="border-2 border-dashed p-4 rounded-xl">
                                  <h3 className="font-bold text-sm mb-2">Foto Final</h3>
                                  <input type="file" hidden ref={proofFileInputRef} onChange={handleProofImageSelect} />
                                  <button onClick={() => proofFileInputRef.current.click()} className="w-full py-2 bg-gray-100 rounded-lg text-sm mb-2">Tomar Foto</button>
                                  {proofPreviewUrl && <img src={proofPreviewUrl} className="h-20 w-full object-cover rounded-lg mb-2"/>}
                                  <button onClick={() => finishJob(selectedOrder)} disabled={isUploading} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">Finalizar</button>
                              </div>
                          )}
                      </div>
                  </>
              )}
            </div>
          </div>
      )}
    </div>
  );
}