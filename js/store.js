/* =========================================================
   store.js — estado da aplicação, persistência em localStorage,
   CRUD e backup/restauração
   ========================================================= */

const STORAGE_KEY = 'opOrcamento:v1';

function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function pad2(n){ return String(n).padStart(2,'0'); }

function currentMonthKey(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
}

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function formatMonthLabel(mesKey){
  if(!mesKey) return '';
  const [y,m] = mesKey.split('-').map(Number);
  return `${MESES_PT[m-1]}/${y}`;
}

function shiftMonthKey(mesKey, delta){
  let [y,m] = mesKey.split('-').map(Number);
  m += delta;
  while(m > 12){ m -= 12; y += 1; }
  while(m < 1){ m += 12; y -= 1; }
  return `${y}-${pad2(m)}`;
}

function defaultConfigOrcamento(){
  return {
    percentuais: { mercado: 40, gasolina: 15, restaurante: 15, lazer: 15, outros: 15 },
    categoriasLabel: { mercado: 'Mercado', gasolina: 'Gasolina', restaurante: 'Restaurante', lazer: 'Lazer', outros: 'Outros' },
    metaPoupancaMensal: 0,
    metaReservaTotal: 0
  };
}

function defaultState(){
  return {
    version: 1,
    dividas: [],
    receitas: [],
    gastos: [],
    cartoes: [],
    comprasCartao: [],
    configOrcamento: defaultConfigOrcamento(),
    poupanca: [],
    saldoConta: { valor: 0, atualizadoEm: '' },
    ultimoMesAberto: '',
    fechamentos: {}
  };
}

let STATE = null;

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw){ STATE = defaultState(); return STATE; }
    const parsed = JSON.parse(raw);
    STATE = Object.assign(defaultState(), parsed);
    STATE.configOrcamento = Object.assign(defaultConfigOrcamento(), parsed.configOrcamento || {});
    STATE.configOrcamento.percentuais = Object.assign(defaultConfigOrcamento().percentuais, (parsed.configOrcamento||{}).percentuais || {});
    STATE.configOrcamento.categoriasLabel = Object.assign(defaultConfigOrcamento().categoriasLabel, (parsed.configOrcamento||{}).categoriasLabel || {});
  }catch(e){
    console.error('Falha ao carregar dados, iniciando estado novo.', e);
    STATE = defaultState();
  }
  return STATE;
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
  window.dispatchEvent(new CustomEvent('state:changed'));
}

/* ---------------- Dívidas ---------------- */
function addDivida(d){
  STATE.dividas.push(Object.assign({ id: uid(), status:'pendente', parcelas:1, parcelaAtual:1 }, d));
  saveState();
}
/**
 * Ao mudar status para 'paga', desconta o valor do saldo em conta (o dinheiro saiu de verdade);
 * ao voltar para 'pendente' (desfazer), devolve o valor. Não mexe no saldo em outras edições.
 */
function updateDivida(id, patch){
  const item = STATE.dividas.find(x=>x.id===id);
  if(item){
    if(patch.status !== undefined && patch.status !== item.status){
      if(patch.status === 'paga') ajustarSaldoConta(-Number(item.valor||0));
      else if(item.status === 'paga') ajustarSaldoConta(Number(item.valor||0));
    }
    Object.assign(item, patch);
  }
  saveState();
}
function deleteDivida(id){
  STATE.dividas = STATE.dividas.filter(x=>x.id!==id);
  saveState();
}

/* ---------------- Receitas ---------------- */
function addReceita(r){
  STATE.receitas.push(Object.assign({ id: uid(), recorrente:false }, r));
  saveState();
}
function updateReceita(id, patch){
  const item = STATE.receitas.find(x=>x.id===id);
  if(item) Object.assign(item, patch);
  saveState();
}
function deleteReceita(id){
  STATE.receitas = STATE.receitas.filter(x=>x.id!==id);
  saveState();
}

/* ---------------- Gastos ----------------
   Todo gasto lançado é dinheiro que já saiu da conta — desconta do saldo ao
   criar, ajusta a diferença ao editar o valor, e devolve ao excluir. */
function addGasto(g){
  const gasto = Object.assign({ id: uid(), inesperado:false }, g);
  STATE.gastos.push(gasto);
  ajustarSaldoConta(-Number(gasto.valor||0));
  saveState();
}
function updateGasto(id, patch){
  const item = STATE.gastos.find(x=>x.id===id);
  if(item){
    const valorAntigo = Number(item.valor||0);
    Object.assign(item, patch);
    const valorNovo = Number(item.valor||0);
    if(valorNovo !== valorAntigo) ajustarSaldoConta(valorAntigo - valorNovo);
  }
  saveState();
}
function deleteGasto(id){
  const item = STATE.gastos.find(x=>x.id===id);
  if(item) ajustarSaldoConta(Number(item.valor||0));
  STATE.gastos = STATE.gastos.filter(x=>x.id!==id);
  saveState();
}

