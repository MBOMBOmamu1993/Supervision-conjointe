/* Contrôle qualité des données — données RÉELLES extraites des exports KOBO.
   À ce stade KOBO ne contient qu'une soumission par formulaire (Jan-Fév-Mars 2026).
   Source: Nouveau_Control_qualité_PEV_ZS / _CS  (assets ajhW… et aaQZ…). */
window.CQ = {
  moisDisponibles: ["Janvier 2026", "Février 2026", "Mars 2026"],
  // ---------------- Niveau Centre de santé (AS) ----------------
  cs: {
    nbAttendus: 279,            // total AS de la province
    nbControles: 1,             // CS ayant bénéficié du contrôle qualité
    rows: [
      { zs:"Bokungu", as:"Lofima 2", ess:"Lofima 2 Centre de Santé", mois:["Janvier","Février","Mars"],
        registre:{p1:107,p3:92,rr1:94,rr2:0}, pointage:{p1:0,p3:0,rr1:0,rr2:0},
        snis:{p1:93,p3:105,rr1:91,rr2:89}, dhis2:{p1:95,p3:105,rr1:91,rr2:89},
        concPenta3:114.1, classPenta3:"Sur-rapportage", concRR2:100.0, classRR2:"Pas de discordance",
        errSnisDhis2:8.3, errPointageRegistre:75.0,
        registreOk:"Non", pointageOk:"Non", snisOk:"Oui",
        enfRecup:29, enfIdentifies:29, enfRetrouves:23, enfRecuperes:21 },
    ],
  },
  // ---------------- Niveau Zone de santé ----------------
  zs: {
    nbAttendus: 12,
    nbControles: 1,
    rows: [
      { zs:"Bokungu", superviseur:"MUPELA SERGE", mois:["Janvier","Février","Mars"],
        airesVerifiees:["Bonkone","Buluku","Ikengolaka 2"],
        snis:{p1:212,p3:185,rr1:176,rr2:188}, dhis2:{p1:180,p3:166,rr1:170,rr2:160},
        concPenta3:89.7, classPenta3:"Sous-rapportage", concRR2:85.1, classRR2:"Sous-rapportage",
        errSnisDhis2:55.6, nbValVerif:36, nbDiscord:20, scoreSaisieDhis2:60 },
    ],
  },
};
