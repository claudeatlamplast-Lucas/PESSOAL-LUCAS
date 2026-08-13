/* =========================================================
   view: Gastos (lançamentos) + orçamento por categoria
   ========================================================= */

const FORMAS_PAGAMENTO = ['dinheiro','debito','credito'];
const FORMAS_PAGAMENTO_LABEL = { dinheiro:'Dinheiro', debito:'Débito', credito:'Crédito' };

let gastosFiltro = { categoria:'', inesperado:'' };

function renderGastos(container){
  const mes = mesSelecionado;
  let lista = STATE.gastos.filter(g=>g.mes===mes);
  if(gastosFiltro.categoria) lista = lista.filter(g=>g.categoria===gastosFiltro.categoria);
  if(gastosFiltro.inesperado==='sim') lista = lista.filter(g=>g.inesperado);
  if(gastosFiltro.inesperado==='nao') lista = lista.filter(g=>!g.inesperado);
  lista = lista.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||''));

  const orc = calcOrcamentoPorCategoria(mes);
  const totalGasto = STATE.gastos.filter(g=>g.mes===mes && !g.inesperado).reduce((s,g)=>s+Number(g.valor||0),0);
  const totalOrcado = Object.values(orc).reduce((s,c)=>s+c.orcamento,0);
  const totalInesperado = calcGastosInesperadosTotal(mes);

  container.innerHTML = `
    <div class="flex-between" style="margin-bottom:1rem;">
      <h1>Gastos</h1>
      ${monthNavHTML()}
    </div>
    <div class="stripe-bar"></div>

    <div class="grid">
      <div class="card ${totalGasto>totalOrcado?'alert':''}">
        <div class="card-label">Gasto do Mês (planejado)</div>
        <div class="card-value">${formatCurrency(totalGasto)}</div>
        <div class="card-sub">Orçado: ${formatCurrency(totalOrcado)}</div>
      </div>
      <div class="card ${totalInesperado>0?'warn':''}">
        <div class="card-label">Inesperados</div>
        <div class="card-value">${formatCurrency(totalInesperado)}</div>
      </div>
    </div>

    <div class="section-title">Orçamento por Categoria</div>
    <div class="panel list">
      ${Object.entries(orc).map(([cat,v])=>`
        <div>
          <div class="flex-between text-sm" style="margin-bottom:.25rem;">
            <span>${escapeHtml(categoriaLabel(cat))}</span>
            <span class="num">restam ${formatCurrency(v.restante)}</span>
          </div>
          ${progressBarHTML(v.percentualUsado)}
        </div>
      `).join('') || '<div class="empty-state">Configure as categorias em Config &amp; Backup.</div>'}
    </div>

    <div class="panel-head mt-1">
      <h2 class="mb-0">Lançamentos</h2>
      <button class="btn btn-primary" id="btn-add-gasto">+ Novo Gasto</button>
    </div>

    <div class="panel">
      <div class="field-row" style="margin-bottom:0;">
        <div class="field">
          <label>Filtrar categoria</label>
          <select id="filtro-categoria">
            <option value="">Todas</option>
            ${categoriaOptionsHTML(gastosFiltro.categoria)}
          </select>
        </div>
        <div class="field">
          <label>Tipo</label>
          <select id="filtro-inesperado">
            <option value="" ${gastosFiltro.inesperado===''?'selected':''}>Todos</option>
            <option value="nao" ${gastosFiltro.inesperado==='nao'?'selected':''}>Planejados</option>
            <option value="sim" ${gastosFiltro.inesperado==='sim'?'selected':''}>Inesperados</option>
          </select>
        </div>
      </div>
    </div>

    <div class="list">
      ${lista.length ? lista.map(g=>`
        <div class="row-item">
          <div class="ri-main">
            <div class="ri-title">${escapeHtml(g.descricao||categoriaLabel(g.categoria))} ${g.inesperado?'<span class="tag tag-inesperado">INESPERADO</span>':''}</div>
            <div class="ri-sub">${formatDate(g.data)} · ${escapeHtml(categoriaLabel(g.categoria))} · ${FORMAS_PAGAMENTO_LABEL[g.formaPagamento]||g.formaPagamento}</div>
          </div>
          <div class="ri-value">${formatCurrency(g.valor)}</div>
          <div class="ri-actions">
            <button class="btn btn-sm" data-edit-gasto="${g.id}">✎</button>
            <button class="btn btn-sm btn-danger" data-del-gasto="${g.id}">✕</button>
          </div>
        </div>
      `).join('') : `<div class="empty-state"><span class="es-ico">✕</span>Nenhum gasto lançado.</div>`}
    </div>
  `;

  bindMonthNav(container, ()=>renderGastos(container));

  container.querySelector('#btn-add-gasto').addEventListener('click', ()=>openGastoForm(null, ()=>renderGastos(container)));
  container.querySelectorAll('[data-edit-gasto]').forEach(btn=>{
    btn.addEventListener('click', ()=>openGastoForm(STATE.gastos.find(x=>x.id===btn.dataset.editGasto), ()=>renderGastos(container)));
  });
  container.querySelectorAll('[data-del-gasto]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(confirmAction('Excluir este gasto?')){
        deleteGasto(btn.dataset.delGasto);
        renderGastos(container);
        showToast('Gasto excluído.');
      }
    });
  });
  container.querySelector('#filtro-categoria').addEventListener('change', (e)=>{ gastosFiltro.categoria = e.target.value; renderGastos(container); });
  container.querySelector('#filtro-inesperado').addEventListener('change', (e)=>{ gastosFiltro.inesperado = e.target.value; renderGastos(container); });
}

