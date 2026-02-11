import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientShell from "@/components/ClientShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "YNAB Clone - Gestión de Presupuesto Personal",
  description: "Aplicación de gestión de presupuesto personal inspirada en YNAB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className} suppressHydrationWarning>
        <a href="#main-content" className="skip-to-content">
          Ir al contenido principal
        </a>
        <ClientShell>
          {children}
        </ClientShell>
      </body>
    </html>
  );
}

