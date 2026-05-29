"use client";

import { useSupervision } from "@/lib/client/api";
import type { SupervisionBundle } from "@/lib/supervision/types";

export function DataGate({ children }: { children: (data: SupervisionBundle) => React.ReactNode }) {
  const { data, error, isLoading } = useSupervision();

  if (error) {
    return (
      <div className="card border-danger-200 bg-danger-50/40">
        <div className="text-[13px] font-semibold text-danger-700">Erreur de connexion aux données KoboToolbox</div>
        <p className="text-[12px] text-surface-700 mt-1">{error.message}</p>
        <p className="text-[11px] text-surface-700/70 mt-2">
          Vérifiez les variables d'environnement KOBO_TOKEN / KOBO_USERNAME / KOBO_PASSWORD sur Vercel, puis cliquez sur « Actualiser ».
        </p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-surface-700">
        <svg viewBox="0 0 24 24" className="w-6 h-6 animate-spin text-oms-500" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 12a9 9 0 1 1-6.2-8.5" strokeLinecap="round" />
        </svg>
        <span className="ml-3 text-[13px]">Synchronisation avec KoboToolbox…</span>
      </div>
    );
  }

  return <>{children(data)}</>;
}
