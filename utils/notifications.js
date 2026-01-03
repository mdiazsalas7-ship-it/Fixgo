// utils/notifications.js
export const sendNotification = async (message, playerIds = []) => {
  // Ahora leemos las variables del archivo .env.local
  const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const ONESIGNAL_REST_API_KEY = process.env.NEXT_PUBLIC_ONESIGNAL_API_KEY;

  if (!ONESIGNAL_REST_API_KEY) {
    console.error("❌ Falta la API KEY en .env.local");
    return;
  }

  const data = {
    app_id: ONESIGNAL_APP_ID,
    contents: { "es": message },
    headings: { "es": "FixGo 🔧" }
  };

  if (playerIds.length > 0) {
    data.include_external_user_ids = playerIds; 
  } else {
    data.included_segments = ["All"]; 
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // Importante: Mantener la palabra Basic + espacio
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    console.log("🔔 Notificación enviada:", result);
  } catch (err) {
    console.error("❌ Error enviando notificación:", err);
  }
};