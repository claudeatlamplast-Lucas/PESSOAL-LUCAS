/* =========================================================
   relatorio-calc.js — relatório de fechamento do mês: entradas, contas,
   gastos por categoria, cartões, andamento do plano e análise em texto
   ========================================================= */

function somaValores(lista){
  return lista.reduce((s,x)=>s+Number(x.valor||0),0);
}

function agruparSomando(lista, chaveFn){
  const mapa = {};
  lista.forEach(x=>{
    const k = chaveFn(x);
    mapa[k] = (mapa[k]||0) + Number(x.valor||0);
  });
  return Object.entries(mapa).map(([chave,valor])=>({ chave, valor })).sort((a,b)=>b.valor-a.valor);
}

/** Totais enxutos de um mês — usados na comparação com o mês anterior. */
function calcTotaisMes(mes){
  return {
    receita: calcReceitaTotal(mes),
    dividas: calcDividasTotal(mes),
    gastos: somaValores(calcGastosDoMes(mes)),
    inesperados: calcGastosInesperadosTotal(mes)
  };
}

function variacaoPct(atual, antes){
  if(!antes) return null;
  return (atual-antes)/antes*100;
}

/**
 * Monta o relatório completo de um mês. Tudo é serializável, para poder ser salvo como
 * "foto" do fechamento em STATE.fechamentos (os números não mudam se lançamentos antigos
 * forem editados depois — dá pra regerar manualmente).
 */
function calcRelatorioMes(mes){
  const [ano, mesNum] = mes.split('-').map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();

  /* Entradas */
  const receitas = STATE.receitas.filter(r=>r.mes===mes);
  const receita = somaValores(receitas);
  const receitaVariavel = somaValores(receitas.filter(r=>r.variavel));
  const receitasPorFonte = agruparSomando(receitas, r=>r.fonte||'Sem nome').map(x=>({ fonte:x.chave, valor:x.valor }));

  /* Contas */
  const dividas = STATE.dividas.filter(d=>d.mes===mes);
  const dividasPagas = dividas.filter(d=>d.status==='paga');
  const dividasEmAberto = dividas.filter(d=>d.status!=='paga');
  const dividasTotal = somaValores(dividas);
  const dividasPagasTotal = somaValores(dividasPagas);
  const dividasAbertasTotal = somaValores(dividasEmAberto);
  const dividasPorCategoria = agruparSomando(dividas, d=>d.categoria||'Outros').map(x=>({ categoria:x.chave, valor:x.valor }));
  const enxuta = d=>({
    nome:d.nome, categoria:d.categoria||'', valor:Number(d.valor||0), vencimento:d.vencimento||null,
    parcelas:Number(d.parcelas||1), parcelaAtual:Number(d.parcelaAtual||1)
  });

  /* Gastos por fora (por categoria) */
  const gastos = calcGastosDoMes(mes);
  const gastosTotal = somaValores(gastos);
  const inesperados = calcGastosInesperadosTotal(mes);
  const orcCategorias = calcOrcamentoPorCategoria(mes);
  const chavesCat = Object.keys(orcCategorias);
  gastos.forEach(g=>{ if(g.categoria && !chavesCat.includes(g.categoria)) chavesCat.push(g.categoria); });
  const gastosPorCategoria = chavesCat.map(cat=>{
    const doCat = gastos.filter(g=>g.categoria===cat);
    const orc = orcCategorias[cat];
    const gasto = somaValores(doCat);
    const planejado = somaValores(doCat.filter(g=>!g.inesperado));
    return {
      categoria: cat, label: categoriaLabel(cat), qtd: doCat.length,
      gasto, planejado, inesperado: gasto - planejado,
      orcamento: orc ? orc.orcamento : 0,
      percentualUsado: orc ? orc.percentualUsado : (gasto>0 ? 999 : 0),
      noOrcamento: !!orc
    };
  }).filter(c=>c.noOrcamento || c.gasto>0).sort((a,b)=>b.gasto-a.gasto);
  const gastosPorForma = agruparSomando(gastos, g=>g.formaPagamento||'nao-informado').map(x=>({ forma:x.chave, valor:x.valor }));
  const maioresGastos = gastos.slice().sort((a,b)=>Number(b.valor||0)-Number(a.valor||0)).slice(0,5)
    .map(g=>({ descricao:g.descricao||'', categoria:g.categoria||'', valor:Number(g.valor||0), data:g.data||'', inesperado:!!g.inesperado }));
  const orcVariavelTotal = Object.values(orcCategorias).reduce((s,c)=>s+c.orcamento,0);

  /* Faturas de cartão (informativo — podem já estar em Contas, categoria Cartão) */
  const faturasCartao = STATE.cartoes
    .map(c=>({ nome:c.nome||'Cartão', total: calcFaturaCartao(c.id, mes).total }))
    .filter(f=>f.total>0);

  /* Resultado */
  const sobra = receita - dividasTotal - gastosTotal;
  const caixaRealizado = receita - dividasPagasTotal - gastosTotal;

  /* Plano */
  const metaPoupanca = Number(STATE.configOrcamento.metaPoupancaMensal||0);
  const metaReserva = Number(STATE.configOrcamento.metaReservaTotal||0);
  const poupadoNoMes = calcPoupadoNoMes(mes);
  const totalPoupado = calcTotalPoupado();
  const proximos = calcProjecaoMeses().filter(p=>p.mes>mes && p.temDados).slice(0,3)
    .map(p=>({ mes:p.mes, saldoFinal:p.saldoFinal, receita:p.receita, dividas:p.dividas, deficit:p.deficit }));

  /* Comparação com o mês anterior */
  const mesAnterior = shiftMonthKey(mes, -1);
  const ant = calcTotaisMes(mesAnterior);
  const anterior = (ant.receita>0 || ant.dividas>0 || ant.gastos>0) ? Object.assign({ mes:mesAnterior }, ant) : null;

  const r = {
    mes, geradoEm: new Date().toISOString(), diasNoMes,
    receita, receitaVariavel, receitasPorFonte,
    dividasTotal, dividasPagasTotal, dividasAbertasTotal, dividasPorCategoria,
    dividasPagas: dividasPagas.map(enxuta), dividasEmAberto: dividasEmAberto.map(enxuta),
    gastosTotal, inesperados, orcVariavelTotal, gastosPorCategoria, gastosPorForma, maioresGastos,
    qtdGastos: gastos.length, mediaDiaria: gastosTotal/diasNoMes,
    faturasCartao,
    sobra, caixaRealizado,
    metaPoupanca, metaReserva, poupadoNoMes, totalPoupado,
    saldoContaAgora: Number((STATE.saldoConta && STATE.saldoConta.valor) || 0),
    proximos, anterior,
    pctContas: receita>0 ? dividasTotal/receita*100 : null,
    pctGastos: receita>0 ? gastosTotal/receita*100 : null,
    taxaPoupanca: receita>0 ? poupadoNoMes/receita*100 : null
  };
  r.analise = gerarAnaliseRelatorio(r);
  r.veredicto = calcVeredictoRelatorio(r);
  return r;
}

