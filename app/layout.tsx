import "./globals.css";
import type { Metadata } from "next";
import { Sidebar } from "@/components/shell/Sidebar";
import Header from "@/components/shell/Header";
import { FilterBar } from "@/components/shell/FilterBar";

export const metadata: Metadata = {
  title: "Supervision conjointe PEV / OMS — RDC",
  description: "Dashboard de supervision conjointe PEV-Central/OMS, synchronisé en temps réel avec KoboToolbox.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            {/* En-tête FIXE — hors de la zone de défilement */}
            <Header />
            {/* Barre de filtres FIXE — ne défile jamais (bug : « figer la barre ») */}
            <FilterBar />
            {/* Seul <main> défile */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden bg-surface-50">
              <div className="p-3 md:p-5">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
