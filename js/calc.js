/* =========================================================
   calc.js — cálculos de orçamento, faturas de cartão e poupança
   ========================================================= */

function calcReceitaTotal(mes){
  return STATE.receitas.filter(r=>r.mes===mes).reduce((s,r)=>s+Number(r.valor||0),0);
}

function calcDividasTotal(mes){
  return STATE.dividas.filter(d=>d.mes===mes).reduce((s,d)=>s+Number(d.valor||0),0);
}

function calcDividasPendentesTotal(mes){
  return STATE.dividas.filter(d=>d.mes===mes && d.status!=='paga').reduce((s,d)=>s+Number(d.valor||0),0);
}

function calcGastosDoMes(mes){
  return STATE.gastos.filter(g=>g.mes===mes);
}

function calcGastosInesperadosTotal(mes){
  return calcGastosDoMes(mes).filter(g=>g.inesperado).reduce((s,g)=>s+Number(g.valor||0),0);
}

function calcSaldoLivre(mes){
  const receita = calcReceitaTotal(mes);
  const dividas = calcDividasTotal(mes);
  const metaPoupanca = Number(STATE.configOrcamento.metaPoupancaMensal||0);
  return receita - dividas - metaPoupanca;
}

/**
 * Retorna, por categoria variável configurada:
 * { orcamento, gasto, restante, percentualUsado }
 * Gastos marcados como "inesperado" NÃO entram no consumo da categoria —
 * eles são contabilizados à parte (ver calcGastosInesperadosTotal).
 */
function calcOrcamentoPorCategoria(mes){
  const saldoLivre = calcSaldoLivre(mes);
  const percentuais = STATE.configOrcamento.percentuais;
  const gastos = calcGastosDoMes(mes).filter(g=>!g.inesperado);
  const resultado = {};
  Object.keys(percentuais).forEach(cat=>{
    const orcamento = saldoLivre * (Number(percentuais[cat]||0) / 100);
    const gastoCategoria = gastos.filter(g=>g.categoria===cat).reduce((s,g)=>s+Number(g.valor||0),0);
    resultado[cat] = {
      orcamento,
      gasto: gastoCategoria,
      restante: orcamento - gastoCategoria,
      percentualUsado: orcamento > 0 ? (gastoCategoria/orcamento)*100 : (gastoCategoria>0 ? 999 : 0)
    };
  });
  return resultado;
}

function somaPercentuais(){
  return Object.values(STATE.configOrcamento.percentuais).reduce((s,v)=>s+Number(v||0),0);
}

/* ---------------- Cartão de crédito ---------------- */

/** Retorna {ano, mes(0-idx)} da fatura em que a 1ª parcela de uma compra cai. */
function mesFaturaInicial(dataCompraStr, fechamentoDia){
  const d = new Date(dataCompraStr + 'T00:00:00');
  let ano = d.getFullYear();
  let mes = d.getMonth(); // 0-idx
  if(d.getDate() > Number(fechamentoDia)){
    mes += 1;
    if(mes > 11){ mes = 0; ano += 1; }
  }
  return { ano, mes };
}

function mesKeyFromAnoMes(ano, mes){
  return `${ano}-${pad2(mes+1)}`;
}

/** Lista as parcelas de uma compra, cada uma com a chave do mês de fatura (YYYY-MM) e valor. */
function parcelasDaCompra(compra, cartao){
  const n = Number(compra.parcelas||1);
  const valorParcela = Number(compra.valorTotal||0) / n;
  const inicio = mesFaturaInicial(compra.dataCompra, cartao ? cartao.fechamento : 1);
  const lista = [];
  for(let i=0;i<n;i++){
    let mIdx = inicio.mes + i;
    let ano = inicio.ano;
    while(mIdx > 11){ mIdx -= 12; ano += 1; }
    lista.push({ numero: i+1, totalParcelas:n, mesFatura: mesKeyFromAnoMes(ano, mIdx), valor: valorParcela });
  }
  return lista;
}

