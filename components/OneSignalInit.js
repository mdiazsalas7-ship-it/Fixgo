'use client';
import { useEffect } from 'react';
import OneSignal from 'react-onesignal';
import { auth } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

export default function OneSignalInit() {
  useEffect(() => {
    const runOneSignal = async () => {
      try {
        // 1. Inicializar el SDK
        await OneSignal.init({
          appId: "9d81caa9-afe0-41d0-8790-e1f0f41a9a15",
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerParam: { scope: "/" }, // Asegura que el SW cubra toda la app
          serviceWorkerPath: "OneSignalSDKWorker.js", // Nombre exacto del archivo en /public
          notifyButton: {
            enable: true,
            position: 'bottom-right',
            colors: {
              'circle.background': '#2563eb',
            },
          },
        });

        // 2. Forzar el banner de suscripción si no hay permiso
        if (OneSignal.Notifications.permission !== "granted") {
           await OneSignal.Slidedown.promptPush();
        }

        // 3. Vincular con Firebase
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            // Vinculamos el UID de Firebase con OneSignal
            await OneSignal.login(user.uid);
            console.log("🔔 OneSignal vinculado con Firebase UID:", user.uid);
            
            // Etiquetar según el rol (opcional pero recomendado para el Admin)
            // Esto ayuda a que el Admin autorice delegados eficientemente
            const isDelegado = user.email && user.email.includes('tecnico'); 
            if(isDelegado) await OneSignal.User.addTag("role", "delegado");
          } else {
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