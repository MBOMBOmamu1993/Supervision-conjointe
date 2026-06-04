"use client";

/* =========================================================================
   Dashboard.tsx — Shell de navigation (porté de `apercu_navigation.html`).
   Séquence : chargement → ruban de bienvenue → accueil (6 onglets) → vue module
   (barre latérale + en-tête + filtres dynamiques + page). Charte, couleurs et
   logos strictement conservés. La navigation se fait par la barre latérale.
   ========================================================================= */
import { useEffect, useMemo, useState } from "react";
import { DIcon, DTONES } from "./icons";
import { MODULES, LVL_FILTERS, LVL_LABEL, moduleByKey, pagesOf, findPage, type ModuleDef, type PageDef } from "./modules";
import { FilterBarShell } from "./FilterBarShell";
import { PAGE_REGISTRY } from "./registry";

const OMS = "/logo/oms-white.png";
const PEV = "/logo/pev-transparent.png";

function GradBox({ icon, tone, size = 40, radius = 11 }: { icon: string; tone: string; size?: number; radius?: number }) {
  const [a, b] = DTONES[tone] ?? DTONES.navy;
  return (
    <span className="flex shrink-0 items-center justify-center text-white" style={{ width: size, height: size, borderRadius: radius, background: `linear-gradient(145deg, ${a}, ${b})`, boxShadow: "0 6px 14px -7px rgba(0,0,0,.5)" }}>
      <DIcon name={icon} style={{ width: size * 0.52, height: size * 0.52 }} />
    </span>
  );
}

type Phase = "loading" | "welcome" | "home" | "module";

export default function Dashboard() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [modKey, setModKey] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [fade, setFade] = useState(false);

  // Restauration depuis l'URL (cohérence App Router) + écran de chargement.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const m = sp.get("mod"); const p = sp.get("page");
    const mod = m ? moduleByKey(m) : null;
    if (mod && mod.live) {
      const page = (p && findPage(mod, p)) || pagesOf(mod)[0];
      setModKey(mod.key); setPageId(page.id); setPhase("module");
      return;
    }
    const t = setTimeout(() => { setFade(true); setTimeout(() => setPhase("welcome"), 480); }, 2000);
    return () => clearTimeout(t);
  }, []);

  // Persistance de l'onglet / page courants dans l'URL.
  useEffect(() => {
    if (phase !== "module" || !modKey || !pageId) return;
    const url = `${window.location.pathname}?mod=${modKey}&page=${pageId}`;
    window.history.replaceState(null, "", url);
  }, [phase, modKey, pageId]);

  const mod = modKey ? moduleByKey(modKey) : null;
  const page = mod && pageId ? findPage(mod, pageId) : null;

  function openModule(key: string) {
    const m = moduleByKey(key);
    if (!m || !m.live) return;
    setModKey(key); setPageId(pagesOf(m)[0].id); setPhase("module");
  }
  function goHome() { setPhase("home"); window.history.replaceState(null, "", window.location.pathname); }

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-surface-100 text-surface-900">
      {phase === "loading" && <Loading fade={fade} />}
      {phase === "welcome" && <Welcome onStart={() => setPhase("home")} />}
      {phase === "home" && <Home onOpen={openModule} />}
      {phase === "module" && mod && page && (
        <ModuleView mod={mod} page={page} onSelectPage={setPageId} onHome={goHome} />
      )}
    </div>
  );
}