function calcVeredictoRelatorio(r){
  const temDados = r.receita>0 || r.dividasTotal>0 || r.gastosTotal>0;
  if(!temDados) return { nivel:'info', titulo:'SEM MOVIMENTO', texto:'Nada foi lançado neste mês.' };
  const estourou = r.gastosPorCategoria.some(c=>c.noOrcamento && c.orcamento>0 && c.planejado>c.orcamento);
  const riscoFuturo = r.proximos.some(p=>p.deficit);
  if(r.sobra < 0) return { nivel:'alert', titulo:'MÊS NO VERMELHO', texto:'As saídas passaram do que entrou.' };
  if(r.dividasEmAberto.length || estourou || riscoFuturo || (r.metaPoupanca>0 && r.poupadoNoMes<r.metaPoupanca)){
    return { nivel:'warn', titulo:'FECHOU COM RESSALVAS', texto:'Sobrou dinheiro, mas há pontos de atenção na análise.' };
  }
  return { nivel:'ok', titulo:'MÊS NO ALVO', texto:'Fechou no positivo, dentro do orçamento e com as contas em dia.' };
}

/** Observações em texto: [{ nivel: ok|warn|alert|info, texto }]. */
function gerarAnaliseRelatorio(r){
  const fmt = formatCurrency;
  const out = [];
  const add = (nivel, texto)=>out.push({ nivel, texto });

  /* Resultado */
  if(r.receita>0){
    const saidas = r.dividasTotal + r.gastosTotal;
    if(r.sobra>=0) add('ok', `Entraram ${fmt(r.receita)} e saíram ${fmt(saidas)} (contas + gastos por fora). Sobraram ${fmt(r.sobra)}, ${Math.round(r.sobra/r.receita*100)}% da receita.`);
    else add('alert', `Entraram ${fmt(r.receita)}, mas as saídas somaram ${fmt(saidas)}: o mês fechou ${fmt(Math.abs(r.sobra))} no negativo. Esse buraco saiu do saldo/reserva ou virou dívida.`);
  } else if(r.dividasTotal>0 || r.gastosTotal>0){
    add('alert', `Nenhuma receita lançada em ${formatMonthLabel(r.mes)}, mas há ${fmt(r.dividasTotal+r.gastosTotal)} em saídas. Confira se as receitas foram cadastradas.`);
  }

  /* Contas */
  if(r.dividasTotal>0){
    if(r.dividasEmAberto.length) add('alert', `${r.dividasEmAberto.length} conta(s) ficaram em aberto, somando ${fmt(r.dividasAbertasTotal)}: ${r.dividasEmAberto.map(d=>d.nome).join(', ')}. Continuam pesando no próximo mês.`);
    else add('ok', `Todas as ${r.dividasPagas.length} contas do mês foram pagas (${fmt(r.dividasPagasTotal)}).`);
    if(r.pctContas!=null){
      if(r.pctContas>50) add('warn', `As contas consumiram ${Math.round(r.pctContas)}% da receita, acima da faixa saudável (até 50%). Vale renegociar ou cortar algo fixo.`);
      else add('ok', `As contas consumiram ${Math.round(r.pctContas)}% da receita, dentro de uma faixa saudável.`);
    }
    const maior = r.dividasPorCategoria[0];
    if(maior && r.dividasPorCategoria.length>1) add('info', `Maior peso entre as contas: ${maior.categoria} (${fmt(maior.valor)}, ${Math.round(maior.valor/r.dividasTotal*100)}% das contas).`);
  }

  /* Gastos por fora */
  if(r.gastosTotal>0){
    const topo = r.gastosPorCategoria[0];
    add('info', `Gastos por fora: ${fmt(r.gastosTotal)} em ${r.qtdGastos} lançamento(s), média de ${fmt(r.mediaDiaria)} por dia. Categoria que mais pesou: ${topo.label} (${fmt(topo.gasto)}, ${Math.round(topo.gasto/r.gastosTotal*100)}% do total).`);
    const estouros = r.gastosPorCategoria.filter(c=>c.noOrcamento && c.orcamento>0 && c.planejado>c.orcamento);
    if(estouros.length) add('warn', `Estouraram o orçamento: ${estouros.map(c=>`${c.label} (+${fmt(c.planejado-c.orcamento)})`).join(', ')}.`);
    else if(r.orcVariavelTotal>0) add('ok', `Nenhuma categoria estourou o orçamento — usou ${Math.round(r.gastosTotal/r.orcVariavelTotal*100)}% do variável previsto (${fmt(r.orcVariavelTotal)}).`);
    const semOrc = r.gastosPorCategoria.filter(c=>!c.noOrcamento);
    if(semOrc.length) add('info', `Há gastos em categoria(s) sem orçamento definido: ${semOrc.map(c=>c.label).join(', ')}.`);
    if(r.inesperados>0) add('warn', `${fmt(r.inesperados)} (${Math.round(r.inesperados/r.gastosTotal*100)}% dos gastos) foram inesperados. Se isso se repete todo mês, vale reservar uma margem fixa para imprevistos.`);
    if(r.pctGastos!=null && r.pctGastos>30) add('warn', `Gastos por fora equivalem a ${Math.round(r.pctGastos)}% da receita.`);
  } else if(r.receita>0){
    add('info', 'Nenhum gasto por fora lançado. Se houve gastos, registre pelo botão + para o relatório ficar fiel.');
  }

  /* Plano */
  if(r.metaPoupanca>0){
    if(r.poupadoNoMes>=r.metaPoupanca) add('ok', `Meta de reserva do mês batida: guardou ${fmt(r.poupadoNoMes)} (meta ${fmt(r.metaPoupanca)}).`);
    else add('warn', `Guardou ${fmt(r.poupadoNoMes)} dos ${fmt(r.metaPoupanca)} planejados para a reserva (faltaram ${fmt(r.metaPoupanca-r.poupadoNoMes)}).`);
  } else if(r.poupadoNoMes>0){
    add('ok', `Guardou ${fmt(r.poupadoNoMes)} na reserva.`);
  } else if(r.receita>0){
    add('info', 'Nada foi guardado na reserva neste mês.');
  }
  if(r.metaReserva>0) add('info', `Reserva acumulada: ${fmt(r.totalPoupado)} de ${fmt(r.metaReserva)} (${Math.min(100,Math.round(r.totalPoupado/r.metaReserva*100))}% da meta).`);
  else if(r.totalPoupado>0) add('info', `Reserva acumulada: ${fmt(r.totalPoupado)}.`);
  if(r.receita>0 && r.receitaVariavel/r.receita>0.3) add('info', `${Math.round(r.receitaVariavel/r.receita*100)}% da receita veio de fontes variáveis, o que deixa o orçamento mais incerto.`);

  const risco = r.proximos.find(p=>p.deficit);
  if(risco) add('alert', `Olhando pra frente: ${formatMonthLabel(risco.mes)} projeta fechar no vermelho (${fmt(risco.saldoFinal)}). Reveja contas e receitas desse mês com antecedência.`);
  else if(r.proximos.length) add('ok', `Projeção sem aperto: ${formatMonthLabel(r.proximos[0].mes)} deve fechar com saldo de ${fmt(r.proximos[0].saldoFinal)}.`);

  /* Comparação com o mês anterior */
  if(r.anterior){
    const dR = variacaoPct(r.receita, r.anterior.receita);
    const dG = variacaoPct(r.gastosTotal, r.anterior.gastos);
    const dD = variacaoPct(r.dividasTotal, r.anterior.dividas);
    const sinal = v=>`${v>=0?'+':''}${Math.round(v)}%`;
    const partes = [];
    if(dR!=null) partes.push(`receita ${sinal(dR)}`);
    if(dD!=null) partes.push(`contas ${sinal(dD)}`);
    if(dG!=null) partes.push(`gastos por fora ${sinal(dG)}`);
    if(partes.length) add(dG!=null && dG>15 ? 'warn' : 'info', `Versus ${formatMonthLabel(r.anterior.mes)}: ${partes.join(', ')}.`);
  }
  return out;
}
