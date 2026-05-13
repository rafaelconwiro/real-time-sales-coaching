import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Real-Time Sales Coaching",
  description: "Copiloto comercial silencioso para llamadas B2B consultivas.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background text-slate-100">{children}</body>
    </html>
  );
}
