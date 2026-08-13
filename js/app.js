/* =========================================================
   app.js — router, inicialização, navegação e FAB
   ========================================================= */

let mesSelecionado = currentMonthKey();

const ROUTES = {
  dashboard: renderDashboard,
  dividas: renderDividas,
  receitas: renderReceitas,
  gastos: renderGastos,
  cartoes: renderCartoes,
  poupanca: renderPoupanca,
  investir: renderInvestir,
  config: renderConfig
};

function currentRouteName(){
  const hash = window.location.hash.replace(/^#\//,'');
  return ROUTES[hash] ? hash : 'dashboard';
}

function renderCurrentRoute(){
  const route = currentRouteName();
  const container = document.getElementById('app-content');
  ROUTES[route](container);
  updateActiveNav(route);
  updateMesBadge();
  window.scrollTo({ top:0 });
}

function updateActiveNav(route){
  document.querySelectorAll('.nav-link, .bnav-link').forEach(a=>{
    a.classList.toggle('active', a.dataset.route === route);
  });
}

function updateMesBadge(){
  document.getElementById('mes-atual-badge').textContent = formatMonthLabel(mesSelecionado);
}

function closeSideNav(){
  document.getElementById('sidenav').classList.remove('open');
  document.getElementById('nav-overlay').classList.remove('open');
}
function openSideNav(){
  document.getElementById('sidenav').classList.add('open');
  document.getElementById('nav-overlay').classList.add('open');
}

function initApp(){
  loadState();
  window.addEventListener('hashchange', renderCurrentRoute);

  document.getElementById('btn-menu').addEventListener('click', openSideNav);
  document.getElementById('btn-close-menu').addEventListener('click', closeSideNav);
  document.getElementById('nav-overlay').addEventListener('click', closeSideNav);
  document.querySelectorAll('.nav-link').forEach(a=>a.addEventListener('click', closeSideNav));

  document.getElementById('fab-gasto').addEventListener('click', ()=>{
    openGastoForm(null, ()=>renderCurrentRoute());
  });

  if(!window.location.hash){ window.location.hash = '#/dashboard'; }
  renderCurrentRoute();
  checkAutoFechamento();
}
