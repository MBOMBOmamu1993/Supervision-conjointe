"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { triggerRefresh, useSupervision } from "@/lib/client/api";
import { fmtDateTime } from "@/lib/client/format";

const TITLES: Record<string, string> = {
  "/": "Vue d'ensemble — Supervision conjointe",
  "/comparaison": "Comparaison : performance par structure & temps",
  "/composantes": "Performance par composante",
  "/analyse": "Analyse & données détaillées",
  "/rapports": "Rapports & exports",
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
    <header className="h-16 shrink-0 px-3 md:px-5 flex items-center gap-3 bg-navy-600 text-white border-b border-white/10">
      {/* Logo OMS — à GAUCHE */}
      <div className="bg-white rounded-md p-1.5 shrink-0 h-11 w-[88px] relative flex items-center justify-center">
        <Image src="/logo/oms.png" alt="OMS" fill sizes="88px" style={{ objectFit: "contain" }} className="p-1" priority />
      </div>

      {/* Titre central */}
      <div className="flex-1 min-w-0 text-center px-2">
        <div className="text-[9px] md:text-[10px] uppercase tracking-[0.18em] text-white/70 font-medium truncate">
          Programme Élargi de Vaccination · OMS — RDC
        </div>
        <h1 className="text-[13px] md:text-[16px] font-semibold leading-tight tracking-tight truncate uppercase">
          {title}
        </h1>
      </div>

      {/* Bloc actions + Logo PEV à DROITE */}
      <div className="hidden lg:flex items-center gap-3 text-[10px] text-right">
        <div className="leading-tight">
          <div className="uppercase tracking-wider text-white/60">Dernière synchro.</div>
          <div className="text-white font-medium tabular-nums">{fmtDateTime(data?.meta.generatedAt)}</div>
        </div>
        <button
          onClick={onRefresh}
          disabled={busy || isValidating}
          className="inline-flex items-center gap-1.5 px-2.5 h-8 text-[11px] rounded border border-white/25 bg-white/10 hover:bg-white/20 text-white font-medium transition disabled:opacity-60"
          title="Resynchroniser avec KoboToolbox"
        >
          <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" />
          </svg>
          {busy ? "Synchro…" : "Actualiser"}
        </button>
      </div>

      {/* Logo PEV — à DROITE */}
      <div className="bg-white rounded-md p-1.5 shrink-0 h-11 w-[72px] relative flex items-center justify-center">
        <Image src="/logo/pev.png" alt="PEV" fill sizes="72px" style={{ objectFit: "contain" }} className="p-1" priority />
      </div>
    </header>
  );
}
