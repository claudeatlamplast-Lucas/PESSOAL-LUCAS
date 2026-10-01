/* =========================================================
   view: Histórico — evolução entre os meses fechados
   ========================================================= */

/** Barras agrupadas por mês: entrou (oliva) vs saiu (laranja). */
function graficoEntradaSaidaSVG(h){
  const W = Math.max(320, h.length*64), H = 160, pad = 22;
  const max = Math.max(1, ...h.map(x=>Math.max(x.receita, x.saidas)));
  const grupo = (W - 20) / h.length;
  const bw = Math.min(18, grupo/3);
  const y = v=>H - pad - (v/max)*(H - pad*2);
  const barras = h.map((x,i)=>{
    const cx = 10 + grupo*i + grupo/2;
    const [, m] = x.mes.split('-');
    return `
      <rect x="${cx-bw-1}" y="${y(x.receita)}" width="${bw}" height="${H-pad-y(x.receita)}" fill="#6e7a35"/>
      <rect x="${cx+1}" y="${y(x.saidas)}" width="${bw}" height="${H-pad-y(x.saidas)}" fill="#c1440e"/>
      <text x="${cx}" y="${H-6}" text-anchor="middle" font-size="10" fill="#85837a">${m}/${x.mes.slice(2,4)}</text>`;
  }).join('');
  return `<div class="scroll-x"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Entradas e saídas por mês">${barras}</svg></div>
    <div class="legend"><div class="legend-item"><span class="legend-dot" style="background:#6e7a35"></span><span>Entrou</span></div>
    <div class="legend-item"><span class="legend-dot" style="background:#c1440e"></span><span>Saiu (contas + gastos)</span></div></div>`;
}

function renderHistorico(container){
  const h = calcHistorico();
  const analise = gerarAnaliseHistorico(h);
  const ultimos = h.slice(-6);

  const catChaves = [];
  ultimos.forEach(x=>Object.keys(x.categorias).forEach(c=>{ if(!catChaves.includes(c)) catChaves.push(c); }));
  const labelCat = c=>{ for(const x of ultimos){ if(x.categorias[c]) return x.categorias[c].label; } return c; };

  container.innerHTML = `
    <div class="flex-between" style="margin-bottom:1rem; flex-wrap:wrap; gap:.5rem;">
      <h1>Histórico de Meses</h1>
    </div>
    <div class="stripe-bar"></div>
    <p class="hint">Os meses fecham sozinhos quando o calendário vira. Cada fechamento fica guardado aqui para comparar a evolução.</p>

    ${!h.length ? '<div class="empty-state">Nenhum mês fechado ainda. O primeiro relatório aparece quando o mês atual virar.</div>' : `
    <div class="section-title">Análise de evolução</div>
    <div class="panel list">
      ${analise.map(a=>`
        <div class="row-item" style="align-items:flex-start; gap:.6rem;">
          <span style="color:${NIVEL_COR[a.nivel]}; font-weight:700; min-width:1rem;">${NIVEL_ICO[a.nivel]}</span>
          <div class="ri-main text-sm">${escapeHtml(a.texto)}</div>
        </div>`).join('')}
    </div>

    <div class="section-title">Entradas vs saídas</div>
    <div class="panel">${graficoEntradaSaidaSVG(ultimos)}</div>

    <div class="section-title">Mês a mês</div>
    <div class="panel scroll-x">
      <table style="width:100%; border-collapse:collapse; font-size:.82rem;">
        <thead>
          <tr style="text-align:right; color:var(--text-2);">
            <th style="text-align:left; padding:.4rem;">Mês</th><th>Entrou</th><th>Contas</th><th>Gastos</th><th>Sobra</th><th>Guardou</th><th style="text-align:left; padding-left:.6rem;">Veredito</th>
          </tr>
        </thead>
        <tbody>
          ${h.slice().reverse().map(x=>`
            <tr data-mes="${x.mes}" style="text-align:right; border-top:1px solid var(--border-0); cursor:pointer;">
              <td style="text-align:left; padding:.5rem .4rem;"><a href="#/relatorio" data-ver="${x.mes}">${escapeHtml(formatMonthLabel(x.mes))}</a>${x.retroativo?' <span class="tag tag-variavel" title="Relatório gerado depois do mês passar">retroativo</span>':''}</td>
              <td class="num">${formatCurrency(x.receita)}</td>
              <td class="num">${formatCurrency(x.contas)}</td>
              <td class="num">${formatCurrency(x.gastos)}</td>
              <td class="num" style="color:${x.sobra>=0?'var(--success)':'var(--alert-light)'}">${formatCurrency(x.sobra)}</td>
              <td class="num">${formatCurrency(x.poupado)}</td>
              <td style="text-align:left; padding-left:.6rem; color:${NIVEL_COR[x.veredicto.nivel]}">${escapeHtml(x.veredicto.titulo)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    ${catChaves.length ? `
    <div class="section-title">Gastos por categoria (últimos ${ultimos.length} meses)</div>
    <div class="panel scroll-x">
      <table style="width:100%; border-collapse:collapse; font-size:.82rem;">
        <thead>
          <tr style="text-align:right; color:var(--text-2);">
            <th style="text-align:left; padding:.4rem;">Categoria</th>${ultimos.map(x=>`<th>${x.mes.slice(5)}/${x.mes.slice(2,4)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${catChaves.map(c=>`
            <tr style="text-align:right; border-top:1px solid var(--border-0);">
              <td style="text-align:left; padding:.5rem .4rem;">${escapeHtml(labelCat(c))}</td>
              ${ultimos.map(x=>`<td class="num">${formatCurrency((x.categorias[c]||{}).gasto||0)}</td>`).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
    `}
  `;

  container.querySelectorAll('tr[data-mes]').forEach(tr=>{
    tr.addEventListener('click', ()=>{ mesSelecionado = tr.dataset.mes; window.location.hash = '#/relatorio'; });
  });
  container.querySelectorAll('[data-ver]').forEach(a=>{
    a.addEventListener('click', ()=>{ mesSelecionado = a.dataset.ver; });
  });
}
