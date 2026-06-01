"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/client/cn";
import { Icon, type IconName } from "@/components/ui/Icon";

interface SubTab {
  href: string;
  label: string;
}
interface MainTab {
  key: string;
  label: string;
  icon: IconName;
  href?: string;
  subs?: SubTab[];
}

const NAV: MainTab[] = [
  {
    key: "supervision",
    label: "Supervision conjointe PEV OMS RDC",
    icon: "hands",
    subs: [
      { href: "/", label: "Vue d'ensemble" },
      { href: "/comparaison", label: "Performance structures et temps" },
      { href: "/composantes", label: "Performance par composantes" },
    ],
  },
  { key: "qualite", label: "Qualité des données", icon: "database", href: "/qualite-donnees" },
  { key: "etat", label: "État de lieux Tshuapa", icon: "map", href: "/etat-lieux" },
  { key: "rapport", label: "Télécharger Rapport", icon: "download", href: "/telecharger-rapport" },
];

export function Sidebar() {
  const pathname = usePathname();
  const activeMain =
    NAV.find((t) => t.subs?.some((s) => s.href === pathname)) ??
    NAV.find((t) => t.href === pathname) ??
    NAV[0];
  const [openKey, setOpenKey] = useState<string>(activeMain.key);

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col bg-navy-800 text-white lg:flex">
      <div className="border-b border-white/10 px-5 pt-5 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">Tableau de bord</p>
        <p className="mt-0.5 text-[20px] font-extrabold leading-tight">Tshuapa</p>
        <p className="mt-0.5 text-[11.5px] font-semibold leading-tight text-oms-300">République Démocratique du Congo</p>
        <p className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] text-white/55">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-good-500" /> Programme Élargi de Vaccination
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 thin-scroll">
        {NAV.map((tab) => {
          const isActive = tab.key === activeMain.key;
          const expanded = openKey === tab.key && !!tab.subs;
          if (tab.subs) {
            return (
              <div key={tab.key} className="mb-1">
                <button
                  type="button"
                  onMouseEnter={() => setOpenKey(tab.key)}
                  onClick={() => setOpenKey((k) => (k === tab.key ? "" : tab.key))}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
                    isActive ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10"
                  )}
                >
                  <Icon name={tab.icon} className="h-5 w-5 shrink-0" />
                  <span className="flex-1 leading-tight">{tab.label}</span>
                  <Icon name="chevron-down" className={cn("h-4 w-4 transition", expanded && "rotate-180")} />
                </button>
                {expanded && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-white/15 pl-3">
                    {tab.subs.map((s) => (
                      <Link
                        key={s.href}
                        href={s.href}
                        className={cn(
                          "block rounded-lg border-l-[3px] px-3 py-1.5 text-[13px] transition",
                          pathname === s.href
                            ? "border-oms-500 bg-white/[0.14] font-semibold text-white"
                            : "border-transparent text-white/70 hover:bg-white/10"
                        )}
                      >
                        {s.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <Link
              key={tab.key}
              href={tab.href ?? "#"}
              onMouseEnter={() => setOpenKey(tab.key)}
              className={cn(
                "mb-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                pathname === tab.href ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10"
              )}
            >
              <Icon name={tab.icon} className="h-5 w-5 shrink-0" />
              <span className="leading-tight">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Données KoboToolbox</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-white/40">
          <Icon name="refresh" className="h-3.5 w-3.5" />
          Synchronisation temps réel
        </div>
      </div>
    </aside>
  );
}
