// Archivo: src/utils/notifications.js

export const sendNotification = async (message, playerIds = [], targetUrl = "/dashboard") => {
  // 1. Leemos las variables de entorno
  const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const ONESIGNAL_REST_API_KEY = process.env.NEXT_PUBLIC_ONESIGNAL_API_KEY;

  // --- DIAGNÓSTICO (Míralo en la consola F12) ---
  console.log("🔍 [Debug] Intentando enviar notificación...");
  if (!ONESIGNAL_REST_API_KEY) {
    console.error("❌ [Error] NO se encontró la API KEY. Reinicia el servidor con 'npm run dev'.");
    return;
  }
  // ----------------------------------------------

  const data = {
    app_id: ONESIGNAL_APP_ID,
    contents: { "es": message },
    headings: { "es": "FixGo 🔧" },
    name: "Notificación Automática FixGo",
    url: typeof window !== 'undefined' ? `${window.location.origin}${targetUrl}` : targetUrl, 
  };

  // 2. Lógica de Seguridad para Destinatarios
  if (playerIds && playerIds.length > 0) {
    // Enviamos a usuarios específicos por su UID de Firebase
    data.include_external_user_ids = playerIds;
    data.channel_for_external_user_ids = "push"; // Forzar Push
  } else {
    // PROTECCIÓN: Evitar envío masivo por error
    console.warn("⚠️ [Alerta] Se intentó enviar sin destinatarios. Cancelando.");
    return; 
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // La palabra 'Basic ' es OBLIGATORIA
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    // 3. Resultado
    if (result.errors) {
        console.error("❌ [OneSignal Error]:", result.errors);
    } else if (result.recipients === 0) {
        console.warn("⚠️ [Aviso]: OneSignal recibió la orden, pero el usuario NO tiene dispositivos suscritos.");
    } else {
        console.log(`✅ [Éxito]: Notificación enviada. ID: ${result.id}`);
    }
    
  } catch (err) {
    console.error("❌ [Error de Red]:", err);
  }
};