"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/client/cn";

type IconName = "home" | "structure" | "time" | "component" | "analyse" | "report";

function NavIcon({ name }: { name: IconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<IconName, JSX.Element> = {
    home: (<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></>),
    structure: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>),
    time: (<><path d="M3 17l5-5 4 3 8-8" /><path d="M3 21h18" /></>),
    component: (<><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" /></>),
    analyse: (<><path d="M4 4v16h16" /><rect x="7" y="10" width="3" height="7" /><rect x="12" y="6" width="3" height="11" /><rect x="17" y="13" width="3" height="4" /></>),
    report: (<><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></>),
  };
  return <svg viewBox="0 0 24 24" className="w-[17px] h-[17px] shrink-0" {...common}>{paths[name]}</svg>;
}

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Vue d'ensemble", icon: "home" },
  { href: "/comparaison", label: "Performance structure & temps", icon: "time" },
  { href: "/composantes", label: "Performance par composante", icon: "component" },
  { href: "/analyse", label: "Analyse", icon: "analyse" },
  { href: "/rapports", label: "Rapports", icon: "report" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-navy-800 text-white">
      <div className="px-5 pt-5 pb-4 border-b border-white/10">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/55 font-semibold">Tableau de bord</div>
        <div className="font-extrabold text-[17px] leading-tight mt-0.5">Supervision conjointe</div>
        <div className="text-[12px] text-oms-300 font-semibold mt-0.5">PEV-Central · OMS — RDC</div>
        <div className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] text-white/55">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-good-500" /> République Démocratique du Congo
        </div>
      </div>
      <nav className="flex-1 py-2">
        {NAV.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-[12.5px] leading-5 transition border-l-[3px] font-semibold",
                active ? "bg-white/[0.13] text-white border-oms-500" : "text-white/70 border-transparent hover:bg-white/[0.07] hover:text-white"
              )}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-3.5 text-[10px] uppercase tracking-wider text-white/55 border-t border-white/10 font-semibold">
        <div>Données KoboToolbox</div>
        <div className="mt-0.5 normal-case tracking-normal text-white/40">Synchronisation temps réel</div>
      </div>
    </aside>
  );
}
