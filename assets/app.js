// ===== Fecha footer
document.getElementById('year').textContent = new Date().getFullYear();

// ===== Scroll suave
document.querySelectorAll('.nav a[href^="#"], a.btn[href^="#"]').forEach(a=>{
  a.addEventListener('click', e=>{
    const id = a.getAttribute('href'); if(!id || id==='#') return;
    const el = document.querySelector(id); if(!el) return;
    e.preventDefault(); el.scrollIntoView({ behavior:'smooth', block:'start' });
  });
});

const cfg = window.OBT_CONFIG || { CREATE_ORDER_URL:'/create-order', SUCCESS_URL:'/gracias.html', CANCEL_URL:'/cancelar.html' };

// ===== PayPal
function renderPayPalButton({ containerId, amount, licenseType, maxInvites }) {
  if (!window.paypal) { alert('SDK de PayPal no cargó. Revisa tu client-id en index.html'); return; }
  const container = document.getElementById(containerId); if (!container) return;
  container.innerHTML = '';
  paypal.Buttons({
    style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'pay' },
    createOrder: () => fetch(cfg.CREATE_ORDER_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: { licenseType, maxInvites, amount }, successUrl: cfg.SUCCESS_URL, cancelUrl: cfg.CANCEL_URL })
    }).then(r=>r.json()).then(d=>{ if(!d.orderID) throw new Error(d.error||'No se pudo crear la orden'); return d.orderID; }),
    onApprove: (data, actions) => actions.order.capture().then(()=>{ alert('Pago completado. Revisa tu correo para activar tu cuenta.'); window.location.href = cfg.SUCCESS_URL; }),
    onCancel: ()=> window.location.href = cfg.CANCEL_URL,
    onError:  (err)=>{ console.error('PayPal error', err); alert('Error con PayPal. Intenta de nuevo.'); }
  }).render('#' + containerId);
}

document.querySelectorAll('button[data-plan]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const plan = btn.getAttribute('data-plan');
    const amount = btn.getAttribute('data-amount');
    const invites = parseInt(btn.getAttribute('data-invites'),10);
    const containerId = `paypal-${plan}`;
    renderPayPalButton({ containerId, amount, licenseType: plan, maxInvites: invites });
    document.getElementById(containerId)?.scrollIntoView({ behavior:'smooth', block:'center' });
  });
});

// ===== Testimonios: hover instantáneo + pausa de rotación
(function testimonials(){
  const items = Array.from(document.querySelectorAll('.testimonial'));
  if(items.length<=1) return;
  let idx = 0, timer = null, paused = false;

  function setActive(i){
    items.forEach(el=>el.classList.remove('active'));
    items[i].classList.add('active');
  }
  function play(){
    timer = setInterval(()=>{ if(paused) return; idx = (idx+1)%items.length; setActive(idx); }, 3600);
  }
  items.forEach((el,i)=>{
    el.addEventListener('mouseenter', ()=>{ paused=true; setActive(i); });
    el.addEventListener('mouseleave', ()=>{ paused=false; });
  });
  setActive(0); play();
})();

// ===== Scroll reveal
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('is-visible'); io.unobserve(e.target); } });
},{ threshold:.15 });
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// ===== Parallax decor (ligero)
const decors = document.querySelectorAll('.decor');
window.addEventListener('mousemove', (e)=>{
  const { innerWidth:w, innerHeight:h } = window;
  const x = (e.clientX - w/2) / (w/2);
  const y = (e.clientY - h/2) / (h/2);
  decors.forEach((d,i)=>{
    const dx = (i+1) * 6 * x; const dy = (i+1) * 4 * y;
    d.style.transform = `translate(${dx}px, ${dy}px)`;
  });
});

// ===== Mini calculadora (teaser) en HERO — sin contingencia/ utilidad
const CL_STRUCTS = ['Muro','Losa','Cimentación','General']; // demo
const CL_PRESETS = [
  { name:'Cemento (bolsa)', unit:'m²', price:6 },
  { name:'Arena',           unit:'m³', price:18 },
  { name:'Acero',           unit:'kg', price:1.1 },
  { name:'Ladrillo',        unit:'m²', price:12 }
];

