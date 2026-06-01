/* =========================================================================
   build.js — Moteur de rendu des slides du rapport automatisé.
   Transforme un tableau de specs (data-*.js) en <section> deck-stage.
   Chaque template = un gabarit PPTX reproductible côté pptxgenjs.
   ========================================================================= */
const C = window.Charts, P = C.PAL;
let CFG = {}; // {footerL, period, gen}

const H = (s)=> (s==null?"":String(s));
function tag(t){ return t?`<span class="hd-tag">${H(t)}</span>`:""; }

function frame(spec, bodyHTML){
  return `<section data-label="${H(spec.tag||spec.title)}">
    <div class="slide">
      <div class="hd">
        <div class="hd-logos"><img src="assets/oms-white.png" alt="OMS"/><span class="sep"></span><img src="assets/pev.png" alt="PEV"/></div>
        <div class="hd-txt"><div class="hd-title">${H(spec.title)}</div>${spec.sub?`<div class="hd-sub">${H(spec.sub)}</div>`:""}</div>
        <div class="hd-meta">${tag(spec.tag)}<span class="hd-no">${spec.no}</span></div>
      </div>
      <div class="bd">${bodyHTML}</div>
      <div class="ft"><span>${CFG.footerL}</span><span><b>Période :</b> ${CFG.period} &nbsp;·&nbsp; Source ODK/Kobo/Excel &nbsp;·&nbsp; Généré le ${CFG.gen}</span></div>
    </div></section>`;
}

/* ---- callout commentaire dynamique expert PEV ---- */
function note(txt, kind="read"){
  const lab = kind==="alert"?"ALERTE PEV" : kind==="warn"?"LECTURE PEV" : "LECTURE PEV";
  return `<div class="note ${kind==='read'?'':kind}"><span class="note-tag">${lab}</span><p>${txt}</p></div>`;
}
function kpiCards(items){
  return `<div class="kpis" style="grid-template-columns:repeat(${items.length>4?4:items.length},1fr)">${
    items.map(k=>`<div class="kpi" data-tone="${k.tone||'blue'}"><div class="kpi-v">${H(k.v)}</div><div class="kpi-l">${H(k.l)}</div>${k.s?`<div class="kpi-s">${H(k.s)}</div>`:""}</div>`).join("")}</div>`;
}
function tableHTML(cols, rows){
  return `<table class="tb"><thead><tr>${cols.map(c=>`<th>${H(c)}</th>`).join("")}</tr></thead><tbody>${
    rows.map(r=>{const cls=r._total?' class="total"':""; const cells=(r.cells||r);
      return `<tr${cls}>${cells.map(c=>`<td>${c}</td>`).join("")}</tr>`;}).join("")}</tbody></table>`;
}
const pill=(txt,cls)=>`<span class="pill ${cls}">${txt}</span>`;

