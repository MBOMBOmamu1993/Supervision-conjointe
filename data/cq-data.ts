// Contrôle qualité des données — données RÉELLES extraites des exports KOBO.
// À ce stade KOBO ne contient qu'une soumission par formulaire (Jan-Fév-Mars 2026).
// Source : Nouveau_Control_qualité_PEV_ZS / _CS (assets ajhW… et aaQZ…).
// Généré depuis handoff_v2/data/cq-data.js.

export interface AntigeneVals { p1: number; p3: number; rr1: number; rr2: number; }

export interface CqCsRow {
  zs: string;
  as: string;
  ess: string;
  mois: string[];
  registre: AntigeneVals;
  pointage: AntigeneVals;
  snis: AntigeneVals;
  dhis2: AntigeneVals;
  concPenta3: number;
  classPenta3: string;
  concRR2: number;
  classRR2: string;
  errSnisDhis2: number;
  errPointageRegistre: number;
  registreOk: "Oui" | "Non";
  pointageOk: "Oui" | "Non";
  snisOk: "Oui" | "Non";
  enfRecup: number;
  enfIdentifies: number;
  enfRetrouves: number;
  enfRecuperes: number;
}

export interface CqZsRow {
  zs: string;
  superviseur: string;
  mois: string[];
  airesVerifiees: string[];
  snis: AntigeneVals;
  dhis2: AntigeneVals;
  concPenta3: number;
  classPenta3: string;
  concRR2: number;
  classRR2: string;
  errSnisDhis2: number;
  nbValVerif: number;
  nbDiscord: number;
  scoreSaisieDhis2: number;
}

export interface CqData {
  moisDisponibles: string[];
  cs: { nbAttendus: number; nbControles: number; rows: CqCsRow[] };
  zs: { nbAttendus: number; nbControles: number; rows: CqZsRow[] };
}

export const CQ: CqData = {
  moisDisponibles: ["Janvier 2026", "Février 2026", "Mars 2026"],
  cs: {
    nbAttendus: 279,
    nbControles: 1,
    rows: [
      {
        zs: "Bokungu", as: "Lofima 2", ess: "Lofima 2 Centre de Santé", mois: ["Janvier", "Février", "Mars"],
        registre: { p1: 107, p3: 92, rr1: 94, rr2: 0 }, pointage: { p1: 0, p3: 0, rr1: 0, rr2: 0 },
        snis: { p1: 93, p3: 105, rr1: 91, rr2: 89 }, dhis2: { p1: 95, p3: 105, rr1: 91, rr2: 89 },
        concPenta3: 114.1, classPenta3: "Sur-rapportage", concRR2: 100.0, classRR2: "Pas de discordance",
        errSnisDhis2: 8.3, errPointageRegistre: 75.0,
        registreOk: "Non", pointageOk: "Non", snisOk: "Oui",
        enfRecup: 29, enfIdentifies: 29, enfRetrouves: 23, enfRecuperes: 21,
      },
    ],
  },
  zs: {
    nbAttendus: 12,
    nbControles: 1,
    rows: [
      {
        zs: "Bokungu", superviseur: "MUPELA SERGE", mois: ["Janvier", "Février", "Mars"],
        airesVerifiees: ["Bonkone", "Buluku", "Ikengolaka 2"],
        snis: { p1: 212, p3: 185, rr1: 176, rr2: 188 }, dhis2: { p1: 180, p3: 166, rr1: 170, rr2: 160 },
        concPenta3: 89.7, classPenta3: "Sous-rapportage", concRR2: 85.1, classRR2: "Sous-rapportage",
        errSnisDhis2: 55.6, nbValVerif: 36, nbDiscord: 20, scoreSaisieDhis2: 60,
      },
    ],
  },
};
