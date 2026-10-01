/* =========================================================
   view: Dashboard (QG)
   ========================================================= */

function renderDashboard(container){
  const mes = mesSelecionado;
  const receita = calcReceitaTotal(mes);
  const dividasTotal = calcDividasTotal(mes);
  const saldoLivre = calcSaldoLivre(mes);
  const orcCategorias = calcOrcamentoPorCategoria(mes);
  const inesperados = calcGastosInesperadosTotal(mes);
  const metaPoupanca = Number(STATE.configOrcamento.metaPoupancaMensal||0);
  const poupadoNoMes = calcPoupadoNoMes(mes);
  const totalPoupado = calcTotalPoupado();
  const metaReserva = Number(STATE.configOrcamento.metaReservaTotal||0);

  const gastoTotalVariavel = Object.values(orcCategorias).reduce((s,c)=>s+c.gasto,0);
  const orcTotalVariavel = Object.values(orcCategorias).reduce((s,c)=>s+c.orcamento,0);

  const proximas = STATE.dividas
    .filter(d=>d.mes===mes && d.status!=='paga')
    .sort((a,b)=>(a.vencimento||99)-(b.vencimento||99))
    .slice(0,5);

  const categoriasEstourando = Object.entries(orcCategorias).filter(([,v])=>v.percentualUsado>=100);

  const donutData = Object.entries(orcCategorias).map(([cat,v],i)=>({
    label: categoriaLabel(cat), value: v.gasto, color: CHART_COLORS[i % CHART_COLORS.length]
  }));

  const situacao = calcSituacaoCaixa();
  const mentorTeaser = calcMentor().estrategias[0] || 'Confira as sugestões de pagamento, mercado e reserva.';

  container.innerHTML = `
    <div class="flex-between" style="margin-bottom:1rem; flex-wrap:wrap; gap:.5rem;">
      <h1>QG — ${escapeHtml(formatMonthLabel(mes))}</h1>
      <div class="flex gap-sm" style="flex-wrap:wrap;">
        ${monthNavHTML()}
        <button class="btn btn-sm" id="btn-preparar-proximo">🗓️ Preparar Próximo Mês</button>
        <button class="btn btn-sm" id="btn-resumo-mes">📋 Resumo &amp; Fechar Mês</button>
      </div>
    </div>
    <div class="stripe-bar"></div>

    ${STATE.fechamentos && STATE.fechamentos[mes] ? `
    <div class="panel flex-between" style="align-items:center; gap:.75rem; flex-wrap:wrap; border-left:3px solid var(--success);">
      <div>
        <div class="card-label">📋 Mês fechado</div>
        <div class="text-sm">O relatório de ${escapeHtml(formatMonthLabel(mes))} está pronto: ${escapeHtml(STATE.fechamentos[mes].dados.veredicto.titulo)}.</div>
      </div>
      <a href="#/relatorio" class="btn btn-sm">Ver relatório →</a>
    </div>` : ''}

    ${situacaoCaixaHTML(situacao)}

    <div class="panel flex-between" style="align-items:center; gap:.75rem; flex-wrap:wrap;">
      <div>
        <div class="card-label">🎯 Mentor de Gastos</div>
        <div class="text-sm">${escapeHtml(mentorTeaser)}</div>
      </div>
      <a href="#/mentor" class="btn btn-sm">Ver mentor completo →</a>
    </div>

    ${categoriasEstourando.length ? `
    <div class="panel card alert" style="border-left-width:3px;">
      <div class="card-label">⚠ ALERTA DE PERÍMETRO</div>
      <div class="text-sm">Categoria(s) estourando o orçamento: <strong>${categoriasEstourando.map(([c])=>escapeHtml(categoriaLabel(c))).join(', ')}</strong></div>
    </div>` : ''}

    <div class="grid">
      <div class="card ${saldoLivre<0?'alert':''}">
        <div class="card-label">Saldo Livre do Mês</div>
        <div class="card-value ${saldoLivre>=0?'pos':'neg'}">${formatCurrency(saldoLivre)}</div>
        <div class="card-sub">Receita ${formatCurrency(receita)} − Dívidas ${formatCurrency(dividasTotal)} − Poupança ${formatCurrency(metaPoupanca)}</div>
      </div>
      <div class="card">
        <div class="card-label">Gasto Variável Consumido</div>
        <div class="card-value">${formatCurrency(gastoTotalVariavel)}</div>
        <div class="card-sub">de ${formatCurrency(orcTotalVariavel)} orçado (${orcTotalVariavel>0?Math.round(gastoTotalVariavel/orcTotalVariavel*100):0}%)</div>
      </div>
      <div class="card ${inesperados>0?'warn':''}">
        <div class="card-label">Gastos Inesperados</div>
        <div class="card-value ${inesperados>0?'neg':''}">${formatCurrency(inesperados)}</div>
        <div class="card-sub">Fora do orçamento planejado</div>
      </div>
      <div class="card">
        <div class="card-label">Reserva Acumulada</div>
        <div class="card-value">${formatCurrency(totalPoupado)}</div>
        <div class="card-sub">${metaReserva>0 ? Math.min(100,Math.round(totalPoupado/metaReserva*100))+'% da meta total' : 'defina uma meta em Reserva'}</div>
      </div>
    </div>

    <div class="section-title">Distribuição do Gasto por Categoria</div>
    <div class="panel">
      <div class="chart-wrap">
        ${donutChartSVG(donutData, 150)}
        ${legendHTML(donutData)}
      </div>
    </div>

    <div class="section-title">Orçamento por Categoria</div>
    <div class="panel list">
      ${Object.entries(orcCategorias).map(([cat,v])=>`
        <div>
          <div class="flex-between text-sm" style="margin-bottom:.25rem;">
            <span>${escapeHtml(categoriaLabel(cat))}</span>
            <span class="num">${formatCurrency(v.gasto)} / ${formatCurrency(v.orcamento)}</span>
          </div>
          ${progressBarHTML(v.percentualUsado)}
        </div>
      `).join('') || '<div class="empty-state">Nenhuma categoria configurada. Vá em Config &amp; Backup.</div>'}
    </div>

    <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(280px,1fr));">
      <div>
        <div class="section-title">Próximas Dívidas a Vencer</div>
        <div class="panel list">
          ${proximas.length ? proximas.map(d=>`
            <div class="row-item">
              <div class="ri-main">
                <div class="ri-title">${escapeHtml(d.nome)}</div>
                <div class="ri-sub">${d.vencimento ? 'Vence dia '+escapeHtml(d.vencimento) : 'Sem data fixa'} · ${escapeHtml(d.categoria||'')}</div>
              </div>
              <div class="ri-value">${formatCurrency(d.valor)}</div>
            </div>
          `).join('') : '<div class="empty-state"><span class="es-ico">✓</span>Nenhuma dívida pendente neste mês.</div>'}
        </div>
      </div>
      <div>
        <div class="section-title">Meta de Poupança do Mês</div>
        <div class="panel">
          <div class="card-label">Guardado em ${escapeHtml(formatMonthLabel(mes))}</div>
          <div class="card-value ${poupadoNoMes>=metaPoupanca && metaPoupanca>0 ? 'pos':''}">${formatCurrency(poupadoNoMes)}</div>
          <div class="card-sub">Meta: ${formatCurrency(metaPoupanca)}</div>
          ${metaPoupanca>0 ? progressBarHTML(poupadoNoMes/metaPoupanca*100) : ''}
        </div>
      </div>
    </div>
  `;

  bindMonthNav(container, ()=>renderDashboard(container));

  container.querySelector('#btn-resumo-mes').addEventListener('click', ()=>{
    openResumoMesModal(mes, { podeFechar:true, automatico:false });
  });
  container.querySelector('#btn-preparar-proximo').addEventListener('click', ()=>{
    const resultado = prepararProximoMes(mes);
    const total = resultado.dividasCopiadas + resultado.receitasCopiadas;
    mesSelecionado = resultado.mes;
    updateMesBadge();
    showToast(total>0
      ? `${formatMonthLabel(resultado.mes)} preparado: ${resultado.dividasCopiadas} dívida(s) e ${resultado.receitasCopiadas} receita(s) recorrentes copiadas.`
      : `${formatMonthLabel(resultado.mes)} já estava preparado — nada novo pra copiar.`);
    renderDashboard(container);
  });
  container.querySelector('#btn-editar-saldo')?.addEventListener('click', ()=>{
    openSaldoContaForm(()=>renderDashboard(container));
  });
}

