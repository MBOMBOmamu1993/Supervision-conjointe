/* Génère data/sav/sav-seed.json à partir des exports Excel SAV (activité terminée).
   Joint les feuilles parent (géo + totaux) et enfant (par antigène × âge),
   normalise les antigènes (Pneumo→PCV, Rotasiil→ROTA, VAR/RR→RR). */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const U = process.env.SAV_SRC || "/root/.claude/uploads/1f950c19-3a30-59fa-9626-bd6c56a9e508/";
const F = {
  ident_cs: U + "26d673bb-SAV_Identification_EZD_et_ESV_Par_CS__all_versions__Fran_ais__20260606124841.xlsx",
  resultats: U + "84bdd786-SAV_R_sulats_Vaccination_Par_Equipe__all_versions__Fran_ais__20260604140733.xlsx",
  ident_relais: U + "acf29f8f-SAV_Indentification_Par__Relais__EZD_ESV__all_versions__Fran_ais__20260604140707.xlsx",
  planif: U + "74109f6a-SAV_Planification_session_de_vaccination__all_versions__Fran_ais__20260604140816.xlsx",
  supervision: U + "4b6a6602-SAV_Supervision_des_equipes__all_versions__labels__20260604140845.xlsx",
};

const ANTI = ["BCG","VPO1","VPO2","VPO3","PENTA1","PENTA2","PENTA3","PCV1","PCV2","PCV3","ROTA1","ROTA2","ROTA3","VPI1","VPI2","RR1","RR2","VAA","VAP1","VAP2","VAP3","VAP4"];

const num = (v) => { if (v==null||v==="") return 0; const n=Number(String(v).replace(",", ".").replace(/[^0-9.\-]/g,"")); return Number.isFinite(n)?n:0; };
const s = (v) => v==null?"":String(v).trim();
const yes = (v) => /^oui$/i.test(s(v));
const month = (v) => { const m=s(v).match(/(\d{4})-(\d{2})/); return m?m[1]+"-"+m[2]:null; };
const ageGroup = (m) => { const a=num(m); if(a<=0&&s(m)==="")return null; if(a<12)return "age_0_11"; if(a<24)return "age_12_23"; return "age_24_59"; };

function sheets(file){ const wb=XLSX.readFile(file); const o={}; for(const n of wb.SheetNames) o[n]=XLSX.utils.sheet_to_json(wb.Sheets[n],{defval:null,raw:false}); return {wb,o}; }
function pick(wb,o,pred){ const n=wb.SheetNames.find(pred); return n?o[n]:[]; }

/* ---- Identification CS / relais : parent (géo+totaux) + enfant (antigène×âge) ---- */
// child missed-flag column label per antigen
const CHILD_FLAG = {
  BCG:"BCG manqué ?", VPO1:"VPO 1 manqué ?", VPO2:"VPO 2 manqué ?", VPO3:"VPO 3 manqué ?",
  PENTA1:"Penta 1 manqué ?", PENTA2:"Penta 2 manqué ?", PENTA3:"Penta 3 manqué ?",
  PCV1:"Pneumo 1 manqué ?", PCV2:"Pneumo 2 manqué ?", PCV3:"Pneumo 3 manqué ?",
  ROTA1:"Rotasiil 1 manqué ?", ROTA2:"Rotasiil 2 manqué ?", ROTA3:"Rotasiil 3 manqué ?",
  VPI1:"VPI 1 manqué ?", VPI2:"VPI 2 manqué ?", RR1:"VAR/RR 1 manqué ?", RR2:"VAR/RR 2 manqué ?",
  VAA:"VAA manqué ?", VAP1:"VAP 1 manqué ?", VAP2:"VAP 2 manqué ?", VAP3:"VAP 3 manqué ?", VAP4:"VAP 4 manqué ?",
};

