/* =========================================================
   view: Receitas
   ========================================================= */

function renderReceitas(container){
  const mes = mesSelecionado;
  const lista = STATE.receitas.filter(r=>r.mes===mes).sort((a,b)=>(a.data||'').localeCompare(b.data||''));
  const total = lista.reduce((s,r)=>s+Number(r.valor||0),0);

  container.innerHTML = `
    <div class="flex-between" style="margin-bottom:1rem;">
      <h1>Receitas</h1>
      ${monthNavHTML()}
    </div>
    <div class="stripe-bar"></div>

    <div class="card" style="max-width:320px;">
      <div class="card-label">Total Recebido — ${escapeHtml(formatMonthLabel(mes))}</div>
      <div class="card-value pos">${formatCurrency(total)}</div>
    </div>

    <div class="panel-head mt-1">
      <h2 class="mb-0">Fontes de Renda</h2>
      <button class="btn btn-primary" id="btn-add-receita">+ Nova Receita</button>
    </div>

    <div class="list">
      ${lista.length ? lista.map(r=>`
        <div class="row-item">
          <div class="ri-main">
            <div class="ri-title">${escapeHtml(r.fonte)} ${r.variavel?'<span class="tag tag-olive">VARIÁVEL</span>':''}</div>
            <div class="ri-sub">Recebido em ${formatDate(r.data)}</div>
          </div>
          <div class="ri-value">${formatCurrency(r.valor)}</div>
          <div class="ri-actions">
            <button class="btn btn-sm" data-edit-receita="${r.id}">✎</button>
            <button class="btn btn-sm btn-danger" data-del-receita="${r.id}">✕</button>
          </div>
        </div>
      `).join('') : `<div class="empty-state"><span class="es-ico">▲</span>Nenhuma receita lançada para ${escapeHtml(formatMonthLabel(mes))}.<br><button class="btn btn-primary mt-1" id="btn-add-receita-empty">+ Cadastrar receita</button></div>`}
    </div>
  `;

  bindMonthNav(container, ()=>renderReceitas(container));

  const openForm = (existing)=>openReceitaForm(existing, ()=>renderReceitas(container));
  container.querySelector('#btn-add-receita')?.addEventListener('click', ()=>openForm(null));
  container.querySelector('#btn-add-receita-empty')?.addEventListener('click', ()=>openForm(null));
  container.querySelectorAll('[data-edit-receita]').forEach(btn=>{
    btn.addEventListener('click', ()=>openForm(STATE.receitas.find(x=>x.id===btn.dataset.editReceita)));
  });
  container.querySelectorAll('[data-del-receita]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(confirmAction('Excluir esta receita?')){
        deleteReceita(btn.dataset.delReceita);
        renderReceitas(container);
        showToast('Receita excluída.');
      }
    });
  });
}

function openReceitaForm(existing, onSaved){
  const isEdit = !!existing;
  const r = existing || { fonte:'', valor:'', data: mesSelecionado+'-05', variavel:false, mes: mesSelecionado };

  openModal(`
    <div class="modal-title">
      <h3 class="mb-0">${isEdit?'Editar':'Nova'} Receita</h3>
      <button class="btn-icon" id="modal-close"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <form id="form-receita">
      <div class="field">
        <label>Fonte</label>
        <input type="text" name="fonte" required value="${escapeHtml(r.fonte)}" placeholder="Ex: Salário, Freelance...">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Valor (R$)</label>
          <input type="number" step="0.01" min="0" name="valor" required value="${r.valor}">
        </div>
        <div class="field">
          <label>Data de recebimento</label>
          <input type="date" name="data" required value="${r.data}">
        </div>
      </div>
      <div class="field">
        <label>Mês de referência</label>
        <input type="month" name="mes" required value="${r.mes}">
      </div>
      <div class="checkbox-field field">
        <input type="checkbox" id="chk-variavel" name="variavel" ${r.variavel?'checked':''}>
        <label for="chk-variavel" style="margin:0;">Receita variável (valor muda todo mês)</label>
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
      root.querySelector('#form-receita').addEventListener('submit', (e)=>{
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = {
          fonte: fd.get('fonte').trim(),
          valor: Number(fd.get('valor')),
          data: fd.get('data'),
          mes: fd.get('mes'),
          variavel: !!fd.get('variavel')
        };
        if(!payload.fonte || !payload.valor || !payload.data || !payload.mes){
          showToast('Preencha todos os campos obrigatórios.', 'error'); return;
        }
        if(isEdit){ updateReceita(existing.id, payload); showToast('Receita atualizada.'); }
        else { addReceita(payload); showToast('Receita cadastrada.'); }
        closeModal();
        onSaved();
      });
    }
  });
}