/* ===================== TEMPLATES ===================== */
const T = {
  cover(s){
    return `<section data-label="${H(s.tag||'Couverture')}"><div class="slide cover">
      <div class="cover-logos"><img src="assets/oms-white.png" alt="OMS"/><span class="sep"></span><img src="assets/pev.png" alt="PEV"/></div>
      <div class="cover-kicker">${H(s.kicker)}</div>
      <h1>${H(s.title)}</h1>
      <div class="cover-meta">${s.meta.map(m=>`<div>${H(m)}</div>`).join("")}</div>
      <div class="cover-kpis">${s.kpis.map(k=>`<div class="cover-kpi"><b>${H(k.v)}</b><span>${H(k.l)}</span></div>`).join("")}</div>
      <div class="cover-src">${H(s.src)}</div>
    </div></section>`;
  },
  kpiGrid(s){
    const b=`${s.lead?`<div class="block-h">${H(s.lead)}</div>`:""}${kpiCards(s.kpis)}
      ${s.table?`<div style="margin-top:18px">${tableHTML(s.table.cols,s.table.rows)}</div>`:""}
      <div class="fill"></div>${s.note?note(s.note,s.noteKind):""}`;
    return frame(s,b);
  },
  exec(s){
    const b=`${kpiCards(s.kpis)}
      <div style="margin-top:16px">${note(s.message,s.noteKind||'read')}</div>
      <div class="row" style="margin-top:16px;gap:14px">
        ${s.cols.map(c=>`<div class="col legend-card"><div class="block-h" style="margin-bottom:8px">${H(c.h)}</div>
          <ul class="ck" style="gap:7px">${c.items.map(i=>`<li>${H(i)}</li>`).join("")}</ul></div>`).join("")}
      </div><div class="fill"></div>`;
    return frame(s,b);
  },
  barSide(s){ // barres + panneau latéral (table/legend) + note
    const chart = s.grouped
      ? C.groupedBar(s.grouped.cats, s.grouped.series, s.chartOpt||{}) + C.legend(s.grouped.series.map(x=>({name:x.name,color:x.color})))
      : C.barChart(s.bars, s.chartOpt||{});
    const b=`<div class="row" style="flex:1;align-items:stretch">
      <div class="col" style="flex:1.35;display:flex;flex-direction:column">
        <div class="block-h">${H(s.chartTitle)}</div>
        <div style="flex:1;display:flex;align-items:center">${chart}</div></div>
      <div class="col" style="display:flex;flex-direction:column;gap:12px">${s.side}</div>
    </div>${s.note?note(s.note,s.noteKind):""}`;
    return frame(s,b);
  },
  bigBar(s){ // grand graphique pleine largeur + note
    const chart = s.grouped
      ? C.groupedBar(s.grouped.cats, s.grouped.series, Object.assign({w:1040,h:330},s.chartOpt||{})) + C.legend(s.grouped.series.map(x=>({name:x.name,color:x.color})))
      : C.barChart(s.bars, Object.assign({w:1040,h:330},s.chartOpt||{}));
    const b=`<div class="block-h">${H(s.chartTitle)}</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center">${chart}</div>
      ${s.note?note(s.note,s.noteKind):""}`;
    return frame(s,b);
  },
  gauges(s){
    const b=`<div class="block-h">${H(s.chartTitle||'')}</div>
      <div class="row" style="flex:1;align-items:center;justify-content:center;gap:40px">
        ${s.gauges.map(g=>C.gauge(g.v,g.l,{sz:g.sz||160,colorFn:g.fn||C.scoreColor})).join("")}</div>
      ${s.note?note(s.note,s.noteKind):""}`;
    return frame(s,b);
  },
  hbarList(s){
    const b=`<div class="row" style="flex:1;align-items:center;gap:34px">
      ${s.lists.map(l=>`<div class="col"><div class="block-h">${H(l.h)}</div>${C.hBars(l.data,l.opt||{})}</div>`).join("")}
    </div>${s.note?note(s.note,s.noteKind):""}`;
    return frame(s,b);
  },
  table(s){
    const b=`${s.chartTitle?`<div class="block-h">${H(s.chartTitle)}</div>`:""}
      ${tableHTML(s.cols,s.rows)}
      ${s.extra||""}<div class="fill"></div>${s.note?note(s.note,s.noteKind):""}`;
    return frame(s,b);
  },
  tableBar(s){ // table à gauche + barres à droite
    const chart = s.grouped
      ? C.groupedBar(s.grouped.cats, s.grouped.series, s.chartOpt||{}) + C.legend(s.grouped.series.map(x=>({name:x.name,color:x.color})))
      : C.barChart(s.bars, s.chartOpt||{});
    const b=`<div class="row" style="flex:1;align-items:stretch">
      <div class="col" style="flex:1.1">${s.tableTitle?`<div class="block-h">${H(s.tableTitle)}</div>`:""}${tableHTML(s.cols,s.rows)}</div>
      <div class="col" style="display:flex;flex-direction:column"><div class="block-h">${H(s.chartTitle)}</div>
        <div style="flex:1;display:flex;align-items:center">${chart}</div></div>
    </div>${s.note?note(s.note,s.noteKind):""}`;
    return frame(s,b);
  },
  funnel(s){
    const b=`<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:18px">
      <div><div class="block-h">${H(s.chartTitle||'Parcours de récupération')}</div>${C.funnel(s.steps)}</div>
      ${s.table?`<div>${tableHTML(s.table.cols,s.table.rows)}</div>`:""}
    </div>${s.note?note(s.note,s.noteKind):""}`;
    return frame(s,b);
  },
  matrix(s){
    const cols=[P.vert,P.jaune,P.bleu,P.rouge];
    const b=`<div class="matrix">${s.cells.map((c,i)=>`<div class="mx-cell" style="background:${c.color||cols[i]}">
        <h4>${H(c.h)}</h4><p>${H(c.p)}</p><div class="mx-act">&#8594; ${H(c.act)}</div></div>`).join("")}</div>
      ${s.note?note(s.note,s.noteKind):""}`;
    return frame(s,b);
  },
  process(s){
    const b=`<div class="proc">${s.steps.map((st,i)=>`${i>0?'<div class="proc-arrow">&#8594;</div>':''}
        <div class="proc-step"><div class="proc-num">${i+1}</div><h5>${H(st.h)}</h5><p>${H(st.p)}</p></div>`).join("")}</div>
      <div class="row" style="margin-top:20px;gap:18px">${s.sources.map(sc=>`<div class="col legend-card">
        <div class="block-h" style="margin-bottom:6px">${H(sc.h)}</div><p style="margin:0;font-size:12.5px;line-height:1.5;color:var(--muted)">${H(sc.p)}</p></div>`).join("")}</div>
      <div class="fill"></div>${s.note?note(s.note,s.noteKind):""}`;
    return frame(s,b);
  },
  conclusion(s){
    const b=`<ul class="ck" style="gap:12px;margin-bottom:18px">${s.points.map(p=>`<li>${H(p)}</li>`).join("")}</ul>
      ${s.outputs?`<div class="block-h">${H(s.outputs.h)}</div>${tableHTML(s.outputs.cols,s.outputs.rows)}`:""}
      <div class="fill"></div>${s.note?note(s.note,s.noteKind):""}`;
    return frame(s,b);
  },
};

function renderDeck(slides, cfg){
  CFG = cfg;
  const stage = document.getElementById("deck");
  let n=0;
  const html = slides.map(s=>{
    if(s.type!=="cover"){ n++; s.no=String(n).padStart(2,"0"); }
    return T[s.type](s);
  }).join("");
  stage.innerHTML = html;
}
window.renderDeck = renderDeck;
window.RT = { pill, tableHTML, note, kpiCards };
