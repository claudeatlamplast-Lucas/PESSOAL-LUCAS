/* =========================================================
   ui.js — helpers de interface: formatação, modal, toast, gráficos SVG
   ========================================================= */

const CHART_COLORS = ['#6e7a35','#c1440e','#8a8d80','#c99a2e','#3a3d3e','#7a9a3f','#56595a','#b3402c'];

function formatCurrency(v){
  const n = Number(v||0);
  return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}

function formatDate(v){
  if(!v) return '—';
  const d = new Date(v + 'T00:00:00');
  if(isNaN(d.getTime())) return v;
  return d.toLocaleDateString('pt-BR');
}

function escapeHtml(str){
  if(str===undefined || str===null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function categoriaLabel(cat){
  return (STATE.configOrcamento.categoriasLabel && STATE.configOrcamento.categoriasLabel[cat]) || cat;
}

/* ---------------- Toast ---------------- */
function showToast(msg, type){
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast' + (type==='error' ? ' error' : '');
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .25s'; setTimeout(()=>el.remove(), 260); }, 2600);
}

/* ---------------- Modal ---------------- */
function openModal(html, opts){
  opts = opts || {};
  const backdrop = document.getElementById('modal-backdrop');
  const content = document.getElementById('modal-content');
  content.innerHTML = html;
  backdrop.classList.add('open');
  if(opts.onMount) opts.onMount(content);
  const closeHandler = (e)=>{ if(e.target===backdrop) closeModal(); };
  backdrop.onclick = closeHandler;
}
function closeModal(){
  document.getElementById('modal-backdrop').classList.remove('open');
  document.getElementById('modal-content').innerHTML = '';
}

/* ---------------- Gráfico donut (SVG) ---------------- */
function donutChartSVG(data, size){
  size = size || 150;
  const r = size/2 - 10;
  const cx = size/2, cy = size/2;
  const total = data.reduce((s,d)=>s+Math.max(d.value,0),0);
  let acc = 0;
  const circumference = 2*Math.PI*r;
  let circles = '';
  if(total <= 0){
    circles = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2c2c27" stroke-width="16"/>`;
  } else {
    data.forEach((d,i)=>{
      const val = Math.max(d.value,0);
      if(val<=0) return;
      const frac = val/total;
      const dash = frac*circumference;
      const gap = circumference-dash;
      const offset = circumference*0.25 - (acc/total)*circumference;
      circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="16"
        stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${offset}" />`;
      acc += val;
    });
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${circles}</svg>`;
}

function legendHTML(data){
  return `<div class="legend">${data.map(d=>`
    <div class="legend-item">
      <span class="legend-dot" style="background:${d.color}"></span>
      <span>${escapeHtml(d.label)}</span>
      <span class="legend-val num">${formatCurrency(d.value)}</span>
    </div>`).join('')}</div>`;
}

/* ---------------- Barra de progresso ---------------- */
function progressBarHTML(pct, overClass){
  const clamped = Math.max(0, Math.min(100, pct));
  const over = pct > 100;
  return `<div class="progress${over?' over':''}"><i style="width:${clamped}%"></i></div>`;
}

/* ---------------- Confirmação ---------------- */
function confirmAction(msg){
  return window.confirm(msg);
}

/* ---------------- Navegador de mês (compartilhado entre views) ---------------- */
function monthNavHTML(){
  return `
    <div class="month-nav" data-month-nav>
      <button class="btn-icon" data-mes-delta="-1" aria-label="Mês anterior">
        <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>
      </button>
      <span class="month-label">${escapeHtml(formatMonthLabel(mesSelecionado))}</span>
      <button class="btn-icon" data-mes-delta="1" aria-label="Próximo mês">
        <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
      </button>
    </div>`;
}
function bindMonthNav(container, onChange){
  container.querySelectorAll('[data-mes-delta]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      mesSelecionado = shiftMonthKey(mesSelecionado, Number(btn.dataset.mesDelta));
      updateMesBadge();
      onChange();
    });
  });
}

/* ---------------- Seletor de categoria variável (options html) ---------------- */
function categoriaOptionsHTML(selected){
  const cats = Object.keys(STATE.configOrcamento.percentuais);
  return cats.map(c=>`<option value="${escapeHtml(c)}" ${c===selected?'selected':''}>${escapeHtml(categoriaLabel(c))}</option>`).join('');
}
