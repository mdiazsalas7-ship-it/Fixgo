// src/app/dashboard/cliente/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '../../../firebase/config'; 
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, updateDoc, orderBy, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapPin, LogOut, Camera, XCircle, Star, CheckCircle, ShoppingBag, MessageCircle, Send } from 'lucide-react';
import { sendNotification } from '../../../utils/notifications'; // Importar utilidad de notificaciones

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [services, setServices] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState(''); 
  
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  
  // ESTADOS (Chat y Calificación)
  const [ratingOrder, setRatingOrder] = useState(null);
  const [chatOrder, setChatOrder] = useState(null); 
  const [messages, setMessages] = useState([]);     
  const [newMessage, setNewMessage] = useState(''); 
  const chatScrollRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push('/login'); else setUser(currentUser);
    });

    if(user) {
        // Pedidos
        const q = query(collection(db, "orders"), where("userId", "==", user.uid));
        const unsubOrders = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({id: d.id, ...d.data()}));
            const activeOrders = data.filter(o => o.status !== 'cerrado');
            activeOrders.sort((a,b) => b.createdAt - a.createdAt);
            setOrders(activeOrders);
        });
        // Catálogo
        const qServices = query(collection(db, "services"));
        const unsubServices = onSnapshot(qServices, (snap) => {
            setServices(snap.docs.map(d => ({id: d.id, ...d.data()})));
        });
        return () => { unsubOrders(); unsubServices(); };
    }
    return () => unsubscribe();
  }, [router, user]);

  // --- LÓGICA DEL CHAT EN TIEMPO REAL ---
  useEffect(() => {
    if (chatOrder) {
        const q = query(collection(db, "orders", chatOrder.id, "messages"), orderBy("createdAt", "asc"));
        const unsub = onSnapshot(q, (snap) => {
            setMessages(snap.docs.map(d => ({id: d.id, ...d.data()})));
            setTimeout(() => chatScrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        });
        return () => unsub();
    }
  }, [chatOrder]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
        await addDoc(collection(db, "orders", chatOrder.id, "messages"), {
            text: newMessage,
            senderId: user.uid,
            createdAt: serverTimestamp()
        });

        // 🔔 NOTIFICACIÓN AL TÉCNICO
        if (chatOrder.technicianId) {
            await sendNotification(`💬 Mensaje del cliente: ${newMessage}`, [chatOrder.technicianId]);
        }

        setNewMessage('');
    } catch (error) { console.error("Error enviando mensaje", error); }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) { setImageFile(file); setPreviewUrl(URL.createObjectURL(file)); }
  };
  const clearImage = () => { setImageFile(null); setPreviewUrl(null); if(fileInputRef.current) fileInputRef.current.value = ''; };

  const handleOrder = async (serviceName, price) => {
    if (!address.trim()) { alert("⚠️ Escribe tu Torre y Apto."); return; }
    if (!confirm(`¿Solicitar ${serviceName}?`)) return;
    setLoading(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        const storageRef = ref(storage, `evidencias/${user.uid}/${Date.now()}_${imageFile.name}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }
      await addDoc(collection(db, "orders"), {
        userId: user.uid,
        userPhone: user.phoneNumber,
        service: serviceName,
        price: price,
        status: 'pendiente',
        createdAt: serverTimestamp(),
        location: address,
        imageUrl: imageUrl
      });

      // 🔔 NOTIFICACIÓN A TODOS LOS TÉCNICOS
      await sendNotification(`🔧 ¡Nueva solicitud de ${serviceName} disponible!`);

      alert("✅ Solicitud enviada"); clearImage();
    } catch (error) { console.error(error); alert("Error: " + error.message); } 
    finally { setLoading(false); }
  };

  const submitRating = async (stars) => {
    if (!ratingOrder) return;
    try {
        await updateDoc(doc(db, "orders", ratingOrder.id), { status: 'cerrado', rating: stars });
        
        if (ratingOrder.technicianId) {
            const techRef = doc(db, "technicians", ratingOrder.technicianId);
            const techSnap = await getDoc(techRef);
            
            if (techSnap.exists()) {
                const currentScore = techSnap.data().score || 0;
                let pointsToAdd = 0;
                if (stars === 5) pointsToAdd = 5;
                else if (stars === 4) pointsToAdd = 3;
                else if (stars === 3) pointsToAdd = 1;
                
                if (pointsToAdd > 0) {
                    await updateDoc(techRef, { score: currentScore + pointsToAdd });
                }
                
                // 🔔 NOTIFICACIÓN AL TÉCNICO SOBRE SU CALIFICACIÓN
                await sendNotification(`⭐ El cliente te calificó con ${stars} estrellas. ¡Buen trabajo!`, [ratingOrder.technicianId]);
            }
        }

        alert(`⭐️ ¡Gracias!`); 
        setRatingOrder(null); 
    } catch (error) { console.error(error); }
  };

  const handleLogout = async () => { await signOut(auth); router.push('/login'); };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* HEADER */}
      <div className="bg-blue-600 px-6 pt-12 pb-24 rounded-b-[2.5rem] shadow-lg relative z-10">
        <div className="flex justify-between items-center text-white mb-4">
          <div className="flex items-center gap-3">
             <img src="https://i.postimg.cc/J7y2CTsc/unnamed.jpg" alt="FixGo Logo" className="w-12 h-12 rounded-xl shadow-md border-2 border-white/20"/>
             <div>
                <h1 className="text-xl font-bold">FixGo</h1>
                <p className="text-blue-100 text-sm">{user?.phoneNumber}</p>
             </div>
          </div>
          <button onClick={handleLogout} className="bg-white/20 p-2 rounded-full"><LogOut size={18} /></button>
        </div>
        <div className="bg-blue-700/50 p-3 rounded-xl flex items-center gap-3 border border-blue-400/30">
          <MapPin className="text-blue-200" size={20} />
          <input type="text" placeholder="Escribe Torre y Apto..." className="bg-transparent text-white placeholder-blue-200 w-full outline-none text-sm font-medium" value={address} onChange={(e) => setAddress(e.target.value)}/>
        </div>
      </div>

      <div className="px-6 -mt-16 relative z-20 space-y-6">
        {/* FORMULARIO PEDIDO */}
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-4">1. Evidencia (Opcional)</h2>
          <input type="file" accept="image/*" capture="environment" hidden ref={fileInputRef} onChange={handleImageSelect} />
          {!previewUrl ? (
            <button onClick={() => fileInputRef.current.click()} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 flex flex-col items-center gap-2 hover:bg-gray-50 transition"><Camera size={24} /><span className="text-sm font-medium">Foto del problema</span></button>
          ) : (
            <div className="relative w-full h-48 bg-gray-100 rounded-xl overflow-hidden">
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              <button onClick={clearImage} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"><XCircle size={20} /></button>
            </div>
          )}
          
          <h2 className="font-bold text-gray-800 mt-6 mb-4">2. Solicitar Servicio</h2>
          {services.length === 0 ? (
             <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed"><ShoppingBag size={32} className="mx-auto mb-2 opacity-50"/><p>Cargando servicios...</p></div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
                {services.map(srv => (
                    <button key={srv.id} onClick={() => handleOrder(srv.name, srv.price)} disabled={loading} className="flex flex-col items-center justify-center p-4 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition border border-blue-100 active:scale-95">
                        <span className="text-3xl mb-2">{srv.icon}</span>
                        <span className="font-bold text-sm text-center leading-tight">{srv.name}</span>
                        <span className="text-xs bg-white px-2 py-0.5 rounded-full mt-1 font-bold text-blue-400">${srv.price}</span>
                    </button>
                ))}
            </div>
          )}
        </div>

        {/* LISTA PEDIDOS */}
        {orders.length > 0 && (
          <div className="space-y-3 pb-6">
            <h3 className="font-bold text-gray-800 px-2">Tus Pedidos</h3>
            {orders.map((order) => (
              <div key={order.id} className={`p-4 rounded-2xl shadow-sm border flex flex-col gap-3 ${order.status === 'terminado' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {order.status === 'pendiente' && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>}
                    {order.status === 'asignado' && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                    {order.status === 'terminado' && <CheckCircle size={16} className="text-green-600"/>}
                    <p className="font-bold text-gray-800 text-sm">{order.service}</p>
                  </div>
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-bold">${order.price}</span>
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={10} /> {order.location} • <span className="uppercase">{order.status}</span></p>
                
                {(order.status === 'asignado' || order.status === 'terminado') && (
                    <button onClick={() => setChatOrder(order)} className="w-full flex items-center justify-center gap-2 bg-blue-100 text-blue-700 py-2 rounded-lg font-bold text-sm hover:bg-blue-200 transition">
                        <MessageCircle size={16} /> Chat con Técnico
                    </button>
                )}

                {order.status === 'terminado' && (
                  <button onClick={() => setRatingOrder(order)} className="w-full mt-1 bg-green-600 text-white py-2 rounded-lg font-bold text-sm shadow-md hover:bg-green-700 active:scale-95 transition flex items-center justify-center gap-2">Ver Evidencia y Calificar ⭐</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE CHAT */}
      {chatOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm">
            <div className="bg-white w-full sm:max-w-md h-[80vh] sm:h-[600px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                    <div>
                        <h3 className="font-bold">{chatOrder.service}</h3>
                        <p className="text-xs text-blue-100">Chat con Técnico</p>
                    </div>
                    <button onClick={() => setChatOrder(null)} className="p-2 bg-white/20 rounded-full hover:bg-white/30"><XCircle size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                    {messages.length === 0 && <p className="text-center text-gray-400 text-sm mt-10">Inicia la conversación...</p>}
                    {messages.map((msg) => {
                        const isMe = msg.senderId === user.uid;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border text-gray-800 rounded-bl-none'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        )
                    })}
                    <div ref={chatScrollRef} />
                </div>
                <form onSubmit={sendMessage} className="p-3 bg-white border-t flex gap-2">
                    <input type="text" className="flex-1 bg-gray-100 rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Escribe un mensaje..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)}/>
                    <button type="submit" className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition disabled:opacity-50" disabled={!newMessage.trim()}><Send size={20} /></button>
                </form>
            </div>
        </div>
      )}

      {/* MODAL CALIFICACIÓN */}
      {ratingOrder && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="h-48 bg-gray-200 relative">
                {ratingOrder.proofImageUrl ? (
                    <img src={ratingOrder.proofImageUrl} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400"><Camera size={32}/><p className="text-xs">Sin foto de cierre</p></div>
                )}
                <button onClick={() => setRatingOrder(null)} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full"><XCircle size={20}/></button>
            </div>
            <div className="p-6 text-center">
              <h2 className="text-xl font-bold text-gray-900">¡Trabajo Terminado!</h2>
              <div className="flex justify-center gap-2 my-6">
                {[1, 2, 3, 4, 5].map((star) => (<button key={star} onClick={() => submitRating(star)} className="p-2 hover:scale-110 transition"><Star size={32} className="text-yellow-400 fill-yellow-400" /></button>))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}