/* ---------------- Cartões ---------------- */
function addCartao(c){
  STATE.cartoes.push(Object.assign({ id: uid() }, c));
  saveState();
}
function updateCartao(id, patch){
  const item = STATE.cartoes.find(x=>x.id===id);
  if(item) Object.assign(item, patch);
  saveState();
}
function deleteCartao(id){
  STATE.cartoes = STATE.cartoes.filter(x=>x.id!==id);
  STATE.comprasCartao = STATE.comprasCartao.filter(x=>x.cartaoId!==id);
  saveState();
}

/* ---------------- Compras no cartão ---------------- */
function addCompraCartao(c){
  STATE.comprasCartao.push(Object.assign({ id: uid(), parcelas:1, categoria:'outros' }, c));
  saveState();
}
function updateCompraCartao(id, patch){
  const item = STATE.comprasCartao.find(x=>x.id===id);
  if(item) Object.assign(item, patch);
  saveState();
}
function deleteCompraCartao(id){
  STATE.comprasCartao = STATE.comprasCartao.filter(x=>x.id!==id);
  saveState();
}

/* ---------------- Saldo em conta ---------------- */
function updateSaldoConta(valor){
  STATE.saldoConta = { valor: Number(valor)||0, atualizadoEm: new Date().toISOString().slice(0,10) };
  saveState();
}
/** Soma/subtrai do saldo em conta automaticamente (dívida paga, gasto lançado/editado/excluído). */
function ajustarSaldoConta(delta){
  if(!delta) return;
  if(!STATE.saldoConta) STATE.saldoConta = { valor:0, atualizadoEm:'' };
  STATE.saldoConta.valor = Number(STATE.saldoConta.valor||0) + delta;
  STATE.saldoConta.atualizadoEm = new Date().toISOString().slice(0,10);
}

/* ---------------- Config orçamento ---------------- */
function updateConfigOrcamento(patch){
  Object.assign(STATE.configOrcamento, patch);
  saveState();
}
function setPercentuais(percentuais){
  STATE.configOrcamento.percentuais = percentuais;
  saveState();
}
function addCategoriaVariavel(chave, label, percentual){
  STATE.configOrcamento.percentuais[chave] = percentual;
  STATE.configOrcamento.categoriasLabel[chave] = label;
  saveState();
}
function removeCategoriaVariavel(chave){
  delete STATE.configOrcamento.percentuais[chave];
  delete STATE.configOrcamento.categoriasLabel[chave];
  saveState();
}

/* ---------------- Poupança ---------------- */
function addPoupanca(p){
  STATE.poupanca.push(Object.assign({ id: uid(), tipo:'aporte' }, p));
  saveState();
}
function updatePoupanca(id, patch){
  const item = STATE.poupanca.find(x=>x.id===id);
  if(item) Object.assign(item, patch);
  saveState();
}
function deletePoupanca(id){
  STATE.poupanca = STATE.poupanca.filter(x=>x.id!==id);
  saveState();
}

/* ---------------- Meses disponíveis (histórico) ---------------- */
function listaMesesConhecidos(){
  const set = new Set([currentMonthKey()]);
  STATE.dividas.forEach(d=>d.mes && set.add(d.mes));
  STATE.receitas.forEach(r=>r.mes && set.add(r.mes));
  STATE.gastos.forEach(g=>g.mes && set.add(g.mes));
  return Array.from(set).sort();
}

/* ---------------- Fechamento de mês ---------------- */
function marcarMesAberto(mes){
  STATE.ultimoMesAberto = mes;
  saveState();
}

/**
 * Copia para `mesDestino` as dívidas e receitas marcadas como recorrentes em `mesOrigem`
 * (dívidas entram pendentes, avançando a parcela quando aplicável). Idempotente — rodar
 * duas vezes não duplica o que já foi copiado. Retorna quantos itens de cada tipo entraram.
 */
