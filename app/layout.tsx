import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/shell/Sidebar";
import Header from "@/components/shell/Header";
import FilterBar from "@/components/shell/FilterBar";

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
            <div className="sticky top-0 z-40 shadow-sm">
              <Header />
            </div>
            <main className="flex-1 overflow-y-auto overflow-x-hidden bg-surface-50">
              <FilterBar />
              <div className="p-3 md:p-5">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
