/* =========================================================
   view: Dívidas & Contas fixas
   ========================================================= */

const CATEGORIAS_DIVIDA = ['Moradia','Financiamento','Cartão','Empréstimo','Assinatura','Saúde','Educação','Transporte','Outros'];

function renderDividas(container){
  const mes = mesSelecionado;
  const lista = STATE.dividas.filter(d=>d.mes===mes).sort((a,b)=>(a.vencimento||99)-(b.vencimento||99));
  const total = lista.reduce((s,d)=>s+Number(d.valor||0),0);
  const totalPago = lista.filter(d=>d.status==='paga').reduce((s,d)=>s+Number(d.valor||0),0);
  const totalPendente = total - totalPago;

  container.innerHTML = `
    <div class="flex-between" style="margin-bottom:1rem;">
      <h1>Dívidas &amp; Contas</h1>
      ${monthNavHTML()}
    </div>
    <div class="stripe-bar"></div>

    <div class="grid">
      <div class="card">
        <div class="card-label">Total do Mês</div>
        <div class="card-value">${formatCurrency(total)}</div>
      </div>
      <div class="card">
        <div class="card-label">Pago</div>
        <div class="card-value pos">${formatCurrency(totalPago)}</div>
      </div>
      <div class="card ${totalPendente>0?'warn':''}">
        <div class="card-label">Pendente</div>
        <div class="card-value">${formatCurrency(totalPendente)}</div>
      </div>
    </div>

    <div class="panel-head mt-1">
      <h2 class="mb-0">Lançamentos — ${escapeHtml(formatMonthLabel(mes))}</h2>
      <button class="btn btn-primary" id="btn-add-divida">+ Nova Dívida</button>
    </div>

    <div class="list">
      ${lista.length ? lista.map(d=>`
        <div class="row-item">
          <div class="ri-main">
            <div class="ri-title">${escapeHtml(d.nome)} ${d.parcelas>1?`<span class="tag tag-olive">${d.parcelaAtual}/${d.parcelas}</span>`:''} ${d.variavel?'<span class="tag tag-variavel">VARIÁVEL</span>':''} ${d.recorrente?'<span class="tag tag-recorrente">RECORRENTE</span>':''}</div>
            <div class="ri-sub">${escapeHtml(d.categoria||'—')} · ${d.vencimento ? 'vence dia '+escapeHtml(d.vencimento) : 'sem data fixa'}
              <span class="tag ${d.status==='paga'?'tag-paga':'tag-pendente'}">${d.status==='paga'?'PAGA':'PENDENTE'}</span>
            </div>
          </div>
          <div class="ri-value">${formatCurrency(d.valor)}</div>
          <div class="ri-actions">
            <button class="btn btn-sm" data-toggle-status="${d.id}" title="Marcar como ${d.status==='paga'?'pendente':'paga'}">
              ${d.status==='paga' ? '↺' : '✓'}
            </button>
            <button class="btn btn-sm" data-edit-divida="${d.id}">✎</button>
            <button class="btn btn-sm btn-danger" data-del-divida="${d.id}">✕</button>
          </div>
        </div>
      `).join('') : `<div class="empty-state"><span class="es-ico">▦</span>Nenhuma dívida cadastrada para ${escapeHtml(formatMonthLabel(mes))}.<br><button class="btn btn-primary mt-1" id="btn-add-divida-empty">+ Cadastrar primeira dívida</button></div>`}
    </div>
  `;

  bindMonthNav(container, ()=>renderDividas(container));

  const openForm = (existing)=>openDividaForm(existing, ()=>renderDividas(container));
  container.querySelector('#btn-add-divida')?.addEventListener('click', ()=>openForm(null));
  container.querySelector('#btn-add-divida-empty')?.addEventListener('click', ()=>openForm(null));
  container.querySelectorAll('[data-edit-divida]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const item = STATE.dividas.find(x=>x.id===btn.dataset.editDivida);
      openForm(item);
    });
  });
  container.querySelectorAll('[data-del-divida]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(confirmAction('Excluir esta dívida?')){
        deleteDivida(btn.dataset.delDivida);
        renderDividas(container);
        showToast('Dívida excluída.');
      }
    });
  });
  container.querySelectorAll('[data-toggle-status]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const item = STATE.dividas.find(x=>x.id===btn.dataset.toggleStatus);
      updateDivida(item.id, { status: item.status==='paga' ? 'pendente' : 'paga' });
      renderDividas(container);
    });
  });
}

