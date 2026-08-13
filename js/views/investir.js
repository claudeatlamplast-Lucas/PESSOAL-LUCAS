/* =========================================================
   view: Investir — conteúdo educativo (não é recomendação formal)
   ========================================================= */

const OPCOES_INVESTIMENTO = [
  {
    chave: 'tesouro-selic',
    nome: 'Tesouro Selic',
    resumo: 'Título público pós-fixado atrelado à taxa Selic. Referência de segurança e liquidez no Brasil.',
    pros: ['Baixíssimo risco (garantido pelo Governo Federal)', 'Liquidez diária', 'Bom para reserva de emergência'],
    contras: ['Rendimento líquido reduzido por IR regressivo em resgates de curto prazo', 'Pode ter pequena oscilação de preço (marcação a mercado) se resgatado antes do vencimento'],
    perfil: ['conservador','moderado','arrojado'], prazo: ['curto','medio','longo'], liquidez:['sim','nao']
  },
  {
    chave: 'cdb-liquidez-diaria',
    nome: 'CDB com liquidez diária',
    resumo: 'Empréstimo que você faz ao banco, com resgate disponível a qualquer momento (geralmente 100%+ do CDI).',
    pros: ['Liquidez diária', 'Protegido pelo FGC até R$ 250 mil por CPF/instituição', 'Simples de contratar'],
    contras: ['Rendimento depende do banco (compare o % do CDI)', 'Nem todo CDB tem liquidez diária real'],
    perfil: ['conservador','moderado'], prazo: ['curto'], liquidez:['sim']
  },
  {
    chave: 'fundos-di',
    nome: 'Fundos DI',
    resumo: 'Fundos que investem majoritariamente em títulos pós-fixados atrelados ao CDI/Selic.',
    pros: ['Gestão profissional', 'Diversificação automática', 'Boa liquidez na maioria dos fundos'],
    contras: ['Taxa de administração pode corroer o rendimento', 'Não tem garantia do FGC'],
    perfil: ['conservador','moderado'], prazo: ['curto','medio'], liquidez:['sim']
  },
  {
    chave: 'cdb-prazo',
    nome: 'CDB com carência/prazo',
    resumo: 'Mesma lógica do CDB, mas com prazo definido para resgate — costuma pagar taxas melhores.',
    pros: ['Rende mais que opções de liquidez diária', 'Protegido pelo FGC'],
    contras: ['Dinheiro fica preso até o vencimento (ou com perdas em resgate antecipado)', 'Não indicado para reserva de emergência'],
    perfil: ['moderado','arrojado'], prazo: ['medio','longo'], liquidez:['nao']
  },
  {
    chave: 'lci-lca',
    nome: 'LCI / LCA',
    resumo: 'Letras de crédito imobiliário/agronegócio, isentas de Imposto de Renda para pessoa física.',
    pros: ['Isenção de IR aumenta o rendimento líquido', 'Protegido pelo FGC'],
    contras: ['Geralmente exige prazo mínimo de carência', 'Menos flexível que o Tesouro Selic'],
    perfil: ['moderado','arrojado'], prazo: ['medio','longo'], liquidez:['nao']
  }
];

function renderInvestir(container){
  container.innerHTML = `
    <h1>Inteligência — Educação Financeira</h1>
    <div class="stripe-bar"></div>

    <div class="panel card warn" style="border-left-width:3px;">
      <div class="card-label">⚠ Aviso</div>
      <div class="text-sm">Este conteúdo é educativo e genérico — <strong>não é uma recomendação de investimento personalizada</strong>. Antes de investir, avalie sua situação com uma corretora ou assessor qualificado.</div>
    </div>

    <div class="section-title">Responda para adaptar a sugestão</div>
    <div class="panel">
      <form id="form-perfil">
        <div class="field">
          <label>Qual seu perfil de risco?</label>
          <select name="perfil">
            <option value="conservador">Conservador — prioriza segurança</option>
            <option value="moderado">Moderado — aceita um pouco de risco</option>
            <option value="arrojado">Arrojado — busca rendimento maior</option>
          </select>
        </div>
        <div class="field">
          <label>Por quanto tempo pode deixar o dinheiro parado?</label>
          <select name="prazo">
            <option value="curto">Curto prazo (até 6 meses / reserva de emergência)</option>
            <option value="medio">Médio prazo (6 meses a 2 anos)</option>
            <option value="longo">Longo prazo (mais de 2 anos)</option>
          </select>
        </div>
        <div class="field">
          <label>Precisa de liquidez imediata (resgatar a qualquer momento)?</label>
          <select name="liquidez">
            <option value="sim">Sim, pode precisar resgatar a qualquer hora</option>
            <option value="nao">Não, posso deixar preso por um período</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Ver sugestões</button>
      </form>
    </div>

    <div id="resultado-perfil"></div>

    <div class="section-title">Opções comuns para começar (visão geral)</div>
    <div class="grid">
      ${OPCOES_INVESTIMENTO.map(op=>`
        <div class="card">
          <div class="card-label">${escapeHtml(op.nome)}</div>
          <div class="text-sm" style="margin:.4rem 0;">${escapeHtml(op.resumo)}</div>
          <div class="text-sm"><strong style="color:var(--success)">Prós:</strong> ${op.pros.map(escapeHtml).join(' · ')}</div>
          <div class="text-sm mt-1"><strong style="color:var(--alert-light)">Contras:</strong> ${op.contras.map(escapeHtml).join(' · ')}</div>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelector('#form-perfil').addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const perfil = fd.get('perfil'), prazo = fd.get('prazo'), liquidez = fd.get('liquidez');
    const compativeis = OPCOES_INVESTIMENTO.filter(op=>
      op.perfil.includes(perfil) && op.prazo.includes(prazo) && op.liquidez.includes(liquidez)
    );
    const lista = compativeis.length ? compativeis : OPCOES_INVESTIMENTO.filter(op=>op.liquidez.includes(liquidez));

    document.getElementById('resultado-perfil').innerHTML = `
      <div class="section-title">Sugestões para o seu perfil</div>
      <div class="panel">
        <p class="text-sm text-muted">Com base nas respostas (perfil ${escapeHtml(perfil)}, prazo ${escapeHtml(prazo)}, liquidez ${liquidez==='sim'?'necessária':'não necessária'}):</p>
        <div class="list mt-1">
          ${lista.map(op=>`
            <div class="row-item">
              <div class="ri-main">
                <div class="ri-title">${escapeHtml(op.nome)}</div>
                <div class="ri-sub">${escapeHtml(op.resumo)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    document.getElementById('resultado-perfil').scrollIntoView({behavior:'smooth', block:'start'});
  });
}