/** Total da fatura de um cartão em um mês específico (YYYY-MM), com detalhamento das compras. */
function calcFaturaCartao(cartaoId, mesFatura){
  const cartao = STATE.cartoes.find(c=>c.id===cartaoId);
  const compras = STATE.comprasCartao.filter(c=>c.cartaoId===cartaoId);
  const itens = [];
  compras.forEach(compra=>{
    const parcelas = parcelasDaCompra(compra, cartao);
    parcelas.forEach(p=>{
      if(p.mesFatura === mesFatura){
        itens.push({ compra, parcela: p });
      }
    });
  });
  const total = itens.reduce((s,it)=>s+it.parcela.valor,0);
  return { total, itens, cartao };
}

/** Data de vencimento estimada de uma fatura (YYYY-MM) de um cartão. */
function dataVencimentoFatura(cartao, mesFatura){
  const [ano, mes] = mesFatura.split('-').map(Number);
  let anoV = ano, mesV = mes - 1; // 0-idx
  if(Number(cartao.vencimento) < Number(cartao.fechamento)){
    mesV += 1;
    if(mesV>11){ mesV=0; anoV+=1; }
  }
  return new Date(anoV, mesV, Number(cartao.vencimento));
}

/** Todas as faturas futuras já comprometidas de um cartão (meses com pelo menos 1 parcela), ordenadas. */
function faturasComprometidas(cartaoId){
  const cartao = STATE.cartoes.find(c=>c.id===cartaoId);
  const compras = STATE.comprasCartao.filter(c=>c.cartaoId===cartaoId);
  const meses = new Set();
  compras.forEach(compra=>{
    parcelasDaCompra(compra, cartao).forEach(p=>meses.add(p.mesFatura));
  });
  return Array.from(meses).sort().map(mesFatura=>({
    mesFatura,
    ...calcFaturaCartao(cartaoId, mesFatura),
    vencimento: dataVencimentoFatura(cartao, mesFatura)
  }));
}

/* ---------------- Poupança ---------------- */

function calcTotalPoupado(){
  return STATE.poupanca.reduce((s,p)=> s + (p.tipo==='saque' ? -Number(p.valor||0) : Number(p.valor||0)), 0);
}

function calcPoupadoNoMes(mes){
  return STATE.poupanca.filter(p=>p.data && p.data.startsWith(mes))
    .reduce((s,p)=> s + (p.tipo==='saque' ? -Number(p.valor||0) : Number(p.valor||0)), 0);
}

function calcPoupancaPorAplicacao(){
  const porApp = {};
  STATE.poupanca.forEach(p=>{
    const key = p.aplicacao || 'Não informado';
    const delta = p.tipo==='saque' ? -Number(p.valor||0) : Number(p.valor||0);
    porApp[key] = (porApp[key]||0) + delta;
  });
  return porApp;
}

/* ---------------- Resumo de fechamento do mês ---------------- */

function calcResumoMes(mes){
  const receita = calcReceitaTotal(mes);
  const dividasTotal = calcDividasTotal(mes);
  const dividas = STATE.dividas.filter(d=>d.mes===mes);
  const dividasPagas = dividas.filter(d=>d.status==='paga');
  const dividasEmAberto = dividas.filter(d=>d.status!=='paga');
  const orcCategorias = calcOrcamentoPorCategoria(mes);
  const gastoVariavelTotal = Object.values(orcCategorias).reduce((s,c)=>s+c.gasto,0);
  const orcVariavelTotal = Object.values(orcCategorias).reduce((s,c)=>s+c.orcamento,0);
  const inesperados = calcGastosInesperadosTotal(mes);
  const poupadoNoMes = calcPoupadoNoMes(mes);
  const recorrentes = dividas.filter(d=>d.recorrente);
  const saldoFinal = receita - dividasTotal - gastoVariavelTotal - inesperados;
  return {
    mes, receita, dividasTotal, dividasPagas, dividasEmAberto,
    gastoVariavelTotal, orcVariavelTotal, orcCategorias, inesperados,
    poupadoNoMes, recorrentes, saldoFinal
  };
}

