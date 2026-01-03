// src/components/OneSignalInit.js
'use client';
import { useEffect } from 'react';
import OneSignal from 'react-onesignal';
import { auth } from '../firebase/config'; // Asegúrate que esta ruta sea correcta
import { onAuthStateChanged } from 'firebase/auth';

export default function OneSignalInit() {
  useEffect(() => {
    const runOneSignal = async () => {
      try {
        // 1. Inicializar el SDK
        await OneSignal.init({
          // Usamos la variable de entorno para no dejar el ID expuesto en el código
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID, 
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerParam: { scope: "/" }, 
          serviceWorkerPath: "OneSignalSDKWorker.js", 
          notifyButton: {
            enable: true,
            position: 'bottom-right',
            colors: {
              'circle.background': '#2563eb',
            },
          },
        });

        // 2. Forzar el banner de suscripción si no hay permiso
        // Nota: Un pequeño delay ayuda a que no choque con la carga de la página
        setTimeout(async () => {
            if (OneSignal.Notifications?.permission !== "granted") {
                await OneSignal.Slidedown.promptPush();
            }
        }, 1000);

        // 3. Vincular con Firebase (EL CÓDIGO MAESTRO 🧠)
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            // ¡Aquí ocurre la magia! Vinculamos el celular con el ID de Firebase
            await OneSignal.login(user.uid);
            console.log("🔔 OneSignal conectado. Usuario:", user.uid);
            
            // Etiquetado opcional (Esto es útil si quieres enviar mensajes solo a delegados)
            if(user.email && user.email.includes('tecnico')) {
                await OneSignal.User.addTag("role", "delegado");
            }
          } else {
            // Si cierra sesión en Firebase, lo desconectamos de OneSignal
            await OneSignal.logout();
          }
        });

      } catch (error) {
        console.error("❌ Error al iniciar OneSignal:", error);
      }
    };

    runOneSignal();
  }, []);

  return null;
}