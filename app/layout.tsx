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
        <ClientShell>
          {children}
        </ClientShell>
      </body>
    </html>
  );
}

