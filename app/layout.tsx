import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

import Providers from "@/components/Providers";

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
        <Providers>
          <div className="flex min-h-screen bg-background text-foreground overflow-hidden font-sans">
            <Sidebar />

            <main className="flex-1 lg:pl-[272px] min-h-screen flex flex-col">
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
