// app/layout.js
import './globals.css';
import { Inter } from 'next/font/google';
import OneSignalInit from '../components/OneSignalInit'; // 👈 Ruta ajustada

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'FixGo App',
  description: 'Servicios residenciales rápidos',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <OneSignalInit /> 
        {children}
      </body>
    </html>
  );
}