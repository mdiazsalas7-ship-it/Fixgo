// src/components/WazeButton.js
'use client';
import { Navigation } from 'lucide-react'; // Ícono de navegación

export default function WazeButton({ lat, lng }) {
  
  const handleNavigate = () => {
    // 1. Validamos que existan coordenadas
    if (!lat || !lng) {
      alert("No hay ubicación GPS disponible para este cliente.");
      return;
    }

    // 2. Construimos la URL Mágica de Waze
    // "ll" significa Latitud,Longitud
    // "navigate=yes" inicia la ruta automáticamente
    const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

    // 3. Abrimos el enlace
    // En móviles, esto intentará abrir la App de Waze.
    // Si no la tiene, abrirá la web de Waze.
    window.open(wazeUrl, '_blank');
  };

  return (
    <button 
      onClick={handleNavigate}
      className="flex items-center justify-center gap-2 w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all active:scale-95"
    >
      <Navigation size={20} />
      <span>Ir con Waze</span>
    </button>
  );
}