/* =========================================================
   view: Relatório do mês (fechamento)
   ========================================================= */

const FORMA_LABEL_RELATORIO = { dinheiro:'Dinheiro', debito:'Débito', credito:'Crédito', 'nao-informado':'Não informado' };
const NIVEL_ICO = { ok:'✓', warn:'⚠', alert:'✕', info:'•' };
const NIVEL_COR = { ok:'var(--success)', warn:'var(--warn)', alert:'var(--alert-light)', info:'var(--steel)' };

/** Mês já passou (anterior ao último mês aberto) mas ainda sem relatório salvo. */
function mesJaEncerradoSemRelatorio(mes){
  return !(STATE.fechamentos && STATE.fechamentos[mes]) && STATE.ultimoMesAberto && mes < STATE.ultimoMesAberto;
}

function renderRelatorio(container){
  const mes = mesSelecionado;
  const fech = STATE.fechamentos && STATE.fechamentos[mes];
  const r = fech ? fech.dados : calcRelatorioMes(mes);
  const encerrado = !fech && mesJaEncerradoSemRelatorio(mes);

  const statusTag = fech
    ? `<span class="tag tag-paga">FECHADO em ${escapeHtml(formatDate(fech.fechadoEm))}</span>`
    : `<span class="tag tag-pendente">${encerrado ? 'ENCERRADO — SEM RELATÓRIO SALVO' : 'EM ANDAMENTO — PARCIAL'}</span>`;

  container.innerHTML = `
    <div class="flex-between" style="margin-bottom:1rem; flex-wrap:wrap; gap:.5rem;">
      <h1>Relatório — ${escapeHtml(formatMonthLabel(mes))}</h1>
      <div class="flex gap-sm" style="flex-wrap:wrap;">
        ${monthNavHTML()}
        ${fech
          ? `<button class="btn btn-sm" id="btn-regerar">↻ Atualizar relatório</button>`
          : encerrado
            ? `<button class="btn btn-sm btn-primary" id="btn-gerar-relatorio">Gerar relatório de fechamento</button>`
            : `<button class="btn btn-sm btn-primary" id="btn-fechar-este">Fechar mês</button>`}
      </div>
    </div>
    <div class="stripe-bar"></div>
    <div style="margin-bottom:.75rem;">${statusTag}</div>
    ${relatorioHTML(r, !!fech)}
  `;

  bindMonthNav(container, ()=>renderRelatorio(container));

  container.querySelector('#btn-regerar')?.addEventListener('click', ()=>{
    if(!confirmAction(`Recalcular o relatório de ${formatMonthLabel(mes)} com os dados atuais? A versão salva será substituída.`)) return;
    salvarRelatorioFechamento(mes);
    showToast('Relatório atualizado.');
    renderRelatorio(container);
  });
  container.querySelector('#btn-gerar-relatorio')?.addEventListener('click', ()=>{
    salvarRelatorioFechamento(mes);
    showToast(`Relatório de ${formatMonthLabel(mes)} salvo.`);
    renderRelatorio(container);
  });
  container.querySelector('#btn-fechar-este')?.addEventListener('click', ()=>{
    openResumoMesModal(mes, { podeFechar:true, automatico:false });
  });
}

function relatorioItemLinha(titulo, sub, valor, cor){
  return `
    <div class="row-item">
      <div class="ri-main">
        <div class="ri-title">${escapeHtml(titulo)}</div>
        ${sub ? `<div class="ri-sub">${escapeHtml(sub)}</div>` : ''}
      </div>
      <div class="ri-value" ${cor?`style="color:${cor}"`:''}>${formatCurrency(valor)}</div>
    </div>`;
}