function openDividaForm(existing, onSaved){
  const isEdit = !!existing;
  const d = existing || { nome:'', categoria:CATEGORIAS_DIVIDA[0], valor:'', vencimento:'', parcelas:1, parcelaAtual:1, status:'pendente', mes: mesSelecionado, variavel:false, recorrente:false };

  openModal(`
    <div class="modal-title">
      <h3 class="mb-0">${isEdit?'Editar':'Nova'} Dívida / Conta</h3>
      <button class="btn-icon" id="modal-close"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <form id="form-divida">
      <div class="field">
        <label>Nome</label>
        <input type="text" name="nome" required value="${escapeHtml(d.nome)}" placeholder="Ex: Aluguel, Cartão Nubank...">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Categoria</label>
          <select name="categoria">${CATEGORIAS_DIVIDA.map(c=>`<option ${c===d.categoria?'selected':''}>${c}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label>Valor (R$)</label>
          <input type="number" step="0.01" min="0" name="valor" required value="${d.valor}">
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Dia de vencimento</label>
          <input type="number" min="1" max="31" name="vencimento" value="${d.vencimento||''}" placeholder="deixe em branco se não tiver dia fixo">
        </div>
        <div class="field">
          <label>Mês de referência</label>
          <input type="month" name="mes" required value="${d.mes}">
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Parcelas (total)</label>
          <input type="number" min="1" name="parcelas" value="${d.parcelas||1}">
        </div>
        <div class="field">
          <label>Parcela atual</label>
          <input type="number" min="1" name="parcelaAtual" value="${d.parcelaAtual||1}">
        </div>
      </div>
      <div class="checkbox-field field">
        <input type="checkbox" id="chk-paga" name="paga" ${d.status==='paga'?'checked':''}>
        <label for="chk-paga" style="margin:0;">Já está paga</label>
      </div>
      <div class="checkbox-field field">
        <input type="checkbox" id="chk-variavel" name="variavel" ${d.variavel?'checked':''}>
        <label for="chk-variavel" style="margin:0;">Conta variável (valor muda todo mês, ex: água, luz, fatura de cartão)</label>
      </div>
      <div class="checkbox-field field">
        <input type="checkbox" id="chk-recorrente" name="recorrente" ${d.recorrente?'checked':''}>
        <label for="chk-recorrente" style="margin:0;">Conta recorrente (repete todo mês — será copiada automaticamente ao fechar o mês)</label>
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
      root.querySelector('#form-divida').addEventListener('submit', (e)=>{
        e.preventDefault();
        const fd = new FormData(e.target);
        const vencRaw = fd.get('vencimento');
        const payload = {
          nome: fd.get('nome').trim(),
          categoria: fd.get('categoria'),
          valor: Number(fd.get('valor')),
          vencimento: vencRaw ? Number(vencRaw) : null,
          mes: fd.get('mes'),
          parcelas: Number(fd.get('parcelas'))||1,
          parcelaAtual: Number(fd.get('parcelaAtual'))||1,
          status: fd.get('paga') ? 'paga' : 'pendente',
          variavel: !!fd.get('variavel'),
          recorrente: !!fd.get('recorrente')
        };
        if(!payload.nome || !payload.valor || !payload.mes){
          showToast('Preencha todos os campos obrigatórios.', 'error'); return;
        }
        if(isEdit){ updateDivida(existing.id, payload); showToast('Dívida atualizada.'); }
        else { addDivida(payload); showToast('Dívida cadastrada.'); }
        closeModal();
        onSaved();
      });
    }
  });
}