function openGastoForm(existing, onSaved){
  const isEdit = !!existing;
  const catKeys = Object.keys(STATE.configOrcamento.percentuais);
  const g = existing || {
    data: new Date().toISOString().slice(0,10),
    categoria: catKeys[0] || 'outros',
    valor:'', descricao:'', formaPagamento:'debito', inesperado:false,
    mes: mesSelecionado
  };

  openModal(`
    <div class="modal-title">
      <h3 class="mb-0">${isEdit?'Editar':'Novo'} Gasto</h3>
      <button class="btn-icon" id="modal-close"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <form id="form-gasto">
      <div class="field-row">
        <div class="field">
          <label>Data</label>
          <input type="date" name="data" required value="${g.data}">
        </div>
        <div class="field">
          <label>Valor (R$)</label>
          <input type="number" step="0.01" min="0" name="valor" required value="${g.valor}">
        </div>
      </div>
      <div class="field">
        <label>Descrição</label>
        <input type="text" name="descricao" value="${escapeHtml(g.descricao)}" placeholder="Ex: Supermercado do mês">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Categoria</label>
          <select name="categoria">${categoriaOptionsHTML(g.categoria)}</select>
        </div>
        <div class="field">
          <label>Forma de pagamento</label>
          <select name="formaPagamento">${FORMAS_PAGAMENTO.map(f=>`<option value="${f}" ${f===g.formaPagamento?'selected':''}>${FORMAS_PAGAMENTO_LABEL[f]}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field">
        <label>Mês de referência (orçamento)</label>
        <input type="month" name="mes" required value="${g.mes}">
      </div>
      <div class="checkbox-field field">
        <input type="checkbox" id="chk-inesperado" name="inesperado" ${g.inesperado?'checked':''}>
        <label for="chk-inesperado" style="margin:0;">Gasto inesperado / emergencial (fora do orçamento)</label>
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
      root.querySelector('#form-gasto').addEventListener('submit', (e)=>{
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = {
          data: fd.get('data'),
          valor: Number(fd.get('valor')),
          descricao: fd.get('descricao').trim(),
          categoria: fd.get('categoria'),
          formaPagamento: fd.get('formaPagamento'),
          mes: fd.get('mes'),
          inesperado: !!fd.get('inesperado')
        };
        if(!payload.data || !payload.valor || !payload.mes){
          showToast('Preencha todos os campos obrigatórios.', 'error'); return;
        }
        if(isEdit){ updateGasto(existing.id, payload); showToast('Gasto atualizado.'); }
        else { addGasto(payload); showToast(`Gasto lançado. Saldo em conta: ${formatCurrency(STATE.saldoConta.valor)}.`); }
        closeModal();
        onSaved();
      });
    }
  });
}
