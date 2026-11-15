import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Mis facturas de electricidad', description: 'Gestión privada de facturas eléctricas' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="es"><body>{children}</body></html>; }
