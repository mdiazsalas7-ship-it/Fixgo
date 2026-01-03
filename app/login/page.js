// src/app/login/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../firebase/config'; 
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);

  useEffect(() => {
    if (!window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible',
          'callback': () => {},
          'expired-callback': () => setError('Captcha expirado.')
        });
      } catch (err) { console.error(err); }
    }
  }, []);

  const sendOtp = async () => {
    setError('');
    if (phoneNumber.length < 8) { setError('Número corto.'); return; }
    setLoading(true);
    const formatPh = '+507' + phoneNumber; 
    try {
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, formatPh, appVerifier);
      setConfirmationResult(confirmation);
      setStep(2); 
    } catch (err) {
      console.error(err);
      setError('Error al enviar SMS.');
      if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await confirmationResult.confirm(otp);
      const user = result.user;
      
      const TECH_NUMBER = '+50769999999';
      const CEO_NUMBER =  '+50788888888';

      if (user.phoneNumber === TECH_NUMBER) {
          router.push('/dashboard/tecnico');
      } else if (user.phoneNumber === CEO_NUMBER) {
          router.push('/dashboard/admin');
      } else {
          router.push('/dashboard/cliente');
      }
      
    } catch (err) {
      console.error(err);
      setError('Código incorrecto.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6 py-12 lg:px-8">
      <div id="recaptcha-container"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
        
        {/* LOGO MÁS GRANDE (h-56) */}
        <img 
            src="https://i.postimg.cc/FHq2L2kX/unnamed-removebg-preview.png" 
            alt="Logo FixGo" 
            className="mx-auto h-56 w-auto mb-6 hover:scale-105 transition duration-300"
        />
        
        <h2 className="text-2xl font-bold text-gray-900">Acceso FixGo</h2>
        <p className="mt-2 text-sm text-gray-500">
          {step === 1 ? 'Ingresa tu celular para continuar' : 'Ingresa el código de verificación'}
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium leading-6 text-gray-900">Celular</label>
              <div className="relative mt-2 rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">🇵🇦 +507</span>
                </div>
                <input type="tel" name="phone" id="phone" className="block w-full rounded-md border-0 py-3 pl-20 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" placeholder="60000000" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}/>
              </div>
            </div>
            <button onClick={sendOtp} disabled={loading} className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Enviar Código SMS'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900 mb-2">Código de Verificación</label>
              <input type="text" maxLength={6} className="block w-full text-center tracking-[0.5em] text-2xl font-bold rounded-md border-0 py-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600" placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value)}/>
            </div>
            <button onClick={verifyOtp} disabled={loading} className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Verificar y Entrar'}
            </button>
            <div className="text-center mt-4">
                 <button onClick={() => setStep(1)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
                   ¿Número equivocado? Corregir
                 </button>
            </div>
          </div>
        )}

        {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg text-center border border-red-200 animate-in fade-in">
                {error}
            </div>
        )}
      </div>
    </div>
  );
}