// utils/notifications.js
export const sendNotification = async (message, playerIds = []) => {
    const ONESIGNAL_APP_ID = "9d81caa9-afe0-41d0-8790-e1f0f41a9a15";
    const ONESIGNAL_REST_API_KEY = "os_v2_app_twa4vknp4ba5bb4q4hypigu2cwqu3iboxbtuk35w6gjsnsqcbjp3uchmabskjoucpcr6njifftcavzyc7prrtsjwmr7mtz3rqiegd5a";
  
    const data = {
      app_id: ONESIGNAL_APP_ID,
      contents: { "es": message, "en": message },
      headings: { "es": "FixGo", "en": "FixGo" }
    };
  
    if (playerIds.length > 0) {
      // Enviar a usuarios específicos (por su ID de Firebase)
      data.include_external_user_ids = playerIds; 
    } else {
      // Enviar a todos (para que los técnicos vean órdenes nuevas)
      data.included_segments = ["All"]; 
    }
  
    try {
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
        },
        body: JSON.stringify(data)
      });
      console.log("🔔 Notificación enviada");
    } catch (err) {
      console.error("Error enviando notificación", err);
    }
  };