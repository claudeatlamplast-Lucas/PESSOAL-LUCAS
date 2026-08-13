/* =========================================================
   view: Cartões de crédito
   ========================================================= */

let cartaoSelecionadoId = null;

function renderCartoes(container){
  if(STATE.cartoes.length && !STATE.cartoes.find(c=>c.id===cartaoSelecionadoId)){
    cartaoSelecionadoId = STATE.cartoes[0].id;
  }

  container.innerHTML = `
    <div class="flex-between" style="margin-bottom:1rem;">
      <h1>Cartões de Crédito</h1>
      <button class="btn btn-primary" id="btn-add-cartao">+ Novo Cartão</button>
    </div>
    <div class="stripe-bar"></div>

    ${STATE.cartoes.length ? `
      <div class="tabs" id="tabs-cartoes">
        ${STATE.cartoes.map(c=>`<button class="tab-btn ${c.id===cartaoSelecionadoId?'active':''}" data-cartao-tab="${c.id}">${escapeHtml(c.nome)}</button>`).join('')}
      </div>
      <div id="cartao-detail"></div>
    ` : `<div class="empty-state"><span class="es-ico">▮</span>Nenhum cartão cadastrado.<br><button class="btn btn-primary mt-1" id="btn-add-cartao-empty">+ Cadastrar cartão</button></div>`}
  `;

  container.querySelector('#btn-add-cartao')?.addEventListener('click', ()=>openCartaoForm(null, ()=>renderCartoes(container)));
  container.querySelector('#btn-add-cartao-empty')?.addEventListener('click', ()=>openCartaoForm(null, ()=>renderCartoes(container)));
  container.querySelectorAll('[data-cartao-tab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ cartaoSelecionadoId = btn.dataset.cartaoTab; renderCartoes(container); });
  });

  if(STATE.cartoes.length){
    renderCartaoDetail(container.querySelector('#cartao-detail'), container);
  }
}

function renderCartaoDetail(el, container){
  const cartao = STATE.cartoes.find(c=>c.id===cartaoSelecionadoId);
  if(!cartao) return;
  const faturas = faturasComprometidas(cartao.id);
  const hoje = new Date();
  const mesAtualFatura = mesFaturaInicial(hoje.toISOString().slice(0,10), cartao.fechamento);
  const mesAtualKey = mesKeyFromAnoMes(mesAtualFatura.ano, mesAtualFatura.mes);
  const faturaAtual = faturas.find(f=>f.mesFatura===mesAtualKey) || { total:0, itens:[] };
  const usoLimite = cartao.limite>0 ? (faturaAtual.total/Number(cartao.limite))*100 : 0;
  const futuras = faturas.filter(f=>f.mesFatura > mesAtualKey);

  el.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div>
          <div class="card-label">${escapeHtml(cartao.nome)}</div>
          <div class="text-sm text-muted">Fechamento dia ${escapeHtml(cartao.fechamento)} · Vencimento dia ${escapeHtml(cartao.vencimento)} · Limite ${formatCurrency(cartao.limite)}</div>
        </div>
        <div class="ri-actions">
          <button class="btn btn-sm" id="btn-edit-cartao">✎ Editar</button>
          <button class="btn btn-sm btn-danger" id="btn-del-cartao">✕ Excluir</button>
        </div>
      </div>
      <div class="grid">
        <div class="card">
          <div class="card-label">Fatura Atual (${escapeHtml(formatMonthLabel(mesAtualKey))})</div>
          <div class="card-value ${usoLimite>90?'neg':''}">${formatCurrency(faturaAtual.total)}</div>
          <div class="card-sub">Vence em ${dataVencimentoFatura(cartao, mesAtualKey).toLocaleDateString('pt-BR')}</div>
        </div>
        <div class="card ${usoLimite>=90?'alert':usoLimite>=70?'warn':''}">
          <div class="card-label">Limite Utilizado</div>
          <div class="card-value">${cartao.limite>0?Math.round(usoLimite)+'%':'—'}</div>
          ${cartao.limite>0?progressBarHTML(usoLimite):''}
        </div>
      </div>
    </div>

    <div class="panel-head mt-1">
      <h2 class="mb-0">Compras</h2>
      <button class="btn btn-primary" id="btn-add-compra">+ Nova Compra</button>
    </div>

    <div class="section-title">Fatura Atual</div>
    <div class="list">
      ${faturaAtual.itens.length ? faturaAtual.itens.map(({compra,parcela})=>`
        <div class="row-item">
          <div class="ri-main">
            <div class="ri-title">${escapeHtml(compra.descricao)} ${compra.parcelas>1?`<span class="tag tag-olive">${parcela.numero}/${compra.parcelas}</span>`:''}</div>
            <div class="ri-sub">${formatDate(compra.dataCompra)} · ${escapeHtml(categoriaLabel(compra.categoria))}</div>
          </div>
          <div class="ri-value">${formatCurrency(parcela.valor)}</div>
          <div class="ri-actions">
            <button class="btn btn-sm" data-edit-compra="${compra.id}">✎</button>
            <button class="btn btn-sm btn-danger" data-del-compra="${compra.id}">✕</button>
          </div>
        </div>
      `).join('') : '<div class="empty-state">Nenhuma compra na fatura atual.</div>'}
    </div>

    <div class="section-title">Faturas Futuras Comprometidas</div>
    <div class="list">
      ${futuras.length ? futuras.map(f=>`
        <div class="row-item">
          <div class="ri-main">
            <div class="ri-title">${escapeHtml(formatMonthLabel(f.mesFatura))}</div>
            <div class="ri-sub">Vence em ${f.vencimento.toLocaleDateString('pt-BR')} · ${f.itens.length} lançamento(s)</div>
          </div>
          <div class="ri-value">${formatCurrency(f.total)}</div>
        </div>
      `).join('') : '<div class="empty-state">Nenhum compromisso futuro no cartão.</div>'}
    </div>
  `;

  el.querySelector('#btn-edit-cartao').addEventListener('click', ()=>openCartaoForm(cartao, ()=>renderCartoes(container)));
  el.querySelector('#btn-del-cartao').addEventListener('click', ()=>{
    if(confirmAction(`Excluir o cartão "${cartao.nome}" e todas as suas compras?`)){
      deleteCartao(cartao.id);
      cartaoSelecionadoId = null;
      renderCartoes(container);
      showToast('Cartão excluído.');
    }
  });
  el.querySelector('#btn-add-compra').addEventListener('click', ()=>openCompraForm(null, cartao, ()=>renderCartoes(container)));
  el.querySelectorAll('[data-edit-compra]').forEach(btn=>{
    btn.addEventListener('click', ()=>openCompraForm(STATE.comprasCartao.find(x=>x.id===btn.dataset.editCompra), cartao, ()=>renderCartoes(container)));
  });
  el.querySelectorAll('[data-del-compra]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(confirmAction('Excluir esta compra e todas as parcelas futuras?')){
        deleteCompraCartao(btn.dataset.delCompra);
        renderCartoes(container);
        showToast('Compra excluída.');
      }
    });
  });
}

function openCartaoForm(existing, onSaved){
  const isEdit = !!existing;
  const c = existing || { nome:'', limite:'', fechamento:'', vencimento:'' };
  openModal(`
    <div class="modal-title">
      <h3 class="mb-0">${isEdit?'Editar':'Novo'} Cartão</h3>
      <button class="btn-icon" id="modal-close"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <form id="form-cartao">
      <div class="field">
        <label>Nome do cartão</label>
        <input type="text" name="nome" required value="${escapeHtml(c.nome)}" placeholder="Ex: Nubank, Inter...">
      </div>
      <div class="field">
        <label>Limite (R$)</label>
        <input type="number" step="0.01" min="0" name="limite" required value="${c.limite}">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Dia de fechamento</label>
          <input type="number" min="1" max="31" name="fechamento" required value="${c.fechamento}">
        </div>
        <div class="field">
          <label>Dia de vencimento</label>
          <input type="number" min="1" max="31" name="vencimento" required value="${c.vencimento}">
        </div>
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
      root.querySelector('#form-cartao').addEventListener('submit', (e)=>{
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = {
          nome: fd.get('nome').trim(),
          limite: Number(fd.get('limite')),
          fechamento: Number(fd.get('fechamento')),
          vencimento: Number(fd.get('vencimento'))
        };
        if(!payload.nome || !payload.fechamento || !payload.vencimento){
          showToast('Preencha todos os campos obrigatórios.', 'error'); return;
        }
        if(isEdit){ updateCartao(existing.id, payload); showToast('Cartão atualizado.'); }
        else { addCartao(payload); cartaoSelecionadoId = null; showToast('Cartão cadastrado.'); }
        closeModal();
        onSaved();
      });
    }
  });
}

