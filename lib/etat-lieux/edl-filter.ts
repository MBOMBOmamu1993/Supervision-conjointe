/**
 * Filtrage côté client des données « État de lieux » (data/edl-data.ts) selon
 * la sélection géographique Province / Antenne / ZS / Aire de la barre de
 * filtres. Recalcule les agrégats (structure, population totale) sur le
 * sous-ensemble retenu pour que tous les onglets « État de lieux » réagissent
 * aux filtres, comme le reste du tableau de bord.
 */
import { EDL, type EdlData } from "@/data/edl-data";
import { canonAntenne, eqGeo, norm, type GeoTuple } from "@/lib/geo";

export interface EdlSelection {
  province?: string | null;
  antenne?: string | null;
  zone?: string | null;
  aire?: string | null;
}

/** Tuples géographiques complets de la province (1 par aire de santé). */
export function edlGeoTuples(): GeoTuple[] {
  return EDL.asPop.map((a) => ({
    province: EDL.province,
    antenne: canonAntenne(a.antenne),
    zone: a.zs,
    aire: a.as,
  }));
}

/** Carte ZS (normalisée) → antenne, pour rattacher infoZS/cold/partners. */
function zsAntenneMap(): Map<string, string> {
  const m = new Map<string, string>();
  for (const z of EDL.zsPop) m.set(norm(z.zs), canonAntenne(z.antenne) ?? "");
  return m;
}

/** Antenne d'une ZS, avec repli sur une correspondance approximative (4 lettres). */
function antenneOfZs(zs: string, map: Map<string, string>): string | null {
  const k = norm(zs);
  if (map.has(k)) return map.get(k) || null;
  const pre = k.slice(0, 4);
  for (const [key, val] of map) {
    if (key.startsWith(pre) || pre.startsWith(key.slice(0, 4))) return val || null;
  }
  return null;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Renvoie une vue de EDL filtrée par la sélection géographique. */
export function filterEdl(f: EdlSelection): EdlData {
  const hasGeo = !!(f.antenne || f.zone || f.aire || f.province);
  // La base ne couvre que la Tshuapa : une autre province → aucune donnée.
  if (f.province && !eqGeo(f.province, EDL.province)) return emptyEdl();
  if (!hasGeo) return EDL;

  const map = zsAntenneMap();
  const keepZsByName = (zs: string) => {
    if (f.zone && !eqGeo(zs, f.zone)) return false;
    if (f.antenne) {
      const a = antenneOfZs(zs, map);
      if (a && !eqGeo(a, f.antenne)) return false;
    }
    return true;
  };

  const zsPop = EDL.zsPop.filter(
    (z) => (!f.antenne || eqGeo(canonAntenne(z.antenne), f.antenne)) && (!f.zone || eqGeo(z.zs, f.zone))
  );
  const asPop = EDL.asPop.filter(
    (a) =>
      (!f.antenne || eqGeo(canonAntenne(a.antenne), f.antenne)) &&
      (!f.zone || eqGeo(a.zs, f.zone)) &&
      (!f.aire || eqGeo(a.as, f.aire))
  );
  const infoZS = EDL.infoZS.filter((z) => keepZsByName(z.zs));
  const cold = EDL.cold.filter((z) => keepZsByName(z.zs));
  const coldAS = EDL.coldAS.filter((z) => keepZsByName(z.zs));
  const partners = EDL.partners.filter((p) => keepZsByName(p.zs));

  const structure = {
    antennes: new Set(asPop.map((a) => norm(canonAntenne(a.antenne) ?? ""))).size || EDL.structure.antennes,
    zs: new Set(asPop.map((a) => norm(a.zs))).size,
    as: asPop.length,
    essTotal: sum(asPop.map((a) => a.ess || 0)),
    essVac: sum(asPop.map((a) => a.essVac || 0)),
  };
  const popTotals = {
    snis: sum(asPop.map((a) => a.popSnis || 0)),
    ajuste: sum(asPop.map((a) => a.popAj || 0)),
    enf0_11_micro: sum(asPop.map((a) => a.cMicro || 0)),
    enf0_11_dhis2: sum(zsPop.map((z) => z.cDhis2 || 0)),
    enf0_11_ajuste: sum(asPop.map((a) => a.cAj || 0)),
  };

  return { ...EDL, structure, popTotals, zsPop, asPop, infoZS, cold, coldAS, partners };
}

function emptyEdl(): EdlData {
  return {
    ...EDL,
    structure: { antennes: 0, zs: 0, as: 0, essTotal: 0, essVac: 0 },
    popTotals: { snis: 0, ajuste: 0, enf0_11_micro: 0, enf0_11_dhis2: 0, enf0_11_ajuste: 0 },
    zsPop: [],
    asPop: [],
    infoZS: [],
    cold: [],
    coldAS: [],
    partners: [],
  };
}