function buildIdent(file, isRelais){
  const {wb,o} = sheets(file);
  const child = o["enfants"] || pick(wb,o,(n)=>/enfant/i.test(n));
  const parent = o[wb.SheetNames.find((n)=>n!=="enfants" && o[n]!==child)] || o[wb.SheetNames[0]];
  // index parent by submission id
  const pById = new Map();
  const fiches = parent.map((r,i)=>{
    const id = s(r["_id"]) || s(r["_uuid"]) || ("p"+i);
    const fiche = {
      id, time: Date.parse(s(r["_submission_time"])||s(r["end"])||s(r["today"])) || 0,
      province: s(r["Province"])||null, antenne: s(r["Antenne PEV"])||null,
      zone: s(r["Zone de santé"])||null,
      aire: s(r["Aire de santé"])|| s(r["Précisez l’autre aire de santé"]) || null,
      cs: s(r["ESS / Centre de santé"]) || s(r["Nom du village"]) || null,
      identifies: num(r["total_enfants_identifies"]),
      month: month(r["Date d’identification"]) || month(r["Date de la visite"]) || month(r["_submission_time"]) || month(r["today"]),
    };
    pById.set(id, fiche);
    return fiche;
  });
  // children joined to parent geo
  const enfants = child.map((r)=>{
    const pid = s(r["_submission__id"]) || s(r["_submission__uuid"]);
    const f = pById.get(pid) || {};
    const missed = {};
    for (const ag of ANTI) missed[ag] = yes(r[CHILD_FLAG[ag]]);
    return {
      ficheId: pid,
      province: f.province??null, antenne: f.antenne??null, zone: f.zone??null, aire: f.aire??null, cs: f.cs??null,
month: f.month??null,
      ageGroup: ageGroup(r["Âge de l’enfant (en mois)"] ?? r["Âge de l’enfant en mois"]),
      identifie: num(r["enfant_identifie_calc"]) ? true : true,
      zeroDose: num(r["zero_dose_calc"]) ? true : yes(r[CHILD_FLAG.PENTA1]),
      sousVaccine: num(r["sous_vaccine_calc"]) ? true : (yes(r[CHILD_FLAG.PENTA3]) && !yes(r[CHILD_FLAG.PENTA1])),
      missed,
    };
  });
  return { fiches, enfants };
}

/* ---- Résultats : flat, vaccinés par antigène (+ par tranche d'âge) ---- */
const RES_LABEL = { BCG:"BCG",VPO1:"VPO 1",VPO2:"VPO 2",VPO3:"VPO 3",PENTA1:"Penta 1",PENTA2:"Penta 2",PENTA3:"Penta 3",
  PCV1:"Pneumo 1",PCV2:"Pneumo 2",PCV3:"Pneumo 3",ROTA1:"Rotasiil 1",ROTA2:"Rotasiil 2",ROTA3:"Rotasiil 3",
  VPI1:"VPI 1",VPI2:"VPI 2",RR1:"VAR/RR 1",RR2:"VAR/RR 2",VAA:"VAA",VAP1:"VAP 1",VAP2:"VAP 2",VAP3:"VAP 3",VAP4:"VAP 4" };
const RES_TOTAL={BCG:"total_bcg",VPO1:"total_vpo1",VPO2:"total_vpo2",VPO3:"total_vpo3",PENTA1:"total_penta1",PENTA2:"total_penta2",PENTA3:"total_penta3",PCV1:"total_pneumo1",PCV2:"total_pneumo2",PCV3:"total_pneumo3",ROTA1:"total_rotasiil1",ROTA2:"total_rotasiil2",ROTA3:"total_rotasiil3",VPI1:"total_vpi1",VPI2:"total_vpi2",RR1:"total_varrr1",RR2:"total_varrr2",VAA:"total_vaa",VAP1:"total_vap1",VAP2:"total_vap2",VAP3:"total_vap3",VAP4:"total_vap4"};
function buildResultats(file){
  const {wb,o}=sheets(file); const rows=pick(wb,o,(n)=>/sulat|vaccination/i.test(n)) ;
  return rows.map((r)=>{
    const byAntigene={}, byAntigeneAge={};
    for(const ag of ANTI){ const L=RES_LABEL[ag];
      byAntigene[ag]=num(r[RES_TOTAL[ag]]);
      byAntigeneAge[ag]={a0:num(r[L+" — 0 à 11 mois"]),a1:num(r[L+" — 12 à 23 mois"]),a2:num(r[L+" — 24 à 59 mois"])};
    }
    return {
      province:s(r["Province"])||null, antenne:s(r["Antenne PEV"])||null, zone:s(r["Zone de santé"])||null,
      aire:s(r["Aire de santé"])||s(r["Préciser l’autre aire de santé"])||null,
      site:s(r["Nom du site"])||null, type:s(r["Type de session"])||null,
      month: month(r["Date de la session"])||month(r["today"])||month(r["_submission_time"]),
      totalDoses:num(r["total_doses"]), a0:num(r["total_0_11"]), a1:num(r["total_12_23"]), a2:num(r["total_24_59"]),
      byAntigene, byAntigeneAge,
    };
  });
}

