/* =========================================================
   fechamento.js — resumo de fechamento do mês e abertura do próximo
   ========================================================= */

function openResumoMesModal(mes, opts){
  opts = opts || {};
  const r = calcResumoMes(mes);
  const proximoMes = shiftMonthKey(mes, 1);

  openModal(`
    <div class="modal-title">
      <h3 class="mb-0">Resumo — ${escapeHtml(formatMonthLabel(mes))}</h3>
      <button class="btn-icon" id="modal-close"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <p class="hint">Ao fechar, o relatório completo de ${escapeHtml(formatMonthLabel(mes))} fica salvo na aba Relatório do Mês.</p>
    ${opts.automatico ? `<p class="hint">O calendário virou o mês — aqui está o fechamento de ${escapeHtml(formatMonthLabel(mes))} antes de seguir para ${escapeHtml(formatMonthLabel(proximoMes))}.</p>` : ''}

    <div class="grid" style="grid-template-columns:1fr 1fr;">
      <div class="card">
        <div class="card-label">Receita Total</div>
        <div class="card-value pos">${formatCurrency(r.receita)}</div>
      </div>
      <div class="card ${r.dividasEmAberto.length?'warn':''}">
        <div class="card-label">Dívidas</div>
        <div class="card-value">${formatCurrency(r.dividasTotal)}</div>
        <div class="card-sub">${r.dividasEmAberto.length} em aberto · ${r.dividasPagas.length} pagas</div>
      </div>
      <div class="card">
        <div class="card-label">Gasto Variável</div>
        <div class="card-value">${formatCurrency(r.gastoVariavelTotal)}</div>
        <div class="card-sub">de ${formatCurrency(r.orcVariavelTotal)} orçado</div>
      </div>
      <div class="card ${r.inesperados>0?'warn':''}">
        <div class="card-label">Inesperados</div>
        <div class="card-value">${formatCurrency(r.inesperados)}</div>
      </div>
    </div>

    <div class="panel mt-1">
      <div class="flex-between">
        <span class="text-sm">Guardado na reserva este mês</span>
        <span class="num">${formatCurrency(r.poupadoNoMes)}</span>
      </div>
      <div class="divider"></div>
      <div class="flex-between">
        <span class="text-sm"><strong>Saldo final do mês</strong></span>
        <span class="num" style="font-size:1.1rem; color:${r.saldoFinal>=0?'var(--success)':'var(--alert-light)'}">${formatCurrency(r.saldoFinal)}</span>
      </div>
    </div>

    ${r.dividasEmAberto.length ? `
    <div class="section-title">Ficaram em aberto</div>
    <div class="list">
      ${r.dividasEmAberto.map(d=>`
        <div class="row-item">
          <div class="ri-main">
            <div class="ri-title">${escapeHtml(d.nome)}</div>
            <div class="ri-sub">${escapeHtml(d.categoria||'')}</div>
          </div>
          <div class="ri-value">${formatCurrency(d.valor)}</div>
        </div>
      `).join('')}
    </div>` : ''}

    ${opts.podeFechar ? `
      <div class="section-title">Abrir ${escapeHtml(formatMonthLabel(proximoMes))}</div>
      <p class="text-sm text-muted">
        ${r.recorrentes.length
          ? `${r.recorrentes.length} conta(s) recorrente(s) serão copiadas para ${escapeHtml(formatMonthLabel(proximoMes))} como pendentes: <strong>${r.recorrentes.map(d=>escapeHtml(d.nome)).join(', ')}</strong>.`
          : 'Nenhuma conta marcada como recorrente — nada será copiado automaticamente.'}
      </p>
      <div class="form-actions">
        <button type="button" class="btn" id="btn-fechar-depois">${opts.automatico ? 'Decidir depois' : 'Cancelar'}</button>
        <button type="button" class="btn btn-primary" id="btn-fechar-mes">Fechar mês e abrir ${escapeHtml(formatMonthLabel(proximoMes))}</button>
      </div>
    ` : `
      <div class="form-actions">
        <button type="button" class="btn" id="btn-fechar-depois">Fechar</button>
      </div>
    `}
  `, {
    onMount: (root)=>{
      root.querySelector('#modal-close').addEventListener('click', closeModal);
      root.querySelector('#btn-fechar-depois').addEventListener('click', ()=>{
        if(opts.automatico) marcarMesAberto(mes);
        closeModal();
      });
      root.querySelector('#btn-fechar-mes')?.addEventListener('click', ()=>{
        const novoMes = fecharMes(mes);
        mesSelecionado = mes; // mostra o relatório do mês que acabou de fechar
        closeModal();
        showToast(`${formatMonthLabel(mes)} fechado. ${formatMonthLabel(novoMes)} está em vigência.`);
        if(window.location.hash === '#/relatorio') renderCurrentRoute();
        else window.location.hash = '#/relatorio';
      });
    }
  });
}

/** Chamado na inicialização: se o mês virou desde a última vez que o app foi aberto, sugere o fechamento. */
function checkAutoFechamento(){
  const mesAtual = currentMonthKey();
  if(!STATE.ultimoMesAberto){
    marcarMesAberto(mesAtual);
    return;
  }
  if(STATE.ultimoMesAberto === mesAtual) return;
  const temDados = STATE.dividas.some(d=>d.mes===STATE.ultimoMesAberto) || STATE.receitas.some(r=>r.mes===STATE.ultimoMesAberto);
  if(!temDados){
    marcarMesAberto(mesAtual);
    return;
  }
  openResumoMesModal(STATE.ultimoMesAberto, { podeFechar:true, automatico:true });
}
