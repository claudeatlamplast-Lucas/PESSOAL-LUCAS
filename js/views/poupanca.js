/* =========================================================
   view: Poupança / Reserva de emergência
   ========================================================= */

function renderPoupanca(container){
  const totalPoupado = calcTotalPoupado();
  const metaReserva = Number(STATE.configOrcamento.metaReservaTotal||0);
  const metaMensal = Number(STATE.configOrcamento.metaPoupancaMensal||0);
  const poupadoNoMes = calcPoupadoNoMes(mesSelecionado);
  const pctReserva = metaReserva>0 ? (totalPoupado/metaReserva)*100 : 0;
  const porApp = calcPoupancaPorAplicacao();
  const donutData = Object.entries(porApp).map(([app,val],i)=>({ label: app, value: Math.max(val,0), color: CHART_COLORS[i % CHART_COLORS.length] }));
  const historico = STATE.poupanca.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||''));

  container.innerHTML = `
    <h1>Reserva &amp; Poupança</h1>
    <div class="stripe-bar"></div>

    <div class="panel">
      <div class="flex-between">
        <div>
          <div class="card-label">Reserva Total Acumulada</div>
          <div class="card-value pos">${formatCurrency(totalPoupado)}</div>
        </div>
        <div style="text-align:right;">
          <div class="card-label">Meta</div>
          <div class="card-value">${formatCurrency(metaReserva)}</div>
        </div>
      </div>
      ${metaReserva>0 ? `<div class="mt-1">${progressBarHTML(pctReserva)}<div class="progress-label"><span>${Math.min(100,Math.round(pctReserva))}%</span><span>${formatCurrency(Math.max(metaReserva-totalPoupado,0))} restante</span></div></div>` : `<p class="hint">Defina a meta de reserva total em Config &amp; Backup.</p>`}
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-label">Guardado em ${escapeHtml(formatMonthLabel(mesSelecionado))}</div>
        <div class="card-value">${formatCurrency(poupadoNoMes)}</div>
        <div class="card-sub">Meta mensal: ${formatCurrency(metaMensal)}</div>
        ${metaMensal>0?progressBarHTML(poupadoNoMes/metaMensal*100):''}
      </div>
    </div>

    ${donutData.length ? `
    <div class="section-title">Onde o dinheiro está guardado</div>
    <div class="panel">
      <div class="chart-wrap">
        ${donutChartSVG(donutData, 150)}
        ${legendHTML(donutData)}
      </div>
    </div>` : ''}

    <div class="panel-head mt-1">
      <h2 class="mb-0">Movimentações</h2>
      <button class="btn btn-primary" id="btn-add-poupanca">+ Registrar</button>
    </div>

    <div class="list">
      ${historico.length ? historico.map(p=>`
        <div class="row-item">
          <div class="ri-main">
            <div class="ri-title">${escapeHtml(p.aplicacao||'Não informado')} <span class="tag ${p.tipo==='saque'?'tag-inesperado':'tag-paga'}">${p.tipo==='saque'?'SAQUE':'APORTE'}</span></div>
            <div class="ri-sub">${formatDate(p.data)}</div>
          </div>
          <div class="ri-value ${p.tipo==='saque'?'neg':''}">${p.tipo==='saque'?'-':''}${formatCurrency(p.valor)}</div>
          <div class="ri-actions">
            <button class="btn btn-sm" data-edit-poupanca="${p.id}">✎</button>
            <button class="btn btn-sm btn-danger" data-del-poupanca="${p.id}">✕</button>
          </div>
        </div>
      `).join('') : '<div class="empty-state"><span class="es-ico">⛨</span>Nenhuma movimentação registrada ainda.</div>'}
    </div>
  `;

  container.querySelector('#btn-add-poupanca').addEventListener('click', ()=>openPoupancaForm(null, ()=>renderPoupanca(container)));
  container.querySelectorAll('[data-edit-poupanca]').forEach(btn=>{
    btn.addEventListener('click', ()=>openPoupancaForm(STATE.poupanca.find(x=>x.id===btn.dataset.editPoupanca), ()=>renderPoupanca(container)));
  });
  container.querySelectorAll('[data-del-poupanca]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(confirmAction('Excluir esta movimentação?')){
        deletePoupanca(btn.dataset.delPoupanca);
        renderPoupanca(container);
        showToast('Movimentação excluída.');
      }
    });
  });
}

function openPoupancaForm(existing, onSaved){
  const isEdit = !!existing;
  const p = existing || { valor:'', data: new Date().toISOString().slice(0,10), aplicacao:'', tipo:'aporte' };
  openModal(`
    <div class="modal-title">
      <h3 class="mb-0">${isEdit?'Editar':'Registrar'} Movimentação</h3>
      <button class="btn-icon" id="modal-close"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <form id="form-poupanca">
      <div class="field-row">
        <div class="field">
          <label>Tipo</label>
          <select name="tipo">
            <option value="aporte" ${p.tipo==='aporte'?'selected':''}>Aporte (guardar)</option>
            <option value="saque" ${p.tipo==='saque'?'selected':''}>Saque (resgatar)</option>
          </select>
        </div>
        <div class="field">
          <label>Valor (R$)</label>
          <input type="number" step="0.01" min="0" name="valor" required value="${p.valor}">
        </div>
      </div>
      <div class="field">
        <label>Data</label>
        <input type="date" name="data" required value="${p.data}">
      </div>
      <div class="field">
        <label>Aplicação (onde está guardado)</label>
        <input type="text" name="aplicacao" value="${escapeHtml(p.aplicacao)}" placeholder="Ex: Tesouro Selic, CDB, Poupança...">
      </div>
      <div class="form-actions">
        <button type="button" class="btn" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar</button>
      </div>
    </form>
  `, {
    onMount: (root)=>{
      root.querySelector('#modal-close').addEventListener('click', closeModal);
      root.querySelector('#btn-cancel').addEventListener('click', closeModal);
      root.querySelector('#form-poupanca').addEventListener('submit', (e)=>{
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = {
          tipo: fd.get('tipo'),
          valor: Number(fd.get('valor')),
          data: fd.get('data'),
          aplicacao: fd.get('aplicacao').trim()
        };
        if(!payload.valor || !payload.data){
          showToast('Preencha todos os campos obrigatórios.', 'error'); return;
        }
        if(isEdit){ updatePoupanca(existing.id, payload); showToast('Movimentação atualizada.'); }
        else { addPoupanca(payload); showToast('Movimentação registrada.'); }
        closeModal();
        onSaved();
      });
    }
  });
}
