/* =========================================================
   view: Config & Backup
   ========================================================= */

function renderConfig(container){
  const cfg = STATE.configOrcamento;
  const soma = somaPercentuais();

  container.innerHTML = `
    <h1>Config &amp; Backup</h1>
    <div class="stripe-bar"></div>

    <div class="section-title">Categorias Variáveis &amp; Percentuais</div>
    <div class="panel">
      <p class="hint">O saldo livre do mês (receitas − dívidas − meta de poupança) é dividido entre estas categorias conforme o percentual definido.</p>
      <div class="list" id="lista-categorias">
        ${Object.keys(cfg.percentuais).map(cat=>`
          <div class="row-item">
            <div class="ri-main">
              <div class="ri-title">${escapeHtml(cfg.categoriasLabel[cat] || cat)}</div>
            </div>
            <div class="field" style="width:110px; margin:0;">
              <input type="number" min="0" max="100" class="input-percentual" data-cat="${escapeHtml(cat)}" value="${cfg.percentuais[cat]}">
            </div>
            <div class="ri-actions">
              <button class="btn btn-sm btn-danger" data-del-cat="${escapeHtml(cat)}">✕</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="flex-between mt-1">
        <span class="text-sm ${soma!==100?'text-warn':''}" style="color:${soma===100?'var(--success)':'var(--warn)'}">Soma atual: ${soma}% ${soma!==100?'(ideal: 100%)':''}</span>
        <button class="btn btn-primary btn-sm" id="btn-salvar-percentuais">Salvar Percentuais</button>
      </div>

      <div class="divider"></div>

      <div class="field-row" style="align-items:flex-end;">
        <div class="field">
          <label>Nova categoria</label>
          <input type="text" id="nova-cat-nome" placeholder="Ex: Pets, Academia...">
        </div>
        <div class="field" style="max-width:110px;">
          <label>%</label>
          <input type="number" id="nova-cat-pct" min="0" max="100" value="0">
        </div>
        <div class="field" style="flex:0;">
          <button class="btn" id="btn-add-categoria">+ Adicionar</button>
        </div>
      </div>
    </div>

    <div class="section-title">Metas de Poupança</div>
    <div class="panel">
      <form id="form-metas">
        <div class="field-row">
          <div class="field">
            <label>Meta de poupança mensal (R$)</label>
            <input type="number" step="0.01" min="0" name="metaPoupancaMensal" value="${cfg.metaPoupancaMensal}">
          </div>
          <div class="field">
            <label>Meta de reserva de emergência total (R$)</label>
            <input type="number" step="0.01" min="0" name="metaReservaTotal" value="${cfg.metaReservaTotal}">
          </div>
        </div>
        <button type="submit" class="btn btn-primary">Salvar Metas</button>
      </form>
    </div>

    <div class="section-title">Backup dos Dados</div>
    <div class="panel">
      <p class="hint">Seus dados ficam salvos apenas neste navegador. Exporte periodicamente para não perder nada.</p>
      <div class="flex gap-sm" style="flex-wrap:wrap;">
        <button class="btn btn-primary" id="btn-export">⭳ Exportar Backup (JSON)</button>
        <button class="btn" id="btn-merge-trigger">⭱ Importar e Mesclar (adicionar)</button>
        <button class="btn" id="btn-import-trigger">⭱ Importar Backup (substituir tudo)</button>
        <input type="file" id="input-merge" accept="application/json" style="display:none;">
        <input type="file" id="input-import" accept="application/json" style="display:none;">
      </div>
      <p class="hint">"Importar e Mesclar" soma novos itens sem apagar o que já está salvo — use para arquivos parciais (ex: só dívidas, só receitas). "Importar Backup" substitui tudo.</p>
    </div>

    <div class="section-title">Segurança</div>
    <div class="panel">
      <p class="hint">Este aparelho fica destravado até você bloquear de novo ou apagar os dados do navegador.</p>
      <button class="btn" id="btn-bloquear">🔒 Bloquear Agora</button>
    </div>

    <div class="section-title">Zona de Risco</div>
    <div class="panel card alert" style="border-left-width:3px;">
      <div class="card-label">Apagar todos os dados</div>
      <p class="text-sm">Isso remove permanentemente dívidas, receitas, gastos, cartões e reserva salvos neste navegador. Exporte um backup antes.</p>
      <button class="btn btn-danger" id="btn-reset">Apagar Tudo</button>
    </div>
  `;

  container.querySelectorAll('[data-del-cat]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(Object.keys(cfg.percentuais).length<=1){ showToast('Mantenha ao menos uma categoria.', 'error'); return; }
      if(confirmAction('Remover esta categoria? Gastos já lançados nela permanecem, mas ela some do orçamento.')){
        removeCategoriaVariavel(btn.dataset.delCat);
        renderConfig(container);
        showToast('Categoria removida.');
      }
    });
  });

  container.querySelector('#btn-salvar-percentuais').addEventListener('click', ()=>{
    const novos = {};
    container.querySelectorAll('.input-percentual').forEach(inp=>{
      novos[inp.dataset.cat] = Number(inp.value)||0;
    });
    setPercentuais(novos);
    showToast('Percentuais salvos.');
    renderConfig(container);
  });

  container.querySelector('#btn-add-categoria').addEventListener('click', ()=>{
    const nomeInput = container.querySelector('#nova-cat-nome');
    const pctInput = container.querySelector('#nova-cat-pct');
    const nome = nomeInput.value.trim();
    if(!nome){ showToast('Informe um nome para a categoria.', 'error'); return; }
    const chave = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    if(!chave || cfg.percentuais[chave]){ showToast('Categoria inválida ou já existe.', 'error'); return; }
    addCategoriaVariavel(chave, nome, Number(pctInput.value)||0);
    showToast('Categoria adicionada.');
    renderConfig(container);
  });

  container.querySelector('#form-metas').addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    updateConfigOrcamento({
      metaPoupancaMensal: Number(fd.get('metaPoupancaMensal'))||0,
      metaReservaTotal: Number(fd.get('metaReservaTotal'))||0
    });
    showToast('Metas salvas.');
  });

  container.querySelector('#btn-export').addEventListener('click', ()=>{
    exportBackup();
    showToast('Backup exportado.');
  });

  container.querySelector('#btn-import-trigger').addEventListener('click', ()=>{
    container.querySelector('#input-import').click();
  });
  container.querySelector('#input-import').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    if(!confirmAction('Importar este backup vai substituir TODOS os dados atuais. Continuar?')) { e.target.value=''; return; }
    importBackupFromFile(file, ()=>{
      showToast('Backup importado com sucesso.');
      renderCurrentRoute();
    }, (err)=>{
      console.error(err);
      showToast('Arquivo inválido. Verifique se é um backup exportado por este app.', 'error');
    });
    e.target.value = '';
  });

  container.querySelector('#btn-merge-trigger').addEventListener('click', ()=>{
    container.querySelector('#input-merge').click();
  });
  container.querySelector('#input-merge').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    mergeBackupFromFile(file, (adicionados)=>{
      showToast(`${adicionados} item(ns) adicionado(s) sem apagar o resto.`);
      renderCurrentRoute();
    }, (err)=>{
      console.error(err);
      showToast('Arquivo inválido.', 'error');
    });
    e.target.value = '';
  });

  container.querySelector('#btn-reset').addEventListener('click', ()=>{
    if(confirmAction('Tem certeza? Isso apaga TODOS os dados permanentemente.') && confirmAction('Confirmar de novo: apagar tudo mesmo?')){
      resetAllData();
      showToast('Todos os dados foram apagados.');
      renderCurrentRoute();
    }
  });

  container.querySelector('#btn-bloquear').addEventListener('click', ()=>{
    trancarApp();
  });
}