function copiarRecorrentesParaMes(mesOrigem, mesDestino){
  let dividasCopiadas = 0, receitasCopiadas = 0;

  STATE.dividas.filter(d=>d.mes===mesOrigem && d.recorrente).forEach(d=>{
    const parcelado = Number(d.parcelas||1) > 1;
    if(parcelado && Number(d.parcelaAtual||1) >= Number(d.parcelas)) return; // já quitada
    const jaExiste = STATE.dividas.some(x=>x.mes===mesDestino && x.nome===d.nome && x.categoria===d.categoria && x.recorrente);
    if(jaExiste) return;
    addDivida({
      nome: d.nome,
      categoria: d.categoria,
      valor: d.valor,
      vencimento: d.vencimento,
      parcelas: d.parcelas || 1,
      parcelaAtual: parcelado ? Number(d.parcelaAtual||1) + 1 : 1,
      status: 'pendente',
      mes: mesDestino,
      variavel: !!d.variavel,
      recorrente: true
    });
    dividasCopiadas++;
  });

  STATE.receitas.filter(r=>r.mes===mesOrigem && r.recorrente).forEach(r=>{
    const jaExiste = STATE.receitas.some(x=>x.mes===mesDestino && x.fonte===r.fonte && x.recorrente);
    if(jaExiste) return;
    const diaRef = r.data ? r.data.slice(8,10) : '05';
    addReceita({
      fonte: r.fonte,
      valor: r.valor,
      data: `${mesDestino}-${diaRef}`,
      mes: mesDestino,
      variavel: !!r.variavel,
      recorrente: true
    });
    receitasCopiadas++;
  });

  return { dividasCopiadas, receitasCopiadas };
}

/**
 * Prepara `mesOrigem`+1 copiando as dívidas e receitas recorrentes pra lá, sem fechar/marcar
 * o mês atual como encerrado — pode ser chamado a qualquer momento pra adiantar o cadastro.
 */
function prepararProximoMes(mesOrigem){
  const proximoMes = shiftMonthKey(mesOrigem, 1);
  const resultado = copiarRecorrentesParaMes(mesOrigem, proximoMes);
  return Object.assign({ mes: proximoMes }, resultado);
}

/**
 * Salva (ou atualiza) a "foto" do relatório de `mes` em STATE.fechamentos — os números
 * ficam congelados no momento do fechamento. Mantém a data original de fechamento ao atualizar.
 */
function salvarRelatorioFechamento(mes, retroativo){
  if(!STATE.fechamentos) STATE.fechamentos = {};
  const anterior = STATE.fechamentos[mes];
  const hoje = new Date().toISOString().slice(0,10);
  STATE.fechamentos[mes] = {
    fechadoEm: anterior ? anterior.fechadoEm : hoje,
    atualizadoEm: hoje,
    retroativo: anterior ? !!anterior.retroativo : !!retroativo,
    dados: calcRelatorioMes(mes)
  };
  saveState();
}

/**
 * Fecha `mesFechado`: copia as recorrentes pra o mês seguinte (via copiarRecorrentesParaMes)
 * e marca o mês seguinte como o mês em vigência. Retorna o mês seguinte.
 */
function fecharMes(mesFechado){
  const proximoMes = shiftMonthKey(mesFechado, 1);
  salvarRelatorioFechamento(mesFechado);
  copiarRecorrentesParaMes(mesFechado, proximoMes);
  marcarMesAberto(proximoMes);
  return proximoMes;
}

/* ---------------- Backup / Restore ---------------- */
function exportBackup(){
  const blob = new Blob([JSON.stringify(STATE, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  a.href = url;
  a.download = `backup-orcamento-${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importBackupFromFile(file, onDone, onError){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      if(typeof parsed !== 'object' || parsed === null) throw new Error('Formato inválido');
      STATE = Object.assign(defaultState(), parsed);
      STATE.configOrcamento = Object.assign(defaultConfigOrcamento(), parsed.configOrcamento || {});
      saveState();
      onDone && onDone();
    }catch(e){
      onError && onError(e);
    }
  };
  reader.onerror = () => onError && onError(reader.error);
  reader.readAsText(file);
}

/**
 * Importa um arquivo JSON somando aos dados atuais, sem apagar nada — ao contrário de
 * importBackupFromFile (que substitui tudo). Ideal para receber lotes de dados aos poucos
 * (ex: dívidas de um mês, depois receitas). Itens com id já existente são ignorados.
 */
function mergeBackupFromFile(file, onDone, onError){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      if(typeof parsed !== 'object' || parsed === null) throw new Error('Formato inválido');
      let adicionados = 0;
      ['dividas','receitas','gastos','cartoes','comprasCartao','poupanca'].forEach(key=>{
        if(Array.isArray(parsed[key])){
          parsed[key].forEach(item=>{
            if(!STATE[key].some(x=>x.id===item.id)){
              STATE[key].push(item);
              adicionados++;
            }
          });
        }
      });
      saveState();
      onDone && onDone(adicionados);
    }catch(e){
      onError && onError(e);
    }
  };
  reader.onerror = () => onError && onError(reader.error);
  reader.readAsText(file);
}

function resetAllData(){
  STATE = defaultState();
  saveState();
}
