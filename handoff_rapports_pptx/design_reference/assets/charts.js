/* =========================================================================
   charts.js — Rendu SVG de graphiques ÉPURÉS (aucune ligne en arrière-plan)
   Conçu pour reproduire fidèlement, en PPTX, des graphiques propres :
   pas de quadrillage, pas d'axe vertical, libellés de valeur posés sur la
   barre, baseline discrète uniquement. Sert de référence visuelle exacte
   pour la génération pptxgenjs côté Claude Code.
   ========================================================================= */
const PAL = {
  marine:"#00205c", marine2:"#013a86", cyan:"#0093d5",
  vert:"#1f9d57", bleu:"#0093d5", jaune:"#f59e0b", rouge:"#e23636",
  bordeaux:"#7b2d3a", gris:"#94a3b8", grisClair:"#e2e8f0",
  texte:"#1e293b", muted:"#64748b"
};
/* couleur d'une valeur selon les seuils d'appréciation PEV */
function scoreColor(v){ return v>=80?PAL.vert : v>=70?PAL.bleu : v>=60?PAL.jaune : PAL.rouge; }
/* couleur d'un taux de concordance (95–105 concordant) */
function concColor(v){ return (v>=95&&v<=105)?PAL.vert : v<95?PAL.jaune : PAL.rouge; }

function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); }

/* ---- Barres verticales : aucune gridline, valeur au-dessus de la barre ---- */
function barChart(data, opt={}){
  const { max=100, colorFn=scoreColor, unit="", h=300, w=620, gap=0.34 } = opt;
  const padT=34, padB=46, padX=10;
  const plotH=h-padT-padB, plotW=w-padX*2;
  const n=data.length, slot=plotW/n, bw=slot*(1-gap);
  let bars="";
  data.forEach((d,i)=>{
    const val=d.v, col=d.c||colorFn(val);
    const bh=Math.max(2, val/max*plotH);
    const x=padX+slot*i+(slot-bw)/2, y=padT+plotH-bh;
    bars+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${col}"/>`;
    bars+=`<text x="${(x+bw/2).toFixed(1)}" y="${(y-8).toFixed(1)}" text-anchor="middle" class="ch-val">${val}${unit}</text>`;
    bars+=`<text x="${(x+bw/2).toFixed(1)}" y="${(padT+plotH+18).toFixed(1)}" text-anchor="middle" class="ch-cat">${esc(d.l)}</text>`;
    if(d.l2) bars+=`<text x="${(x+bw/2).toFixed(1)}" y="${(padT+plotH+32).toFixed(1)}" text-anchor="middle" class="ch-cat2">${esc(d.l2)}</text>`;
  });
  const baseY=padT+plotH;
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" preserveAspectRatio="xMidYMid meet">
    <line x1="${padX}" y1="${baseY}" x2="${w-padX}" y2="${baseY}" class="ch-base"/>${bars}</svg>`;
}

/* ---- Barres groupées (séries multiples) : aucune gridline ---- */
function groupedBar(cats, series, opt={}){
  const { max=null, h=300, w=620, unit="" } = opt;
  const padT=30, padB=46, padX=10;
  const plotH=h-padT-padB, plotW=w-padX*2;
  const allVals=series.flatMap(s=>s.values);
  const mx=max||Math.ceil(Math.max(...allVals,1)/10)*10;
  const n=cats.length, slot=plotW/n, groupGap=slot*0.26;
  const inner=slot-groupGap, bw=inner/series.length;
  let bars="";
  cats.forEach((cat,ci)=>{
    series.forEach((s,si)=>{
      const val=s.values[ci];
      const bh=Math.max(2, val/mx*plotH);
      const x=padX+slot*ci+groupGap/2+bw*si, y=padT+plotH-bh;
      bars+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw-2).toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${s.color}"/>`;
      bars+=`<text x="${(x+(bw-2)/2).toFixed(1)}" y="${(y-5).toFixed(1)}" text-anchor="middle" class="ch-val-sm">${val}${unit}</text>`;
    });
    bars+=`<text x="${(padX+slot*ci+slot/2).toFixed(1)}" y="${(padT+plotH+18).toFixed(1)}" text-anchor="middle" class="ch-cat">${esc(cat)}</text>`;
  });
  const baseY=padT+plotH;
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" preserveAspectRatio="xMidYMid meet">
    <line x1="${padX}" y1="${baseY}" x2="${w-padX}" y2="${baseY}" class="ch-base"/>${bars}</svg>`;
}

function legend(items){
  return `<div class="ch-legend">${items.map(it=>`<span class="ch-leg"><i style="background:${it.color}"></i>${esc(it.name)}</span>`).join("")}</div>`;
}

/* ---- Barres horizontales (listes d'indicateurs %) ---- */
function hBars(data, opt={}){
  const { colorFn=scoreColor, max=100 } = opt;
  return `<div class="hbars">${data.map(d=>{
    const col=d.c||colorFn(d.v);
    return `<div class="hbar-row"><span class="hbar-l">${esc(d.l)}</span>
      <span class="hbar-track"><span class="hbar-fill" style="width:${Math.min(100,d.v/max*100)}%;background:${col}"></span></span>
      <span class="hbar-v" style="color:${col}">${d.v}%</span></div>`;
  }).join("")}</div>`;
}

/* ---- Jauge donut (SVG arc) ---- */
function gauge(val, label, opt={}){
  const { sz=150, colorFn=scoreColor } = opt;
  const r=sz/2-12, c=2*Math.PI*r, col=colorFn(val);
  const off=c*(1-val/100);
  return `<div class="gauge" style="width:${sz}px">
    <svg viewBox="0 0 ${sz} ${sz}" width="${sz}" height="${sz}">
      <circle cx="${sz/2}" cy="${sz/2}" r="${r}" fill="none" stroke="#eef2f7" stroke-width="13"/>
      <circle cx="${sz/2}" cy="${sz/2}" r="${r}" fill="none" stroke="${col}" stroke-width="13" stroke-linecap="round"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${sz/2} ${sz/2})"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" class="gauge-v" style="fill:${col}">${val}%</text>
    </svg><div class="gauge-l">${esc(label)}</div></div>`;
}

/* ---- Funnel horizontal (étapes avec flèches) ---- */
function funnel(steps){
  return `<div class="funnel">${steps.map((s,i)=>`
    <div class="fn-step"><div class="fn-pct" style="color:${s.c||PAL.cyan}">${s.v}</div><div class="fn-lab">${esc(s.l)}</div></div>
    ${i<steps.length-1?'<div class="fn-arrow">&#8594;</div>':''}`).join("")}</div>`;
}
window.Charts = { PAL, scoreColor, concColor, barChart, groupedBar, legend, hBars, gauge, funnel };
