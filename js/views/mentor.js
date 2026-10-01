/* =========================================================
   view: Mentor de Gastos e Estratégias
   ========================================================= */

const STATUS_PAGAMENTO = {
  atrasada: { tag:'ATRASADA', classe:'tag-inesperado' },
  apertado: { tag:'APERTADO', classe:'tag-variavel' },
  tranquilo:{ tag:'TRANQUILO', classe:'tag-paga' },
  flexivel: { tag:'FLEXÍVEL', classe:'tag-olive' },
  atencao:  { tag:'ATENÇÃO', classe:'tag-variavel' }
};

function renderMentor(container){
  const m = calcMentor();
  const c = m.caixa;

  const heroMsg = c.deficit
    ? { titulo:'⚠ Cuidado com o vermelho', texto:`No ritmo atual, o saldo fica negativo perto do dia ${c.eventoCritico ? c.eventoCritico.dia : '?'}${c.eventoCritico && c.eventoCritico.nome ? ' (após '+c.eventoCritico.nome+')' : ''}. Faltam ${formatCurrency(c.valorFaltante)} pra cobrir tudo — veja abaixo a ordem de prioridade.`, classe:'alert' }
    : { titulo:'✓ Mês sob controle', texto:`As contas com data cabem no seu saldo. Dá pra guardar ${formatCurrency(c.reservaSegura)} com segurança este mês.`, classe:'' };

  container.innerHTML = `
    <h1>🎯 Mentor de Gastos</h1>
    <div class="stripe-bar"></div>

    <div class="panel card ${heroMsg.classe}" style="border-left-width:3px;">
      <div class="card-label">${heroMsg.titulo}</div>
      <p class="text-sm" style="margin:.4rem 0 0;">${escapeHtml(heroMsg.texto)}</p>
    </div>

    <div class="section-title">Quando Pagar Cada Conta</div>
    <div class="panel list">
      ${m.pagamentos.length ? m.pagamentos.map(p=>{
        const st = STATUS_PAGAMENTO[p.status];
        return `
        <div class="row-item">
          <div class="ri-main">
            <div class="ri-title">${escapeHtml(p.divida.nome)} <span class="tag ${st.classe}">${st.tag}</span></div>
            <div class="ri-sub">${escapeHtml(p.mensagem)}</div>
          </div>
          <div class="ri-value">${formatCurrency(p.divida.valor)}</div>
        </div>
      `;}).join('') : '<div class="empty-state"><span class="es-ico">✓</span>Nenhuma conta pendente este mês.</div>'}
    </div>

    <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(260px,1fr));">
      <div>
        <div class="section-title">Melhor Dia pro Mercado</div>
        <div class="panel">
          ${m.mercado ? `
            <div class="card-label">Dia ${m.mercado.dia} — ${escapeHtml(categoriaLabel(m.mercado.categoria))}</div>
            <div class="card-value">${formatCurrency(m.mercado.valor)}</div>
            <div class="card-sub">Valor que cabe no orçamento sem arriscar o saldo do mês.</div>
          ` : '<p class="hint">Configure as categorias variáveis em Config &amp; Backup.</p>'}
        </div>
      </div>
      <div>
        <div class="section-title">Melhor Dia e Valor pra Guardar</div>
        <div class="panel">
          <div class="card-label">${m.poupanca.valor>0 ? 'Dia '+m.poupanca.dia : 'Ainda sem margem'}</div>
          <div class="card-value ${m.poupanca.valor>0?'pos':''}">${formatCurrency(m.poupanca.valor)}</div>
          <div class="card-sub">${m.poupanca.valor>0 ? 'Guardar agora evita gastar por impulso depois.' : 'Resolva o aperto de caixa antes de guardar.'}</div>
        </div>
      </div>
    </div>

    <div class="section-title">Projeção — Próximos Meses</div>
    <div class="panel list">
      ${m.projecao.map(p=>`
        <div class="row-item ${p.deficit?'card alert':''}">
          <div class="ri-main">
            <div class="ri-title">${escapeHtml(formatMonthLabel(p.mes))} ${p.atual?'<span class="tag tag-olive">ATUAL</span>':''}</div>
            <div class="ri-sub">${p.atual
              ? (p.deficit ? 'projeção do mês fecha no vermelho' : 'projeção do mês positiva')
              : (p.temDados ? (p.deficit ? 'projeção fecha no vermelho' : 'projeção positiva') : 'sem dívidas/receitas cadastradas ainda')}</div>
          </div>
          <div class="ri-value" style="color:${p.saldoFinal>=0?'var(--success)':'var(--alert-light)'}">${formatCurrency(p.saldoFinal)}</div>
        </div>
      `).join('')}
    </div>
    <p class="hint">Os meses futuros usam as dívidas e receitas já cadastradas e o orçamento variável configurado. Use "🗓️ Preparar Próximo Mês" no QG pra copiar as contas fixas e receitas recorrentes automaticamente.</p>

    <div class="section-title">Estratégias Gerais</div>
    <div class="panel list">
      ${m.estrategias.length ? m.estrategias.map(t=>`
        <div class="row-item"><div class="ri-main"><div class="ri-title" style="white-space:normal;">💡 ${escapeHtml(t)}</div></div></div>
      `).join('') : '<div class="empty-state">Cadastre receitas e dívidas pra ver estratégias.</div>'}
    </div>

    <div class="section-title">Simular Cenário</div>
    <div class="panel">
      <p class="hint">Teste "e se eu pagar/agendar essa conta em outro dia" — não altera nada salvo, é só simulação.</p>
      <form id="form-simular">
        <div class="field-row" style="align-items:flex-end;">
          <div class="field">
            <label>Conta</label>
            <select name="dividaId">${simularOptionsHTML()}</select>
          </div>
          <div class="field">
            <label>Novo dia (em branco = sem data)</label>
            <input type="number" min="1" max="31" name="novoDia" placeholder="Ex: 25">
          </div>
          <div class="field" style="flex:0;">
            <button type="submit" class="btn btn-primary">Simular</button>
          </div>
        </div>
      </form>
      <div id="resultado-simulacao"></div>
    </div>
  `;

  container.querySelector('#form-simular').addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const dividaId = fd.get('dividaId');
    if(!dividaId){ showToast('Escolha uma conta.', 'error'); return; }
    const divida = STATE.dividas.find(x=>x.id===dividaId);
    const antes = calcSituacaoCaixa();
    const depois = calcSimulacaoCenario(dividaId, fd.get('novoDia'));

    document.getElementById('resultado-simulacao').innerHTML = `
      <div class="divider"></div>
      <div class="grid" style="grid-template-columns:1fr 1fr;">
        <div class="card">
          <div class="card-label">Cenário Atual</div>
          <div class="card-value ${antes.deficit?'neg':'pos'}">${antes.deficit ? '−'+formatCurrency(antes.valorFaltante) : formatCurrency(antes.reservaSegura)}</div>
          <div class="card-sub">${antes.deficit ? 'fica no vermelho' : 'sobra pra guardar'}</div>
        </div>
        <div class="card ${depois.deficit ? 'alert' : ''}">
          <div class="card-label">Se pagar "${escapeHtml(divida.nome)}" ${fd.get('novoDia') ? 'no dia '+escapeHtml(fd.get('novoDia')) : 'sem data'}</div>
          <div class="card-value ${depois.deficit?'neg':'pos'}">${depois.deficit ? '−'+formatCurrency(depois.valorFaltante) : formatCurrency(depois.reservaSegura)}</div>
          <div class="card-sub">${depois.deficit ? 'fica no vermelho' : 'sobra pra guardar'}</div>
        </div>
      </div>
    `;
  });
}

function simularOptionsHTML(){
  const mes = currentMonthKey();
  const pendentes = STATE.dividas.filter(d=>d.mes===mes && d.status!=='paga');
  if(!pendentes.length) return '<option value="">Nenhuma conta pendente</option>';
  return pendentes.map(d=>`<option value="${d.id}">${escapeHtml(d.nome)} (${formatCurrency(d.valor)})</option>`).join('');
}
