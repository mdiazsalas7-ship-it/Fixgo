// utils/notifications.js
export const sendNotification = async (message, playerIds = []) => {
  const ONESIGNAL_APP_ID = "9d81caa9-afe0-41d0-8790-e1f0f41a9a15";
  // Pega aquí la llave completa que acabas de generar
  const ONESIGNAL_REST_API_KEY = "os_v2_app_twa4vknp4ba5bb4q4hypigu2cvrcvwjogs6evnfxky7cfybn2ccfduh6dkvhapra4sda3aafehlckbey47lzintbqx7bhnslgokhwby"; 

  const data = {
    app_id: ONESIGNAL_APP_ID,
    contents: { "es": message },
    headings: { "es": "FixGo" }
  };

  if (playerIds.length > 0) {
    // Para enviar a un técnico o cliente específico (usando su UID de Firebase)
    data.include_external_user_ids = playerIds; 
  } else {
    // Para enviar a todos los técnicos (ej: nueva orden disponible)
    data.included_segments = ["All"]; 
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    console.log("🔔 Notificación procesada:", result);
  } catch (err) {
    console.error("❌ Error en el envío:", err);
  }
};