/* ---- Planification : parent (géo+totaux) + sessions ---- */
function buildPlanif(file){
  const {wb,o}=sheets(file);
  const sess=o["sessions"]||pick(wb,o,(n)=>/session/i.test(n));
  const parent=o[wb.SheetNames.find((n)=>n!=="sessions" && o[n]!==sess)] || o[wb.SheetNames[0]];
  const pById=new Map();
  const fiches=parent.map((r,i)=>{ const id=s(r["_id"])||s(r["_uuid"])||("p"+i);
    const f={ id, time:Date.parse(s(r["_submission_time"])||s(r["end"])||s(r["today"]))||0,
      province:s(r["Province"])||null, antenne:s(r["Antenne PEV"])||null, zone:s(r["Zone de santé"])||null,
      aire:s(r["Aire de santé"])||s(r["Préciser l’autre aire de santé"])||null,
      sessionsPlanifiees:num(r["total_sessions_planifiees"]), enfantsAttendus:num(r["total_enfants_attendus"]),
      sessionsAvancees:num(r["total_sessions_avancees"]), sessionsMobiles:num(r["total_sessions_mobiles"]),
      month: month(r["_submission_time"])||month(r["today"]) };
    pById.set(id,f); return f; });
  const sessions=sess.map((r)=>{ const pid=s(r["_submission__id"])||s(r["_submission__uuid"]); const f=pById.get(pid)||{};
    return { ficheId:pid, month:f.month??null, province:f.province??null,antenne:f.antenne??null,zone:f.zone??null,aire:f.aire??null,
      n:s(r["N°"])||null, date:s(r["Date prévue pour la session"])||null,
      type:s(r["Type de session"])||null, autreType:s(r["Préciser l’autre type de session"])||null,
      site:s(r["Nom du lieu ou du site où la session sera implantée"])||null,
      enfantsAttendus:num(r["Nombre total d’enfants attendus"]),
      equipe:s(r["Noms des membres de l’équipe de vaccination"])||null };
  });
  return { fiches, sessions };
}

/* ---- Supervision : flat, questions Oui/Non + texte libre ---- */
function buildSup(file){
  const {wb,o}=sheets(file); const rows=pick(wb,o,(n)=>/supervision/i.test(n));
  const QKEYS = rows.length ? Object.keys(rows[0]).filter(k=>/\?$/.test(k) && !/Si non|Si oui|Préciser/i.test(k)) : [];
  const DIFF = rows.length ? Object.keys(rows[0]).filter(k=>/^Difficultés rencontrées\//.test(k)) : [];
  return { questions: QKEYS, rows: rows.map((r)=>{
    const q={}; for(const k of QKEYS){ const v=s(r[k]); q[k]= /^oui$/i.test(v)?"oui": /^non$/i.test(v)?"non": null; }
    return { province:s(r["* Province"])||s(r["Province"])||null, antenne:s(r["* Antenne PEV"])||null,
      zone:s(r["* Zone de Santé"])||null, aire:s(r["* Aire de Santé"])||null, site:s(r["* Nom du site supervisé"])||null,
      month: month(r["* Date de supervision"])||month(r["Date de soumission"])||month(r["_submission_time"]),
      q,
      difficultesList: DIFF.filter(k=>{const v=s(r[k]); return v==="1"||/^oui$/i.test(v)||v==="True"||v==="true";}).map(k=>k.split("/")[1]),
      difficultes:s(r["Difficultés rencontrées"])||null,
      actions:s(r["Actions correctrices immédiates"])||null,
      recommandations:s(r["Recommandations du superviseur"])||null };
  })};
}

const seed = {
  generatedFrom: "Exports Kobo SAV (activité terminée) — " + new Date().toISOString().slice(0,10),
  antigenes: ANTI,
  identCs: buildIdent(F.ident_cs, false),
  identRelais: buildIdent(F.ident_relais, true),
  resultats: buildResultats(F.resultats),
  planif: buildPlanif(F.planif),
  supervision: buildSup(F.supervision),
};

const out = path.join(__dirname, "..", "data", "sav", "sav-seed.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(seed));
console.log("Wrote", out);
console.log("identCs fiches:", seed.identCs.fiches.length, "enfants:", seed.identCs.enfants.length);
console.log("identRelais fiches:", seed.identRelais.fiches.length, "enfants:", seed.identRelais.enfants.length);
console.log("resultats:", seed.resultats.length, "planif fiches:", seed.planif.fiches.length, "sessions:", seed.planif.sessions.length);
console.log("supervision rows:", seed.supervision.rows.length, "questions:", seed.supervision.questions.length);
