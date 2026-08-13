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
    ultimoMesAberto: ''
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
function updateDivida(id, patch){
  const item = STATE.dividas.find(x=>x.id===id);
  if(item) Object.assign(item, patch);
  saveState();
}
function deleteDivida(id){
  STATE.dividas = STATE.dividas.filter(x=>x.id!==id);
  saveState();
}

/* ---------------- Receitas ---------------- */
function addReceita(r){
  STATE.receitas.push(Object.assign({ id: uid() }, r));
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

/* ---------------- Gastos ---------------- */
function addGasto(g){
  STATE.gastos.push(Object.assign({ id: uid(), inesperado:false }, g));
  saveState();
}
function updateGasto(id, patch){
  const item = STATE.gastos.find(x=>x.id===id);
  if(item) Object.assign(item, patch);
  saveState();
}
function deleteGasto(id){
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
 * Fecha `mesFechado`: copia as dívidas marcadas como recorrentes para o mês seguinte
 * (pendentes, avançando a parcela quando aplicável) e retorna o mês seguinte.
 * Idempotente — rodar duas vezes não duplica as dívidas já copiadas.
 */
function fecharMes(mesFechado){
  const proximoMes = shiftMonthKey(mesFechado, 1);
  const recorrentes = STATE.dividas.filter(d=>d.mes===mesFechado && d.recorrente);
  recorrentes.forEach(d=>{
    const parcelado = Number(d.parcelas||1) > 1;
    if(parcelado && Number(d.parcelaAtual||1) >= Number(d.parcelas)) return; // já quitada
    const jaExiste = STATE.dividas.some(x=>x.mes===proximoMes && x.nome===d.nome && x.categoria===d.categoria && x.recorrente);
    if(jaExiste) return;
    addDivida({
      nome: d.nome,
      categoria: d.categoria,
      valor: d.valor,
      vencimento: d.vencimento,
      parcelas: d.parcelas || 1,
      parcelaAtual: parcelado ? Number(d.parcelaAtual||1) + 1 : 1,
      status: 'pendente',
      mes: proximoMes,
      variavel: !!d.variavel,
      recorrente: true
    });
  });
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
