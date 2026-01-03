// src/app/login/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../firebase/config'; 
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore'; 
import { Loader2 } from 'lucide-react';
import OneSignal from 'react-onesignal'; 

export default function LoginPage() {
  const router = useRouter();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);

  const [newRole, setNewRole] = useState('cliente');
  const [newName, setNewName] = useState('');
  const [userUid, setUserUid] = useState(null);

  useEffect(() => {
    // Configuración del Captcha invisible de Firebase
    if (!window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible',
          'callback': () => {},
          'expired-callback': () => setError('Captcha expirado. Recarga la página.')
        });
      } catch (err) { console.error("Error captcha:", err); }
    }
  }, []);

  const sendOtp = async () => {
    setError('');
    // En Venezuela los números son ej: 4121234567 (10 dígitos)
    if (phoneNumber.length < 10) { 
        setError('Ingresa el número completo (Ej: 4121234567)'); 
        return; 
    }
    setLoading(true);

    // 🇻🇪 CAMBIO A VENEZUELA (+58)
    const formatPh = '+58' + phoneNumber; 
    
    try {
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, formatPh, appVerifier);
      setConfirmationResult(confirmation);
      setStep(2); 
    } catch (err) {
      console.error(err);
      setError('Error enviando SMS. Verifica tu conexión o intenta más tarde.');
      if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await confirmationResult.confirm(otp);
      const user = result.user;
      setUserUid(user.uid);

      // 🔥 VINCULACIÓN ONESIGNAL (CRÍTICO PARA QUE SUENE)
      try {
        await OneSignal.login(user.uid);
        console.log("🇻🇪 OneSignal conectado. Usuario:", user.uid);
      } catch (osError) {
        console.error("Error vinculando OneSignal:", osError);
      }

      // Revisar si existe en Base de Datos
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === 'admin') router.push('/dashboard/admin');
        else if (userData.role === 'tecnico') router.push('/dashboard/tecnico');
        else router.push('/dashboard/cliente');
      } else {
        setStep(3); // Ir a registro
        setLoading(false);
      }
      
    } catch (err) {
      console.error(err);
      setError('Código incorrecto.');
      setLoading(false);
    }
  };

  const completeRegistration = async () => {
    if(!newName.trim()) { setError("Ingresa tu nombre"); return; }
    setLoading(true);
    try {
      await setDoc(doc(db, "users", userUid), {
        phoneNumber: '+58' + phoneNumber, // 🇻🇪 Guardamos con +58
        displayName: newName,
        role: newRole,
        status: newRole === 'tecnico' ? 'pendiente' : 'activo',
        country: 'Venezuela', // Opcional: para saber de dónde son
        createdAt: new Date()
      });

      if (newRole === 'tecnico') router.push('/dashboard/tecnico');
      else router.push('/dashboard/cliente');

    } catch (err) {
      console.error(err);
      setError("Error guardando datos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6 py-12 lg:px-8">
      <div id="recaptcha-container"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
        <img 
            src="https://i.postimg.cc/FHq2L2kX/unnamed-removebg-preview.png" 
            alt="Logo FixGo" 
            className="mx-auto h-56 w-auto mb-6 hover:scale-105 transition duration-300"
        />
        
        <h2 className="text-2xl font-bold text-gray-900">
          {step === 3 ? 'Completa tu perfil' : 'Acceso FixGo Venezuela'}
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          {step === 1 && 'Ingresa tu número (Ej: 412...)'}
          {step === 2 && 'Ingresa el código SMS'}
          {step === 3 && 'Selecciona tu rol'}
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        
        {/* PASO 1: TELÉFONO VENEZUELA */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium leading-6 text-gray-900">Celular</label>
              <div className="relative mt-2 rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                  {/* Bandera y código de Venezuela */}
                  <span className="text-gray-500 sm:text-sm font-bold">🇻🇪 +58</span>
                </div>
                <input 
                    type="tel" 
                    className="block w-full rounded-md border-0 py-3 pl-20 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" 
                    placeholder="4121234567" 
                    value={phoneNumber} 
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>
            <button onClick={sendOtp} disabled={loading} className="flex w-full justify-center rounded-md bg-blue-700 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Enviar Código SMS'}
            </button>
          </div>
        )}

        {/* PASO 2: OTP */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900 mb-2">Código de Verificación</label>
              <input type="text" maxLength={6} className="block w-full text-center tracking-[0.5em] text-2xl font-bold rounded-md border-0 py-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600" placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value)}/>
            </div>
            <button onClick={verifyOtp} disabled={loading} className="flex w-full justify-center rounded-md bg-blue-700 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Verificar'}
            </button>
            <button onClick={() => setStep(1)} className="block w-full text-center text-sm font-semibold text-indigo-600 mt-4">Corregir número</button>
          </div>
        )}

        {/* PASO 3: REGISTRO */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Tu Nombre</label>
              <input type="text" className="mt-2 block w-full rounded-md border-0 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 pl-3" placeholder="Ej. Pedro Pérez" value={newName} onChange={(e) => setNewName(e.target.value)}/>
            </div>
            
            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">¿Qué eres?</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="mt-2 block w-full rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6">
                <option value="cliente">👤 Cliente (Busco servicio)</option>
                <option value="tecnico">🔧 Técnico (Ofrezco servicio)</option>
              </select>
            </div>

            <button onClick={completeRegistration} disabled={loading} className="flex w-full justify-center rounded-md bg-green-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Entrar a FixGo'}
            </button>
          </div>
        )}

        {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg text-center border border-red-200">
                {error}
            </div>
        )}
      </div>
    </div>
  );
}