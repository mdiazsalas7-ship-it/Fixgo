'use client';
import { useEffect } from 'react';
import OneSignal from 'react-onesignal';
import { auth } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

export default function OneSignalInit() {
  useEffect(() => {
    const runOneSignal = async () => {
      try {
        // 1. Inicializar el SDK con tu App ID
        await OneSignal.init({
          appId: "9d81caa9-afe0-41d0-8790-e1f0f41a9a15",
          allowLocalhostAsSecureOrigin: true, // Permite pruebas en tu PC
          notifyButton: {
            enable: true, // Muestra la campanita flotante
            position: 'bottom-right',
            colors: {
              'circle.background': '#2563eb', // Azul FixGo
            },
            text: {
              'tip.state.unsubscribed': 'Suscribirse a notificaciones',
              'tip.state.subscribed': 'Estás suscrito',
              'message.prenotify': 'Haz clic para recibir avisos de tus servicios',
            }
          },
          promptOptions: {
            slidedown: {
              prompts: [
                {
                  type: "push",
                  autoPrompt: true,
                  text: {
                    actionMessage: "Recibe avisos de tus técnicos y mensajes de chat al instante.",
                    acceptButton: "Activar",
                    cancelButton: "Luego"
                  },
                  delay: {
                    pageViews: 1,
                    timeDelay: 5
                  }
                }
              ]
            }
          }
        });

        // 2. Vincular el usuario de Firebase con OneSignal automáticamente
        onAuthStateChanged(auth, (user) => {
          if (user) {
            // Usamos el UID de Firebase como External User ID en OneSignal
            // Esto permite enviar notificaciones usando [order.userId]
            OneSignal.login(user.uid);
            console.log("🔔 OneSignal vinculado con Firebase UID:", user.uid);
          } else {
            OneSignal.logout();
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