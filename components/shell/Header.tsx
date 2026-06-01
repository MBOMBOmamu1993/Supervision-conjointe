"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { triggerRefresh, useSupervision } from "@/lib/client/api";
import { fmtDateTime } from "@/lib/client/format";

const TITLES: Record<string, string> = {
  "/": "Vue d'ensemble — Supervision conjointe",
  "/comparaison": "Performance structures et temps",
  "/composantes": "Performance par composantes",
  "/qualite-donnees": "Qualité des données (Contrôle Qualité)",
  "/etat-lieux": "État de lieux — Tshuapa",
  "/telecharger-rapport": "Télécharger un rapport",
};

export default function Header() {
  const path = usePathname();
  const title = TITLES[path] ?? "Supervision conjointe PEV / OMS";
  const { data, refresh, isValidating } = useSupervision();
  const [busy, setBusy] = useState(false);

  async function onRefresh() {
    setBusy(true);
    try {
      await triggerRefresh();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="h-[68px] shrink-0 px-3 md:px-5 flex items-center gap-3 md:gap-4 bg-navy-700 text-white" style={{ borderBottom: "3px solid #0093d5" }}>
      {/* Logo OMS (blanc sur marine, via filtre CSS) — à GAUCHE */}
      <img src="/logo/oms.png" alt="Organisation mondiale de la Santé" className="h-[40px] md:h-[42px] w-auto shrink-0 [filter:brightness(0)_invert(1)]" />

      {/* Titre central */}
      <div className="flex-1 min-w-0 text-center px-2">
        <div className="hidden sm:block text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-white/65 font-semibold truncate">
          Programme Élargi de Vaccination · OMS — République Démocratique du Congo
        </div>
        <h1 className="text-[13px] md:text-[17px] font-extrabold leading-tight tracking-tight truncate uppercase">
          {title}
        </h1>
      </div>

      {/* Bloc actions */}
      <div className="hidden lg:flex items-center gap-3 text-[10px] text-right">
        <div className="leading-tight">
          <div className="uppercase tracking-wider text-white/55">Dernière synchro.</div>
          <div className="text-white font-semibold tabular-nums">{fmtDateTime(data?.meta.generatedAt)}</div>
        </div>
        <button
          onClick={onRefresh}
          disabled={busy || isValidating}
          className="inline-flex items-center gap-1.5 px-2.5 h-8 text-[11px] rounded-md border border-white/25 bg-white/10 hover:bg-white/20 text-white font-semibold transition disabled:opacity-60"
          title="Resynchroniser avec KoboToolbox"
        >
          <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" />
          </svg>
          {busy ? "Synchro…" : "Actualiser"}
        </button>
      </div>

      {/* Logo PEV (blanc) — à DROITE */}
      <img src="/logo/pev-transparent.png" alt="PEV — Programme Élargi de Vaccination" className="h-[50px] md:h-[54px] w-auto shrink-0" />
    </header>
  );
}