function openCompraForm(existing, cartao, onSaved){
  const isEdit = !!existing;
  const catKeys = Object.keys(STATE.configOrcamento.percentuais);
  const c = existing || { descricao:'', valorTotal:'', parcelas:1, dataCompra: new Date().toISOString().slice(0,10), categoria: catKeys[0]||'outros' };

  openModal(`
    <div class="modal-title">
      <h3 class="mb-0">${isEdit?'Editar':'Nova'} Compra — ${escapeHtml(cartao.nome)}</h3>
      <button class="btn-icon" id="modal-close"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <form id="form-compra">
      <div class="field">
        <label>Descrição</label>
        <input type="text" name="descricao" required value="${escapeHtml(c.descricao)}" placeholder="Ex: Notebook, Passagem...">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Valor total (R$)</label>
          <input type="number" step="0.01" min="0" name="valorTotal" required value="${c.valorTotal}">
        </div>
        <div class="field">
          <label>Parcelas</label>
          <input type="number" min="1" max="48" name="parcelas" required value="${c.parcelas}">
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Data da compra</label>
          <input type="date" name="dataCompra" required value="${c.dataCompra}">
        </div>
        <div class="field">
          <label>Categoria</label>
          <select name="categoria">${categoriaOptionsHTML(c.categoria)}</select>
        </div>
      </div>
      <p class="hint">As parcelas futuras são geradas automaticamente com base no fechamento (dia ${escapeHtml(cartao.fechamento)}) do cartão.</p>
      <div class="form-actions">
        <button type="button" class="btn" id="btn-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar</button>
      </div>
    </form>
  `, {
    onMount: (root)=>{
      root.querySelector('#modal-close').addEventListener('click', closeModal);
      root.querySelector('#btn-cancel').addEventListener('click', closeModal);
      root.querySelector('#form-compra').addEventListener('submit', (e)=>{
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = {
          cartaoId: cartao.id,
          descricao: fd.get('descricao').trim(),
          valorTotal: Number(fd.get('valorTotal')),
          parcelas: Number(fd.get('parcelas'))||1,
          dataCompra: fd.get('dataCompra'),
          categoria: fd.get('categoria')
        };
        if(!payload.descricao || !payload.valorTotal || !payload.dataCompra){
          showToast('Preencha todos os campos obrigatórios.', 'error'); return;
        }
        if(isEdit){ updateCompraCartao(existing.id, payload); showToast('Compra atualizada.'); }
        else { addCompraCartao(payload); showToast('Compra lançada.'); }
        closeModal();
        onSaved();
      });
    }
  });
}