function relatorioHTML(r, fechado){
  const v = r.veredicto;
  const corV = { ok:'var(--success)', warn:'var(--warn)', alert:'var(--alert-light)', info:'var(--steel)' }[v.nivel];
  const cats = r.gastosPorCategoria;
  const donutData = cats.filter(c=>c.gasto>0).map((c,i)=>({ label:c.label, value:c.gasto, color:CHART_COLORS[i % CHART_COLORS.length] }));
  const pctMeta = r.metaPoupanca>0 ? r.poupadoNoMes/r.metaPoupanca*100 : 0;
  const pctReserva = r.metaReserva>0 ? r.totalPoupado/r.metaReserva*100 : 0;

  return `
    <div class="panel card ${v.nivel==='alert'?'alert':v.nivel==='warn'?'warn':''}" style="border-left-width:3px;">
      <div class="card-label">Veredito</div>
      <div class="card-value" style="color:${corV}">${escapeHtml(v.titulo)}</div>
      <div class="card-sub">${escapeHtml(v.texto)}</div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-label">Entrou</div>
        <div class="card-value pos">${formatCurrency(r.receita)}</div>
        <div class="card-sub">${r.receitasPorFonte.length} fonte(s)</div>
      </div>
      <div class="card ${r.dividasEmAberto.length?'warn':''}">
        <div class="card-label">Contas do mês</div>
        <div class="card-value">${formatCurrency(r.dividasTotal)}</div>
        <div class="card-sub">${r.dividasPagas.length} paga(s) · ${r.dividasEmAberto.length} em aberto</div>
      </div>
      <div class="card">
        <div class="card-label">Gastos por fora</div>
        <div class="card-value">${formatCurrency(r.gastosTotal)}</div>
        <div class="card-sub">${r.qtdGastos} lançamento(s) · ${formatCurrency(r.mediaDiaria)}/dia</div>
      </div>
      <div class="card ${r.sobra<0?'alert':''}">
        <div class="card-label">Sobra do mês</div>
        <div class="card-value ${r.sobra>=0?'pos':'neg'}">${formatCurrency(r.sobra)}</div>
        <div class="card-sub">${r.receita>0 ? Math.round(r.sobra/r.receita*100)+'% da receita' : 'sem receita lançada'}</div>
      </div>
    </div>

    <div class="section-title">Análise do mês</div>
    <div class="panel list">
      ${r.analise.length ? r.analise.map(a=>`
        <div class="row-item" style="align-items:flex-start; gap:.6rem;">
          <span style="color:${NIVEL_COR[a.nivel]}; font-weight:700; min-width:1rem;">${NIVEL_ICO[a.nivel]}</span>
          <div class="ri-main text-sm">${escapeHtml(a.texto)}</div>
        </div>`).join('') : '<div class="empty-state">Sem dados suficientes para analisar.</div>'}
    </div>

    <div class="section-title">Quanto entrou</div>
    <div class="panel list">
      ${r.receitasPorFonte.length ? r.receitasPorFonte.map(f=>relatorioItemLinha(f.fonte, '', f.valor, 'var(--success)')).join('') : '<div class="empty-state">Nenhuma receita lançada.</div>'}
      ${r.receitasPorFonte.length>1 ? `<div class="divider"></div><div class="flex-between text-sm"><strong>Total</strong><span class="num">${formatCurrency(r.receita)}</span></div>` : ''}
    </div>

    <div class="section-title">Contas pagas e em aberto</div>
    <div class="panel list">
      ${r.dividasEmAberto.length ? `<div class="card-label" style="color:var(--alert-light);">Em aberto — ${formatCurrency(r.dividasAbertasTotal)}</div>
        ${r.dividasEmAberto.map(d=>relatorioItemLinha(d.nome, [d.categoria, d.vencimento?'dia '+d.vencimento:''].filter(Boolean).join(' · '), d.valor, 'var(--alert-light)')).join('')}` : ''}
      ${r.dividasPagas.length ? `<div class="card-label" ${r.dividasEmAberto.length?'style="margin-top:.75rem;"':''}>Pagas — ${formatCurrency(r.dividasPagasTotal)}</div>
        ${r.dividasPagas.map(d=>relatorioItemLinha(d.nome, [d.categoria, d.parcelas>1?`parcela ${d.parcelaAtual}/${d.parcelas}`:''].filter(Boolean).join(' · '), d.valor)).join('')}` : ''}
      ${!r.dividasTotal ? '<div class="empty-state">Nenhuma conta lançada.</div>' : ''}
    </div>
    ${r.dividasPorCategoria.length>1 ? `
    <div class="panel list">
      <div class="card-label">Contas por categoria</div>
      ${r.dividasPorCategoria.map(c=>`
        <div>
          <div class="flex-between text-sm" style="margin-bottom:.25rem;"><span>${escapeHtml(c.categoria)}</span><span class="num">${formatCurrency(c.valor)}</span></div>
          ${progressBarHTML(r.dividasTotal>0 ? c.valor/r.dividasTotal*100 : 0)}
        </div>`).join('')}
    </div>` : ''}

    <div class="section-title">Gastos por fora, por categoria</div>
    <div class="panel">
      ${donutData.length ? `<div class="chart-wrap">${donutChartSVG(donutData, 150)}${legendHTML(donutData)}</div>` : '<div class="empty-state">Nenhum gasto lançado neste mês.</div>'}
    </div>
    ${cats.length ? `
    <div class="panel list">
      <div class="card-label">Gasto vs orçamento</div>
      ${cats.map(c=>`
        <div>
          <div class="flex-between text-sm" style="margin-bottom:.25rem;">
            <span>${escapeHtml(c.label)} ${c.inesperado>0?`<span class="tag tag-inesperado">${formatCurrency(c.inesperado)} inesperado</span>`:''}</span>
            <span class="num">${formatCurrency(c.planejado)}${c.noOrcamento?' / '+formatCurrency(c.orcamento):' (sem orçamento)'}</span>
          </div>
          ${c.noOrcamento ? progressBarHTML(c.percentualUsado) : ''}
        </div>`).join('')}
      <div class="hint">Os valores da barra não incluem gastos marcados como inesperados — eles aparecem à parte.</div>
    </div>` : ''}
    ${r.gastosPorForma.length ? `
    <div class="panel list">
      <div class="card-label">Por forma de pagamento</div>
      ${r.gastosPorForma.map(f=>relatorioItemLinha(FORMA_LABEL_RELATORIO[f.forma]||f.forma, '', f.valor)).join('')}
    </div>` : ''}
    ${r.maioresGastos.length ? `
    <div class="panel list">
      <div class="card-label">Maiores gastos</div>
      ${r.maioresGastos.map(g=>relatorioItemLinha(
        g.descricao || categoriaLabel(g.categoria),
        [categoriaLabel(g.categoria), g.data?formatDate(g.data):'', g.inesperado?'inesperado':''].filter(Boolean).join(' · '),
        g.valor)).join('')}
    </div>` : ''}

    ${r.faturasCartao.length ? `
    <div class="section-title">Faturas de cartão do mês</div>
    <div class="panel list">
      ${r.faturasCartao.map(f=>relatorioItemLinha(f.nome, '', f.total)).join('')}
      <div class="hint">Informativo — se a fatura já foi lançada em Contas, ela já está somada lá em cima.</div>
    </div>` : ''}

    <div class="section-title">Andamento do plano</div>
    <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(240px,1fr));">
      <div class="panel">
        <div class="card-label">Guardado no mês</div>
        <div class="card-value ${r.metaPoupanca>0 && r.poupadoNoMes>=r.metaPoupanca?'pos':''}">${formatCurrency(r.poupadoNoMes)}</div>
        <div class="card-sub">${r.metaPoupanca>0 ? 'Meta: '+formatCurrency(r.metaPoupanca) : 'sem meta mensal definida'}${r.taxaPoupanca!=null?` · ${r.taxaPoupanca.toFixed(1)}% da receita`:''}</div>
        ${r.metaPoupanca>0 ? progressBarHTML(pctMeta) : ''}
      </div>
      <div class="panel">
        <div class="card-label">Reserva acumulada</div>
        <div class="card-value">${formatCurrency(r.totalPoupado)}</div>
        <div class="card-sub">${r.metaReserva>0 ? Math.min(100,Math.round(pctReserva))+'% da meta de '+formatCurrency(r.metaReserva) : 'sem meta total definida'}</div>
        ${r.metaReserva>0 ? progressBarHTML(pctReserva) : ''}
      </div>
    </div>
    ${r.proximos.length ? `
    <div class="panel list">
      <div class="card-label">Projeção dos próximos meses${fechado?' (na data do fechamento)':''}</div>
      ${r.proximos.map(p=>relatorioItemLinha(formatMonthLabel(p.mes),
        `receita ${formatCurrency(p.receita)} · contas ${formatCurrency(p.dividas)}`, p.saldoFinal, p.deficit?'var(--alert-light)':'var(--success)')).join('')}
    </div>` : ''}

    ${r.anterior ? `
    <div class="section-title">Comparativo com ${escapeHtml(formatMonthLabel(r.anterior.mes))}</div>
    <div class="panel list">
      ${[['Receita', r.receita, r.anterior.receita, true], ['Contas', r.dividasTotal, r.anterior.dividas, false], ['Gastos por fora', r.gastosTotal, r.anterior.gastos, false]].map(([nome, atual, antes, maiorEhMelhor])=>{
        const d = variacaoPct(atual, antes);
        const bom = d==null ? null : (maiorEhMelhor ? d>=0 : d<=0);
        return `<div class="row-item">
          <div class="ri-main">
            <div class="ri-title">${nome}</div>
            <div class="ri-sub">antes ${formatCurrency(antes)} → agora ${formatCurrency(atual)}</div>
          </div>
          <div class="ri-value" style="color:${bom==null?'var(--steel)':bom?'var(--success)':'var(--alert-light)'}">${d==null?'—':(d>=0?'+':'')+Math.round(d)+'%'}</div>
        </div>`;
      }).join('')}
    </div>` : ''}
  `;
}
