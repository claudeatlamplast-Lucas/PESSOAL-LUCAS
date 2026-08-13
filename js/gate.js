/* =========================================================
   gate.js — trava de acesso por senha (dissuasão, não é segurança forte:
   é um site estático, então o hash abaixo é público no repositório)
   ========================================================= */

const GATE_HASH = 'da7f09a584544112995d23892f6e782f4958630feae7bfcce3c8a95f2b1282c3';
const GATE_KEY = 'opOrcamento:unlocked';

async function sha256Hex(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function trancarApp(){
  localStorage.removeItem(GATE_KEY);
  window.location.reload();
}

function abrirGate(){
  const overlay = document.getElementById('gate-overlay');
  const form = document.getElementById('gate-form');
  const input = document.getElementById('gate-input');
  const errorEl = document.getElementById('gate-error');

  overlay.classList.add('open');
  document.body.classList.add('gate-lock');
  setTimeout(()=>input.focus(), 50);

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const hash = await sha256Hex(input.value);
    if(hash === GATE_HASH){
      localStorage.setItem(GATE_KEY, '1');
      overlay.classList.remove('open');
      document.body.classList.remove('gate-lock');
      initApp();
    } else {
      errorEl.textContent = 'Senha incorreta.';
      input.value = '';
      input.focus();
      overlay.classList.add('shake');
      setTimeout(()=>overlay.classList.remove('shake'), 300);
    }
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  if(localStorage.getItem(GATE_KEY) === '1'){
    initApp();
  } else {
    abrirGate();
  }
});