function situacaoCaixaHTML(s){
  const atualizadoLabel = STATE.saldoConta.atualizadoEm ? formatDate(STATE.saldoConta.atualizadoEm) : 'nunca informado';
  const itensPagamento = [
    ...s.atrasadas.map(d=>({ d, tag:'ATRASADA', tagClass:'tag-inesperado' })),
    ...s.futurasComData.map(d=>({ d, tag:null, tagClass:'' })),
    ...s.semData.map(d=>({ d, tag:'SEM DATA', tagClass:'tag-variavel' }))
  ];

  return `
    <div class="section-title">Situação de Caixa — Hoje</div>
    <div class="panel ${s.deficit?'card alert':''}" style="border-left-width:3px;">
      <div class="flex-between" style="align-items:flex-start; flex-wrap:wrap; gap:.5rem;">
        <div>
          <div class="card-label">Saldo em Conta</div>
          <div class="card-value">${formatCurrency(s.saldoAtual)}</div>
          <div class="card-sub">Atualizado em ${escapeHtml(atualizadoLabel)}</div>
        </div>
        <button class="btn btn-sm" id="btn-editar-saldo">✎ Atualizar Saldo</button>
      </div>
      <div class="divider"></div>
      ${s.deficit ? `
        <div class="text-sm" style="color:var(--alert-light);">
          ⚠ Risco de ficar no vermelho por volta do dia ${s.eventoCritico.dia}${s.eventoCritico.nome ? ' (após '+escapeHtml(s.eventoCritico.nome)+')' : ''}. Faltam ${formatCurrency(s.valorFaltante)} para cobrir tudo.
        </div>
      ` : `
        <div class="text-sm" style="color:var(--success);">
          ✓ O saldo cobre as contas com data até o fim do mês.
        </div>
      `}
      <div class="text-sm mt-1">
        ${s.reservaSegura>0
          ? `Pode guardar até <strong>${formatCurrency(s.reservaSegura)}</strong> na reserva com segurança este mês.`
          : `Sem margem para guardar reserva agora sem arriscar o saldo.`}
      </div>
    </div>

    ${itensPagamento.length ? `
    <div class="section-title">Ordem Sugerida de Pagamento</div>
    <div class="panel list">
      ${itensPagamento.map(({d,tag,tagClass})=>`
        <div class="row-item ${s.eventoCritico && s.eventoCritico.item===d ? 'card warn' : ''}">
          <div class="ri-main">
            <div class="ri-title">${escapeHtml(d.nome)} ${tag?`<span class="tag ${tagClass}">${tag}</span>`:''}</div>
            <div class="ri-sub">${d.vencimento ? 'vence dia '+escapeHtml(d.vencimento) : 'sem data — agende quando puder'}</div>
          </div>
          <div class="ri-value">${formatCurrency(d.valor)}</div>
        </div>
      `).join('')}
    </div>` : ''}
  `;
}

function openSaldoContaForm(onSaved){
  openModal(`
    <div class="modal-title">
      <h3 class="mb-0">Atualizar Saldo em Conta</h3>
      <button class="btn-icon" id="modal-close"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <form id="form-saldo">
      <div class="field">
        <label>Quanto você tem em conta agora (R$)</label>
        <input type="number" step="0.01" name="valor" required autofocus value="${STATE.saldoConta.valor||''}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar</button>
      </div>
    </form>
  `, {
    onMount:(root)=>{
      root.querySelector('#modal-close').addEventListener('click', closeModal);
      root.querySelector('#btn-cancel').addEventListener('click', closeModal);
      root.querySelector('#form-saldo').addEventListener('submit',(e)=>{
        e.preventDefault();
        const fd = new FormData(e.target);
        updateSaldoConta(Number(fd.get('valor')));
        closeModal();
        showToast('Saldo atualizado.');
        onSaved();
      });
    }
  });
}
