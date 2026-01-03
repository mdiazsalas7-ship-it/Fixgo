// app/layout.js
import './globals.css';
import { Inter } from 'next/font/google';
import OneSignalInit from '../components/OneSignalInit'; // 👈 Asegúrate de que este archivo exista en la carpeta components

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'FixGo App',
  description: 'Servicios residenciales rápidos',
  manifest: '/manifest.json', // (Opcional) Ayuda a que los celulares reconozcan la app
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {/* 👇 Componente Invisible que inicia OneSignal y pide permiso */}
        <OneSignalInit /> 
        
        {children}
      </body>
    </html>
  );
}