/* ----------------------------- Phase 1 — Chargement ----------------------------- */
function Loading({ fade }: { fade: boolean }) {
  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-6 transition-opacity duration-500" style={{ background: "#001a45", opacity: fade ? 0 : 1 }}>
      <div className="flex items-center gap-7 opacity-90">
        <img src={PEV} alt="PEV" className="h-[78px] w-auto" />
        <img src={OMS} alt="OMS" className="h-[78px] w-auto" />
      </div>
      <div className="flex flex-col items-center gap-3.5 text-center">
        <div className="text-[30px] font-extrabold text-white">Chargement du Tableau de bord</div>
        <div className="grid grid-cols-3 gap-[7px]">
          {Array.from({ length: 9 }).map((_, i) => (
            <i key={i} className="block h-[11px] w-[11px] rounded-full bg-white" style={{ animation: "rcmpulse 1.1s infinite ease-in-out", animationDelay: `${(((i % 3) + Math.floor(i / 3)) * 0.12).toFixed(2)}s` }} />
          ))}
        </div>
        <div className="text-[15px] text-white/65">Préparation du tableau de bord Tshuapa…</div>
      </div>
      <style>{`@keyframes rcmpulse{0%,80%,100%{opacity:.2;transform:scale(.7)}40%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

/* ----------------------------- Phase 2 — Bienvenue ----------------------------- */
function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto px-4 py-9" style={{ background: "rgba(0,19,47,.55)", backdropFilter: "blur(3px)" }}>
      <div className="w-full max-w-[940px] overflow-hidden rounded-[18px] border border-surface-200 bg-white shadow-[0_40px_90px_-30px_rgba(0,19,47,.7)]">
        <div className="flex items-center gap-4 px-8 py-6 text-white" style={{ background: "linear-gradient(120deg,#00205c,#0a3a86)", borderBottom: "5px solid #f5c518" }}>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px]" style={{ background: "rgba(255,255,255,.14)" }}>
            <DIcon name="chart" style={{ width: 30, height: 30 }} strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-[30px] font-extrabold leading-none">Tableau de bord Tshuapa</h1>
            <p className="mt-1 text-[16px] font-medium text-[#bcd6f5]">Supervision conjointe, Qualité des données & Monitorage rapide de convenance — PEV / OMS</p>
          </div>
        </div>
        <div className="px-8 pb-8 pt-6">
          <div className="rounded-xl px-5 py-4 text-[15.5px] leading-relaxed text-surface-800" style={{ background: "#eaf4fd", borderLeft: "5px solid #0093d5" }}>
            <b className="text-navy-700">Plateforme intégrée unique</b> regroupant les modules de supervision conjointe, de contrôle qualité des données et de monitorage rapide de convenance pour le suivi-évaluation du Programme Élargi de Vaccination dans la province de la <b className="text-navy-700">Tshuapa</b>.
          </div>
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <h3 className="mb-2.5 flex items-center gap-2 text-[15px] font-extrabold text-navy-700"><DIcon name="quality" style={{ width: 18, height: 18 }} /> Sources de Données</h3>
              <div className="rounded-xl border border-surface-200 bg-[#f6f8fb] px-4 py-3.5 text-[13.5px] leading-snug text-surface-700 space-y-2.5">
                <div><b>Supervision conjointe :</b> formulaires KoboToolbox Antenne, ZS et Aire de santé</div>
                <div><b>Qualité des données :</b> contrôle qualité CS & ZS (Pointage · Registre · SNIS · DHIS2)</div>
                <div><b>Monitorage rapide de convenance :</b> formulaire RCM KoboToolbox</div>
              </div>
            </div>
            <div>
              <h3 className="mb-2.5 flex items-center gap-2 text-[15px] font-extrabold text-navy-700"><DIcon name="erreurs" style={{ width: 18, height: 18 }} /> Avertissement</h3>
              <div className="rounded-xl border border-[#fbd88a] bg-[#fff8eb] px-4 py-3.5 text-[13.5px] leading-snug text-surface-700 space-y-2.5">
                <div>Les données présentées sont <b>sujettes à validation</b> et peuvent faire l'objet de modifications rétroactives.</div>
                <div>L'interprétation doit tenir compte du <b>contexte local</b> et de la <b>complétude</b> des rapportages.</div>
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-surface-200 bg-[#f6f8fb] px-5 py-4 text-[13.5px] leading-relaxed text-surface-700">
            Plateforme conçue et développée par le <b className="text-navy-700">Programme Élargi de Vaccination (PEV)</b> avec le soutien technique de l'<b className="text-navy-700">Organisation Mondiale de la Santé (OMS)</b>.<br />
            <span className="text-surface-400">Dernière mise à jour : Juin 2026</span>
          </div>
          <button onClick={onStart} className="mx-auto mt-6 flex items-center gap-2.5 rounded-[13px] px-10 py-3.5 text-[17px] font-extrabold uppercase text-white transition hover:-translate-y-0.5"
            style={{ background: "linear-gradient(120deg,#00205c,#15479e)", boxShadow: "0 14px 30px -12px rgba(0,32,92,.7)" }}>
            <DIcon name="gauge" style={{ width: 20, height: 20 }} strokeWidth={2} /> Commencer l'exploration
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Phase 3 — Accueil ----------------------------- */
function Home({ onOpen }: { onOpen: (key: string) => void }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="sticky top-0 z-30 flex h-24 shrink-0 items-center gap-5 px-8 text-white" style={{ background: "#00205c", borderBottom: "3px solid #0093d5" }}>
        <img src={OMS} alt="OMS" className="h-12 w-auto" />
        <div className="flex-1 text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">Programme Élargi de Vaccination · OMS — République Démocratique du Congo</div>
          <h1 className="mt-0.5 text-[23px] font-extrabold">Plateforme — Tableau de bord Tshuapa</h1>
        </div>
        <img src={PEV} alt="PEV" className="h-[58px] w-auto" />
      </div>
      <div className="mx-auto w-full max-w-[1240px] px-8 py-10">
        <div className="rounded-2xl border border-surface-200 bg-white px-10 py-9 text-center shadow-[0_10px_30px_-18px_rgba(15,23,42,.25)]" style={{ borderTop: "5px solid #f5c518" }}>
          <h2 className="text-[34px] font-extrabold text-navy-700">Bienvenue sur le Tableau de bord Tshuapa</h2>
          <p className="mx-auto mt-3 max-w-[760px] text-[16.5px] leading-relaxed text-surface-700">Votre outil centralisé de suivi de la supervision conjointe, de la qualité des données et du monitorage rapide de convenance du PEV dans la province de la Tshuapa. Sélectionnez un module pour commencer l'exploration.</p>
        </div>
        <div className="my-9 flex items-center gap-3"><span className="h-px flex-1 bg-[#d7dfea]" /><span className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-surface-500">Modules disponibles</span><span className="h-px flex-1 bg-[#d7dfea]" /></div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <button key={m.key} type="button" disabled={!m.live} onClick={() => onOpen(m.key)}
              className="relative flex min-h-[228px] flex-col items-center rounded-2xl border-2 bg-white px-6 pb-6 pt-7 text-center transition disabled:cursor-not-allowed"
              style={{ borderColor: "#dbe3ef", borderStyle: m.live ? "solid" : "dashed", opacity: m.live ? 1 : 0.62, transform: "none" }}
              onMouseEnter={(e) => { if (m.live) { e.currentTarget.style.transform = "translateY(-5px)"; e.currentTarget.style.boxShadow = "0 22px 44px -20px rgba(15,23,42,.4)"; e.currentTarget.style.borderColor = "#0093d5"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#dbe3ef"; }}>
              {!m.live && <span className="absolute right-3.5 top-3.5 rounded-full border border-[#fbd88a] bg-[#fef3c7] px-2.5 py-[3px] text-[10px] font-extrabold uppercase text-[#b45309]">Bientôt</span>}
              <GradBox icon={m.icon} tone={m.tone} size={74} radius={18} />
              <h3 className="mt-4 text-[19px] font-extrabold leading-tight">{m.name}</h3>
              <p className="mt-2 text-[13.5px] leading-snug text-surface-500">{m.desc}</p>
              {m.live && <span className="mt-3.5 inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase text-[#0078ae]">Ouvrir <DIcon name="route" style={{ width: 14, height: 14, display: "none" }} /><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg></span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Phase 4 — Vue module ----------------------------- */
function ModuleView({ mod, page, onSelectPage, onHome }: { mod: ModuleDef; page: PageDef; onSelectPage: (id: string) => void; onHome: () => void }) {
  const allow = LVL_FILTERS[page.lvl];
  const Comp = PAGE_REGISTRY[page.id];
  const [a, b] = DTONES[mod.tone] ?? DTONES.navy;

  const navLink = (p: PageDef) => (
    <button key={p.id} type="button" onClick={() => onSelectPage(p.id)}
      className="my-0.5 flex w-full items-center gap-2.5 rounded-[9px] border-l-[3px] px-3 py-2.5 text-left text-[13px] font-semibold transition"
      style={page.id === p.id ? { background: "rgba(255,255,255,.14)", color: "#fff", borderLeftColor: "#0093d5", fontWeight: 800 } : { background: "transparent", color: "rgba(255,255,255,.72)", borderLeftColor: "transparent" }}>
      <span className="inline-flex h-[17px] w-[17px] shrink-0"><DIcon name={p.icon} style={{ width: 17, height: 17 }} strokeWidth={2} /></span>{p.label}
    </button>
  );

  const filterLabels: Record<string, string> = { province: "Province", antenne: "Antenne", zs: "ZS", as: "Aire de santé", type: "Type de supervision", periode: "Période" };

  return (
    <div className="flex h-full">
      {/* Barre latérale */}
      <aside className="flex w-[262px] shrink-0 flex-col text-white" style={{ background: "#001a45" }}>
        <div className="border-b border-white/10 px-[18px] pb-4 pt-[18px]">
          <button type="button" onClick={onHome} className="mb-3.5 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-2.5 py-1.5 text-[11.5px] font-bold text-white/70 transition hover:bg-white/[0.16] hover:text-white">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg> Accueil
          </button>
          <div className="flex items-center gap-2.5">
            <GradBox icon={mod.icon} tone={mod.tone} size={40} />
            <div><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">Onglet</div><div className="text-[16px] font-extrabold leading-tight">{mod.name}</div></div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3 thin-scroll">
          {mod.groups
            ? mod.groups.map((g) => (
              <div key={g.name}>
                <div className="px-3 pb-1.5 pt-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/40">{g.name}</div>
                {g.pages.map(navLink)}
              </div>
            ))
            : (mod.pages ?? []).map(navLink)}
        </nav>
        <div className="flex items-center gap-2 border-t border-white/10 px-[18px] py-3 text-[10.5px] text-white/40">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /></svg> Synchronisation KoboToolbox
        </div>
      </aside>

      {/* Zone principale */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 shrink-0 items-center gap-4 px-6 text-white" style={{ background: "#00205c", borderBottom: "3px solid #0093d5" }}>
          <img src={OMS} alt="OMS" className="h-[38px] w-auto" />
          <div className="min-w-0 flex-1 text-center">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-white/60">Tableau de bord Tshuapa · PEV / OMS</div>
            <h1 className="mt-px truncate text-[16px] font-extrabold uppercase">{page.label} — {mod.name}</h1>
          </div>
          <img src={PEV} alt="PEV" className="h-[46px] w-auto" />
        </div>
        {allow.length > 0 && <FilterBarShell allow={allow} />}
        <div className="flex-1 overflow-y-auto px-5 py-5" style={{ background: "#eef2f7" }}>
          <div className="mx-auto max-w-[1200px]">
            {Comp ? <Comp /> : <div className="py-16 text-center text-surface-500">Page à concevoir.</div>}
            {allow.length > 0 && (
              <div className="mt-4 text-center text-[11.5px] text-surface-500">
                Filtres actifs : <b className="text-navy-700">{LVL_LABEL[page.lvl]}</b> — {allow.map((f) => filterLabels[f]).join(" · ")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