/* ---------------- Situação de caixa / priorização de pagamentos ---------------- */

/**
 * Simula o fluxo de caixa do mês atual real (não o mês navegado na tela) a partir do
 * saldo em conta informado pelo usuário: soma receitas ainda não recebidas (data futura)
 * e subtrai dívidas pendentes (na ordem de vencimento), identificando se o saldo corre
 * risco de ficar negativo e quanto dá pra guardar com segurança na reserva.
 */
function calcSituacaoCaixa(){
  const mes = currentMonthKey();
  const hoje = new Date();
  const hojeDia = hoje.getDate();
  const saldoAtual = Number((STATE.saldoConta && STATE.saldoConta.valor) || 0);

  const pendentes = STATE.dividas.filter(d=>d.mes===mes && d.status!=='paga');
  const atrasadas = pendentes.filter(d=>d.vencimento!=null && Number(d.vencimento) < hojeDia)
    .sort((a,b)=>Number(a.vencimento)-Number(b.vencimento));
  const futurasComData = pendentes.filter(d=>d.vencimento!=null && Number(d.vencimento) >= hojeDia)
    .sort((a,b)=>Number(a.vencimento)-Number(b.vencimento));
  const semData = pendentes.filter(d=>d.vencimento==null);

  // Receitas são comparadas por data real (não pelo "mês de referência"), pois algumas
  // caem no mês civil anterior (ex: salário recebido nos últimos dias do mês passado) —
  // usar data local (não toISOString, que usa UTC e pode adiantar/atrasar um dia).
  const hojeISO = `${hoje.getFullYear()}-${pad2(hoje.getMonth()+1)}-${pad2(hoje.getDate())}`;
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0);
  const fimMesISO = `${fimMes.getFullYear()}-${pad2(fimMes.getMonth()+1)}-${pad2(fimMes.getDate())}`;

  const receitasFuturas = STATE.receitas
    .filter(r=>r.data && r.data >= hojeISO && r.data <= fimMesISO)
    .map(r=>({ ...r, dia: Number(r.data.slice(8,10)) }))
    .sort((a,b)=>a.dia-b.dia);

  const eventos = [
    ...receitasFuturas.map(r=>({ tipo:'receita', dia:r.dia, valor:Number(r.valor||0), nome:r.fonte })),
    ...futurasComData.map(d=>({ tipo:'divida', dia:Number(d.vencimento), valor:-Number(d.valor||0), nome:d.nome, item:d }))
  ].sort((a,b)=> a.dia - b.dia || (a.tipo==='receita' ? -1 : 1));

  let saldoCorrente = saldoAtual - atrasadas.reduce((s,d)=>s+Number(d.valor||0),0);
  let minimoAtingido = saldoCorrente;
  let eventoCritico = atrasadas.length ? { tipo:'divida', dia:hojeDia, nome: atrasadas[0].nome, atrasada:true } : null;

  eventos.forEach(ev=>{
    saldoCorrente += ev.valor;
    if(saldoCorrente < minimoAtingido){
      minimoAtingido = saldoCorrente;
      eventoCritico = ev;
    }
  });

  const totalSemData = semData.reduce((s,d)=>s+Number(d.valor||0),0);
  const deficit = minimoAtingido < 0;
  const reservaSegura = Math.max(0, minimoAtingido - totalSemData);

  return {
    mes, saldoAtual, atrasadas, futurasComData, semData, receitasFuturas,
    saldoFinalProjetado: saldoCorrente, minimoAtingido, eventoCritico,
    deficit, valorFaltante: deficit ? Math.abs(minimoAtingido) : 0,
    reservaSegura
  };
}