const cl = {
  maxRows:3,
  tbody:document.getElementById('cl-rows'),
  addBtn:document.getElementById('cl-add'),
  limitMsg:document.getElementById('cl-limit'),
  total:document.getElementById('cl-total'),
};

function clFmt(n){ return isFinite(n) ? n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}) : '$0'; }

function structSelect(){
  return `<select class="cl-struct">
    ${CL_STRUCTS.map(s=>`<option value="${s}">${s}</option>`).join('')}
  </select>`;
}

function presetSelect(){
  const opts = CL_PRESETS.map(p=>{
    const val = JSON.stringify({name:p.name, unit:p.unit, price:p.price}).replace(/"/g,'&quot;');
    return `<option value="${val}">${p.name} — ${clFmt(p.price)}/${p.unit}</option>`;
  }).join('');
  return `<select class="cl-preset">${opts}</select>`;
}

function clRowTemplate(i){
  return `
  <tr data-idx="${i}">
    <td>${structSelect()}</td>
    <td>${presetSelect()}</td>
    <td><input class="cl-desc" type="text" placeholder="Ej. Muro 30x30 m²" /></td>
    <td><input class="cl-qty"  type="number" min="0" step="0.01" value="1" /></td>
    <td><input class="cl-unit" type="text" value="${CL_PRESETS[0].unit}" /></td>
    <td><input class="cl-price" type="number" min="0" step="0.01" value="${CL_PRESETS[0].price}" /></td>
    <td class="sub"><span class="cl-sub">$0</span></td>
    <td><button type="button" class="del">✕</button></td>
  </tr>`;
}

function clAddRow(){
  const rows = cl.tbody.querySelectorAll('tr').length;
  if(rows >= cl.maxRows){ cl.limitMsg.hidden = false; return; }
  cl.limitMsg.hidden = true;
  cl.tbody.insertAdjacentHTML('beforeend', clRowTemplate(rows));
  clBindRow(cl.tbody.lastElementChild);
  clRecalc();
}

function clBindRow(tr){
  const preset = tr.querySelector('.cl-preset');
  const unit   = tr.querySelector('.cl-unit');
  const price  = tr.querySelector('.cl-price');
  const qty    = tr.querySelector('.cl-qty');
  const delBtn = tr.querySelector('.del');

  preset.addEventListener('change', ()=>{
    try{ const obj = JSON.parse(preset.value); unit.value=obj.unit; price.value=obj.price; }catch(e){}
    clRecalc();
  });
  [price, qty, unit].forEach(el=> el.addEventListener('input', clRecalc));
  delBtn.addEventListener('click', ()=>{ tr.remove(); cl.limitMsg.hidden = true; clRecalc(); });
}

function clRecalc(){
  let total = 0;
  cl.tbody.querySelectorAll('tr').forEach(tr=>{
    const q = parseFloat(tr.querySelector('.cl-qty').value || '0');
    const p = parseFloat(tr.querySelector('.cl-price').value || '0');
    const s = (q*p)||0;
    tr.querySelector('.cl-sub').textContent = clFmt(s);
    total += s;
  });
  cl.total.textContent = clFmt(total);
  cl.total.classList.add('pop'); setTimeout(()=>cl.total.classList.remove('pop'), 260);
}

if(cl.addBtn && cl.tbody){
  cl.addBtn.addEventListener('click', clAddRow);
  // arranca con 1 línea
  clAddRow();
}


// ===== KPIs counters
function animateCounter(el){
  const to = parseInt(el.getAttribute('data-to'),10) || 0;
  const dur = 900; const start = performance.now();
  function step(t){ const p = Math.min(1,(t-start)/dur); el.textContent = Math.floor(p*to); if(p<1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}
new IntersectionObserver((ents, obs)=>{
  ents.forEach(e=>{ if(e.isIntersecting){ e.target.querySelectorAll('.counter').forEach(animateCounter); obs.unobserve(e.target); } });
},{ threshold:.4 }).observe(document.querySelector('.kpis'));


 (function(){
    if (document.querySelector('.floating-cta')) {
      document.body.classList.add('with-fab');
    }
  })();