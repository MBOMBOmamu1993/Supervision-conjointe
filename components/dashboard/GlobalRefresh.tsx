"use client";

/* Bouton « Actualiser » UNIQUE du dashboard (en-tête de l'accueil et de tous
   les onglets) : purge le cache Kobo côté serveur, recharge les sources en
   frais (force=1), puis revalide toutes les clés SWR — tous les onglets sont
   ainsi resynchronisés d'un seul clic. */
import { useState } from "react";
import { useSWRConfig } from "swr";

const ENDPOINTS = ["/api/supervision", "/api/cqd", "/api/rcm", "/api/at", "/api/sav", "/api/triangulation", "/api/dhis2-prestation"];

export function GlobalRefreshButton() {
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);

  async function onRefresh() {
    if (busy) return;
    setBusy(true);
    try {
      // 1. Purge du cache Kobo serveur (supervision) — sans bloquer si absent.
      await fetch("/api/supervision/refresh", { method: "POST" }).catch(() => {});
      // 2. Resynchronisation fraîche de chaque module (force=1 contourne les
      //    caches serveur de chaque source Kobo).
      await Promise.allSettled(
        ENDPOINTS.map((e) => fetch(`${e}?force=1`, { cache: "no-store", headers: { Accept: "application/json" } }))
      );
      // 3. Revalidation de toutes les clés SWR en cache : chaque onglet ouvert
      //    (et ses filtres) se recharge avec les données fraîches.
      await mutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={busy}
      title="Resynchroniser tous les onglets avec KoboToolbox"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-[12px] font-bold text-white transition hover:bg-white/20 disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" className={busy ? "animate-spin" : ""} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" />
      </svg>
      {busy ? "Synchro…" : "Actualiser"}
    </button>
  );
}
