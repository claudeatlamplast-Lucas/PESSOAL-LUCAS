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
 * Monta a linha do tempo de caixa do mês atual real (não o mês navegado na tela), a partir
 * do saldo em conta informado, andando dia a dia pelas dívidas pendentes e receitas ainda não
 * recebidas. `overrides` (opcional) é um mapa { dividaId: novoDia } usado só para simulação —
 * não altera os dados salvos, só o dia considerado nesta conta para o cálculo.
 */
function gerarLinhaDoTempoCaixa(overrides){
  overrides = overrides || {};
  const mes = currentMonthKey();
  const hoje = new Date();
  const hojeDia = hoje.getDate();
  const saldoAtual = Number((STATE.saldoConta && STATE.saldoConta.valor) || 0);

  const pendentes = STATE.dividas.filter(d=>d.mes===mes && d.status!=='paga').map(d=>{
    const diaOverride = overrides[d.id];
    return diaOverride === undefined ? d : Object.assign({}, d, { vencimento: diaOverride===null ? null : Number(diaOverride) });
  });
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

  const pontos = [{ dia: hojeDia, saldo: saldoCorrente, tipo:'inicio', nome:'Hoje' }];
  eventos.forEach(ev=>{
    saldoCorrente += ev.valor;
    pontos.push({ dia: ev.dia, saldo: saldoCorrente, tipo: ev.tipo, nome: ev.nome });
    if(saldoCorrente < minimoAtingido){
      minimoAtingido = saldoCorrente;
      eventoCritico = ev;
    }
  });

  const totalSemData = semData.reduce((s,d)=>s+Number(d.valor||0),0);
  const deficit = minimoAtingido < 0;
  const reservaSegura = Math.max(0, minimoAtingido - totalSemData);

  return {
    mes, hojeDia, saldoAtual, atrasadas, futurasComData, semData, receitasFuturas, pontos,
    saldoFinalProjetado: saldoCorrente, minimoAtingido, eventoCritico,
    deficit, valorFaltante: deficit ? Math.abs(minimoAtingido) : 0,
    reservaSegura
  };
}

function calcSituacaoCaixa(){
  return gerarLinhaDoTempoCaixa();
}

/** Simula "e se eu pagar/receber a conta X no dia Y" sem alterar os dados salvos. */
function calcSimulacaoCenario(dividaId, novoDia){
  const overrides = {};
  overrides[dividaId] = (novoDia===''||novoDia===null||novoDia===undefined) ? null : Number(novoDia);
  return gerarLinhaDoTempoCaixa(overrides);
}

/* ---------------- Mentor de Gastos e Estratégias ---------------- */

/**
 * Para cada ponto da linha do tempo, calcula a "folga": quanto dá pra gastar naquele dia
 * sem que o saldo fique negativo em nenhum dia seguinte do mês (mínimo dali pra frente).
 */
function calcularFolgasPorPonto(pontos){
  const n = pontos.length;
  const sufixoMin = new Array(n);
  sufixoMin[n-1] = pontos[n-1].saldo;
  for(let i=n-2;i>=0;i--){ sufixoMin[i] = Math.min(pontos[i].saldo, sufixoMin[i+1]); }
  return pontos.map((p,i)=>Object.assign({}, p, { folga: sufixoMin[i] }));
}

/** Acha o dia do mês (entre hoje e o fim do mês) com mais folga de caixa — o melhor momento pra gastar ou guardar. */
function melhorPontoComFolga(pontos){
  const comFolga = calcularFolgasPorPonto(pontos);
  let melhor = comFolga[0];
  comFolga.forEach(p=>{ if(p.folga > melhor.folga + 0.005) melhor = p; });
  return melhor;
}

function calcMentor(){
  const mes = currentMonthKey();
  const caixa = gerarLinhaDoTempoCaixa();
  const orcCategorias = calcOrcamentoPorCategoria(mes);
  const receita = calcReceitaTotal(mes);
  const dividasTotal = calcDividasTotal(mes);
  const melhorPonto = melhorPontoComFolga(caixa.pontos);

  const pagamentos = [];
  caixa.atrasadas.forEach(d=>{
    pagamentos.push({ divida:d, dia:null, status:'atrasada',
      mensagem:'Está atrasada — pague assim que possível, antes de qualquer gasto novo.' });
  });
  caixa.futurasComData.forEach(d=>{
    const critico = caixa.eventoCritico && caixa.eventoCritico.item === d;
    pagamentos.push({ divida:d, dia:d.vencimento, status: critico ? 'apertado' : 'tranquilo',
      mensagem: critico
        ? `Pague no dia ${d.vencimento} — é o ponto mais apertado do mês, evite adiantar ou gastar extra perto dessa data.`
        : `Pode pagar tranquilo no dia ${d.vencimento}, sem risco pro saldo.` });
  });
  caixa.semData.forEach(d=>{
    const seguro = melhorPonto.folga >= Number(d.valor||0);
    pagamentos.push({ divida:d, dia: melhorPonto.dia, status: seguro ? 'flexivel' : 'atencao',
      mensagem: seguro
        ? `Sem data marcada — dia ${melhorPonto.dia} é quando o caixa está mais folgado esse mês, bom momento pra resolver essa.`
        : `Sem data marcada, e o mês está apertado pra esse valor — resolva só depois de garantir as contas com vencimento fixo.` });
  });

  const catsOrdenadas = Object.entries(orcCategorias);
  const mercadoEntry = catsOrdenadas.find(([c])=>c==='mercado') || catsOrdenadas[0];
  const mercado = mercadoEntry ? {
    categoria: mercadoEntry[0],
    dia: melhorPonto.dia,
    valor: Math.max(0, Math.min(mercadoEntry[1].restante, melhorPonto.folga))
  } : null;

  const poupanca = { dia: caixa.reservaSegura>0 ? caixa.hojeDia : melhorPonto.dia, valor: caixa.reservaSegura };

  const estrategias = [];
  if(receita > 0){
    const pctDividas = dividasTotal/receita*100;
    estrategias.push(pctDividas > 50
      ? `Suas contas fixas consomem ${Math.round(pctDividas)}% da renda do mês — acima da faixa saudável (até 50%). Vale ver o que dá pra renegociar ou cortar.`
      : `Suas contas fixas consomem ${Math.round(pctDividas)}% da renda — dentro de uma faixa saudável.`);
    const metaPoupanca = Number(STATE.configOrcamento.metaPoupancaMensal||0);
    const pctPoupanca = metaPoupanca/receita*100;
    if(pctPoupanca < 10){
      estrategias.push(`Você está reservando ${pctPoupanca.toFixed(0)}% da renda por mês. Se der, tente subir aos poucos até uns 10-20%.`);
    }
  }
  const categoriasEstourando = catsOrdenadas.filter(([,v])=>v.percentualUsado>=100);
  if(categoriasEstourando.length){
    estrategias.push(`${categoriasEstourando.map(([c])=>categoriaLabel(c)).join(', ')} já estourou o orçamento do mês — considere segurar os gastos ali ou reajustar os percentuais em Config.`);
  }
  if(caixa.deficit){
    estrategias.push(`Nesse ritmo, o saldo fica negativo perto do dia ${caixa.eventoCritico ? caixa.eventoCritico.dia : '?'}. Priorize as contas com data fixa e segure gastos variáveis até resolver isso.`);
  } else if(caixa.reservaSegura > 0){
    estrategias.push(`O mês está sob controle — dá pra guardar ${formatCurrency(caixa.reservaSegura)} sem comprometer nenhuma conta.`);
  }

  return { caixa, pagamentos, mercado, poupanca, estrategias, melhorPonto };
}
