// ===== Fecha footer
document.getElementById('year').textContent = new Date().getFullYear();

// ===== Scroll suave
document.querySelectorAll('.nav a[href^="#"], a.btn[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href'); if (!id || id === '#') return;
    const el = document.querySelector(id); if (!el) return;
    e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});




// ⚙️ Config
const cfg = window.OBT_CONFIG || {
  CREATE_ORDER_URL: '/create-order',
  SUCCESS_URL: window.location.origin + '/gracias.html',
  CANCEL_URL: window.location.origin + '/cancelar.html'
};

// ===== Firebase init (compat)
(function initFirebase() {
  if (!window.firebase?.apps?.length) {
    firebase.initializeApp(cfg.firebaseConfig);
  }
  window.$auth = firebase.auth();
  window.$db = firebase.firestore();
})();

// Helpers DOM
const $ = (sel, root = document) => root.querySelector(sel);

// ===== Modal helpers
function openPostPayModal({ plan, invites, amount, orderID }) {
  $('#pp-plan-pill').textContent = plan.toUpperCase();
  $('#pp-plan').value = plan;
  $('#pp-invites').value = invites;
  $('#pp-amount').value = amount;
  $('#pp-order').value = orderID;

  $('#postpay-modal').classList.add('show');
  $('#pp-name').focus();
}
$('#pp-close')?.addEventListener('click', () => $('#postpay-modal').classList.remove('show'));

// ===== PayPal
function renderPayPalButton({ containerId, amount, licenseType, maxInvites }) {
  if (!window.paypal) { alert('SDK de PayPal no cargó. Revisa tu client-id en index.html'); return; }
  const container = document.getElementById(containerId); if (!container) return;
  container.innerHTML = '';
  paypal.Buttons({
    style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'pay' },
    createOrder: () => fetch(cfg.CREATE_ORDER_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: { licenseType, maxInvites, amount },
        successUrl: cfg.SUCCESS_URL,
        cancelUrl: cfg.CANCEL_URL
      })
    })
      .then(r => r.json())
      .then(d => { if (!d.orderID) throw new Error(d.error || 'No se pudo crear la orden'); return d.orderID; }),

    onApprove: async (data, actions) => {
      await actions.order.capture(); // captura en PayPal
      openPostPayModal({
        plan: licenseType,
        invites: maxInvites,
        amount,
        orderID: data.orderID
      });
    },

    onCancel: () => window.location.href = cfg.CANCEL_URL,
    onError: (err) => { console.error('PayPal error', err); alert('Error con PayPal. Intenta de nuevo.'); }
  }).render('#' + containerId);
}

document.querySelectorAll('button[data-plan]').forEach(btn => {
  btn.addEventListener('click', () => {
    const plan = btn.getAttribute('data-plan');
    const amount = btn.getAttribute('data-amount');
    const invites = parseInt(btn.getAttribute('data-invites'), 10);
    const containerId = `paypal-${plan}`;
    renderPayPalButton({ containerId, amount, licenseType: plan, maxInvites: invites });
    document.getElementById(containerId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});

// ===== CARRUSEL PREMIUM =====
(function initCarouselPro(){
  const containers = document.querySelectorAll('.carousel-container');
  if (!containers.length) return;

  containers.forEach(container => {
    const carousel = container.querySelector('.carousel');
    const slides   = Array.from(container.querySelectorAll('.carousel-slide'));
    const prevBtn  = container.querySelector('#carousel-prev');
    const nextBtn  = container.querySelector('#carousel-next');
    const dotsWrap = container.querySelector('#carousel-indicators');
    const progress = container.querySelector('.carousel-progress > span');
    
    if (!carousel || !slides.length || !dotsWrap) return;

    // Configuración
    const interval = parseInt(container.getAttribute('data-interval') || '5200', 10);
    const autoplay = (container.getAttribute('data-autoplay') || 'true') !== 'false';
    const kenburns = container.getAttribute('data-kenburns') === 'true';
    const showProg = container.getAttribute('data-progress') === 'true';
    const parallaxCaption = container.getAttribute('data-parallax-caption') === 'true';
    const aspect = container.getAttribute('data-aspect') || '16/9';

    // Ratio seguro (usa aspect-ratio nativo)
    try {
      const [w, h] = aspect.split('/').map(Number);
      if (w > 0 && h > 0) {
        carousel.style.setProperty('--ratio', `${w} / ${h}`);
        if ('aspectRatio' in document.documentElement.style) {
          carousel.style.aspectRatio = `${w} / ${h}`;
        }
      }
    } catch {}

    carousel.setAttribute('role','region');
    carousel.setAttribute('aria-label','Carrusel');
    slides.forEach((s,i)=>{
      s.setAttribute('role','group');
      s.setAttribute('aria-roledescription','slide');
      s.setAttribute('aria-label',`${i+1} de ${slides.length}`);
    });
    carousel.toggleAttribute('data-kenburns', kenburns);

    // Indicadores
    dotsWrap.innerHTML = '';
    const dots = slides.map((_,i)=>{
      const b=document.createElement('button');
      b.type='button';
      b.addEventListener('click',()=>show(i,true));
      dotsWrap.appendChild(b);
      return b;
    });

    let current=0, rafId=null, lastTick=0, progressAcc=0;

    function show(idx,user=false){
      if(idx===current)return;
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');
      current=(idx+slides.length)%slides.length;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
      resetProgress(user);
    }
    function next(){show(current+1,true);}
    function prev(){show(current-1,true);}

    prevBtn?.addEventListener('click',prev);
    nextBtn?.addEventListener('click',next);

    carousel.setAttribute('tabindex','0');
    carousel.addEventListener('keydown',e=>{
      if(e.key==='ArrowRight'){e.preventDefault();next();}
      if(e.key==='ArrowLeft'){e.preventDefault();prev();}
    });

    // Swipe
    let sx=0,sy=0,swiping=false;
    const MIN=26;
    const start=e=>{
      swiping=true;
      sx=e.touches?e.touches[0].clientX:e.clientX;
      sy=e.touches?e.touches[0].clientY:e.clientY;
    };
    const move=e=>{
      if(!swiping)return;
      const x=e.touches?e.touches[0].clientX:e.clientX;
      const y=e.touches?e.touches[0].clientY:e.clientY;
      const dx=x-sx, dy=y-sy;
      if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>MIN){
        swiping=false; dx<0?next():prev();
      }
    };
    const end=()=>{swiping=false;};
    carousel.addEventListener('touchstart',start,{passive:true});
    carousel.addEventListener('touchmove',move,{passive:true});
    carousel.addEventListener('touchend',end);
    carousel.addEventListener('mousedown',start);
    window.addEventListener('mousemove',move);
    window.addEventListener('mouseup',end);

    // Parallax en caption
    if(parallaxCaption){
      carousel.addEventListener('mousemove',e=>{
        const active=slides[current].querySelector('.carousel-caption');
        if(!active)return;
        const r=carousel.getBoundingClientRect();
        const nx=(e.clientX-r.left)/r.width-0.5;
        const ny=(e.clientY-r.top)/r.height-0.5;
        active.style.transform=`translate3d(${nx*6}px,${ny*4}px,0)`;
      });
      carousel.addEventListener('mouseleave',()=>{
        const active=slides[current].querySelector('.carousel-caption');
        if(active)active.style.transform='translate3d(0,0,0)';
      });
    }

    // Progreso con rAF
    function tick(t){
      if(!lastTick)lastTick=t;
      const dt=t-lastTick; lastTick=t;
      progressAcc+=dt;
      const p=Math.min(1,progressAcc/interval);
      if(showProg&&progress)progress.style.width=(p*100).toFixed(2)+'%';
      if(p>=1)next();
      rafId=requestAnimationFrame(tick);
    }
    function resetProgress(user){
      progressAcc=0; lastTick=0;
      if(showProg&&progress)progress.style.width='0%';
      if(user)restart();
    }
    function play(){
      if(!autoplay||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      stop(); rafId=requestAnimationFrame(tick);
    }
    function stop(){ if(rafId)cancelAnimationFrame(rafId),rafId=null; }
    function restart(){ stop(); play(); }

    carousel.addEventListener('mouseenter',stop);
    carousel.addEventListener('mouseleave',play);

    const io=new IntersectionObserver(ents=>{
      ents.forEach(en=>{en.isIntersecting?play():stop();});
    },{threshold:.45});
    io.observe(container);

    slides.forEach(s=>s.classList.remove('active'));
    dots.forEach(d=>d.classList.remove('active'));
    slides[0].classList.add('active');
    dots[0].classList.add('active');
    play();
  });
})();

// ===== Testimonios (rotación con pausa por hover)
(function testimonials() {
  const items = Array.from(document.querySelectorAll('.testimonial'));
  if (items.length <= 1) return;
  let idx = 0, timer = null, paused = false;
  function setActive(i) {
    items.forEach(el => el.classList.remove('active'));
    items[i].classList.add('active');
  }
  function play() {
    timer = setInterval(() => { if (paused) return; idx = (idx + 1) % items.length; setActive(idx); }, 3600);
  }
  items.forEach((el, i) => {
    el.addEventListener('mouseenter', () => { paused = true; setActive(i); });
    el.addEventListener('mouseleave', () => { paused = false; });
  });
  setActive(0); play();
})();

// ===== Scroll reveal
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } });
}, { threshold: .15 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ===== Parallax decor
const decors = document.querySelectorAll('.decor');
window.addEventListener('mousemove', (e) => {
  const { innerWidth: w, innerHeight: h } = window;
  const x = (e.clientX - w / 2) / (w / 2);
  const y = (e.clientY - h / 2) / (h / 2);
  decors.forEach((d, i) => {
    const dx = (i + 1) * 6 * x; const dy = (i + 1) * 4 * y;
    d.style.transform = `translate(${dx}px, ${dy}px)`;
  });
});

// ===== Mini calculadora (teaser)
const CL_STRUCTS = ['Muro', 'Losa', 'Cimentación', 'General']; // demo
const CL_PRESETS = [
  { name: 'Cemento (bolsa)', unit: 'm²', price: 6 },
  { name: 'Arena', unit: 'm³', price: 18 },
  { name: 'Acero', unit: 'kg', price: 1.1 },
  { name: 'Ladrillo', unit: 'm²', price: 12 }
];

const cl = {
  maxRows: 3,
  tbody: document.getElementById('cl-rows'),
  addBtn: document.getElementById('cl-add'),
  limitMsg: document.getElementById('cl-limit'),
  total: document.getElementById('cl-total'),
};

function clFmt(n) { return isFinite(n) ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }) : '$0'; }

function structSelect() {
  return `<select class="cl-struct">
    ${CL_STRUCTS.map(s => `<option value="${s}">${s}</option>`).join('')}
  </select>`;
}
function presetSelect() {
  const opts = CL_PRESETS.map(p => {
    const val = JSON.stringify({ name: p.name, unit: p.unit, price: p.price }).replace(/"/g, '&quot;');
    return `<option value="${val}">${p.name} — ${clFmt(p.price)}/${p.unit}</option>`;
  }).join('');
  return `<select class="cl-preset">${opts}</select>`;
}
function clRowTemplate(i) {
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
function clAddRow() {
  const rows = cl.tbody?.querySelectorAll('tr').length || 0;
  if (!cl.tbody || rows >= cl.maxRows) { if (cl.limitMsg) cl.limitMsg.hidden = false; return; }
  if (cl.limitMsg) cl.limitMsg.hidden = true;
  cl.tbody.insertAdjacentHTML('beforeend', clRowTemplate(rows));
  clBindRow(cl.tbody.lastElementChild);
  clRecalc();
}
function clBindRow(tr) {
  const preset = tr.querySelector('.cl-preset');
  const unit = tr.querySelector('.cl-unit');
  const price = tr.querySelector('.cl-price');
  const qty = tr.querySelector('.cl-qty');
  const delBtn = tr.querySelector('.del');

  preset.addEventListener('change', () => {
    try { const obj = JSON.parse(preset.value); unit.value = obj.unit; price.value = obj.price; } catch (e) { }
    clRecalc();
  });
  [price, qty, unit].forEach(el => el.addEventListener('input', clRecalc));
  delBtn.addEventListener('click', () => { tr.remove(); if (cl.limitMsg) cl.limitMsg.hidden = true; clRecalc(); });
}
function clRecalc() {
  let total = 0;
  cl.tbody?.querySelectorAll('tr').forEach(tr => {
    const q = parseFloat(tr.querySelector('.cl-qty').value || '0');
    const p = parseFloat(tr.querySelector('.cl-price').value || '0');
    const s = (q * p) || 0;
    tr.querySelector('.cl-sub').textContent = clFmt(s);
    total += s;
  });
  if (cl.total) {
    cl.total.textContent = clFmt(total);
    cl.total.classList.add('pop'); setTimeout(() => cl.total.classList.remove('pop'), 260);
  }
}
if (cl.addBtn && cl.tbody) {
  cl.addBtn.addEventListener('click', clAddRow);
  clAddRow(); // arranca con 1 línea
}

// ===== KPI counters
function animateCounter(el) {
  const to = parseInt(el.getAttribute('data-to'), 10) || 0;
  const dur = 900; const start = performance.now();
  function step(t) { const p = Math.min(1, (t - start) / dur); el.textContent = Math.floor(p * to); if (p < 1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}
new IntersectionObserver((ents, obs) => {
  ents.forEach(e => { if (e.isIntersecting) { e.target.querySelectorAll('.counter').forEach(animateCounter); obs.unobserve(e.target); } });
}, { threshold: .4 }).observe(document.querySelector('.kpis'));

// Ajuste FAB
(function () { if (document.querySelector('.floating-cta')) { document.body.classList.add('with-fab'); } })();

// ===== Registro post-pago (SUBMIT)
$('#pp-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = $('#pp-name').value.trim();
  const email = $('#pp-email').value.trim();
  const pass1 = $('#pp-pass').value;
  const pass2 = $('#pp-pass2').value;
  const plan = $('#pp-plan').value;
  const invites = parseInt($('#pp-invites').value || '0', 10);
  const amount = $('#pp-amount').value;
  const orderID = $('#pp-order').value;

  const err = $('#pp-error'); err.textContent = '';
  const btn = $('#pp-submit'); btn.disabled = true;

  if (!name || !email || pass1.length < 6 || pass1 !== pass2) {
    err.textContent = 'Revisa nombre, correo y que las contraseñas coincidan (mín. 6).';
    btn.disabled = false; return;
  }

  const APP_OWNER_ROL = 'administrador';

  try {
    // 1) Crear usuario
    const cred = await $auth.createUserWithEmailAndPassword(email, pass1);
    await cred.user.updateProfile({ displayName: name });

    // 2) Crear tenant + membresía
    const db = $db;
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const tenantRef = db.collection('tenants').doc();
    const tenantId = tenantRef.id;

    const batch = db.batch();
    // === Periodo inicial (30 días + 3 de gracia)
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const MS_30D = 30 * ONE_DAY;
    const MS_GRACE = 3 * ONE_DAY;

    const startMs = Date.now();
    const endMs = startMs + MS_30D;
    const graceMs = endMs + MS_GRACE;

    const periodStartTs = firebase.firestore.Timestamp.fromDate(new Date(startMs));
    const periodEndTs = firebase.firestore.Timestamp.fromDate(new Date(endMs));
    const periodEndGraceTs = firebase.firestore.Timestamp.fromDate(new Date(graceMs));



    batch.set(tenantRef, {
      meta: {
        plan,
        amountUSD: amount,
        status: 'active',
        maxUsers: (plan === 'basic' ? 4 : 10),
        createdAt: now,
        ownerUid: cred.user.uid,
        orderId: orderID,
        periodStart: periodStartTs,
        periodEnd: periodEndTs,
        periodEndGrace: periodEndGraceTs,   // ← FALTA GUARDARLA
        cancelAtPeriodEnd: false,           // ← INIIALÍZALO EN FALSE
        renewalsCount: 0,
        lastPayment: {
          orderId: orderID,
          amountUSD: Number(amount),
          paidAt: now
        }
      }
    });

    const memberRef = tenantRef.collection('members').doc(cred.user.uid);
    batch.set(memberRef, {
      role: APP_OWNER_ROL,
      rol: APP_OWNER_ROL,
      invitedBy: null,
      createdAt: now,
      email,
      name
    });

    const userRef = db.collection('users').doc(cred.user.uid);
    batch.set(userRef, {
      name,
      email,
      tenantId,
      plan,
      rol: APP_OWNER_ROL,
      memberships: { [tenantId]: APP_OWNER_ROL },
      createdAt: now
    }, { merge: true });

    await batch.commit();

    // 3) Persistencia local y redirección
    localStorage.setItem('OBT_TENANT', tenantId);
    localStorage.setItem('OBT_ROLE', APP_OWNER_ROL);

    // Cierra modal
    $('#postpay-modal').classList.remove('show');

    // ✅ Redirige a /gracias.html con QS
    const qs = new URLSearchParams({ plan, email, tenantId }).toString();
    const url = `${cfg.SUCCESS_URL}?${qs}`;
    window.location.assign(url);                  // principal
    setTimeout(() => location.replace(url), 300); // fallback
    return; // corta ejecución

  } catch (e2) {
    console.error(e2);
    err.textContent = (e2?.message || 'Error al crear la cuenta');
  } finally {
    btn.disabled = false;
  }
});

console.log('build gracias4');



// ===============
// Helpers landing
// ===============
const $$ = (sel, root = document) => root.querySelector(sel);

function fmtDate(ts) {
  try {
    if (!ts) return '-';
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString();
  } catch { return '-'; }
}

// Lee tenantId del user y la metadata del tenant
async function loadTenantMetaForCurrentUser() {
  const uid = $auth.currentUser?.uid;
  if (!uid) throw new Error('No autenticado');
  const u = await $db.collection('users').doc(uid).get();
  if (!u.exists) throw new Error('No se encontró el usuario');
  const tenantId = u.data()?.tenantId;
  if (!tenantId) throw new Error('No tienes tenant asignado');

  const tRef = $db.collection('tenants').doc(tenantId);
  const t = await tRef.get();
  if (!t.exists) throw new Error('Tenant no encontrado');

  const meta = t.data()?.meta || {};
  // Validar que el user sea el owner (solo owner puede renovar/cancelar)
  if (meta.ownerUid !== uid) throw new Error('Solo el owner puede gestionar la licencia');

  return { tenantId, meta, tRef };
}

// Render del bloque de datos en UI
function showRenewData({ tenantId, meta, email }) {
  $$('#renew-email').textContent = email || ($auth.currentUser?.email || '-');
  $$('#renew-tenant').textContent = tenantId;
  $$('#renew-plan').textContent = meta.plan || '-';
  $$('#renew-status').textContent = meta.status || '-';
  $$('#renew-end').textContent = fmtDate(meta.periodEnd);
  $$('#renew-amount').textContent = meta.amountUSD ? `$${Number(meta.amountUSD).toFixed(2)} / mes` : '-';
  $$('#renew-error').textContent = '';
}

// ===============
// PayPal: Renovar
// ===============
function renderRenewPayPalButton({ amount, licenseType }) {
  const containerId = 'paypal-renew';
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';

  if (!window.paypal) {
    alert('SDK de PayPal no cargó. Revisa tu client-id en el <script> de la landing.');
    return;
  }

  paypal.Buttons({
    style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'pay' },
    createOrder: () => fetch(cfg.CREATE_ORDER_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: { licenseType, maxInvites: 3, amount }, // maxInvites no afecta la renovación, pero mantenemos el formato
        successUrl: cfg.SUCCESS_URL,
        cancelUrl: cfg.CANCEL_URL,
        mode: 'renew'
      })
    }).then(r => r.json()).then(d => {
      if (!d.orderID) throw new Error(d.error || 'No se pudo crear la orden');
      return d.orderID;
    }),

    onApprove: async (data, actions) => {
      await actions.order.capture();
      try {
        await applyRenewal({ orderID: data.orderID, amount, licenseType });
        alert('¡Renovación aplicada correctamente!');
        // recarga datos en UI
        await landingRefreshRenewState();
      } catch (e) {
        console.error(e);
        alert('Ocurrió un error al aplicar la renovación.');
      }
    },

    onCancel: () => { /* opcional redirigir */ },
    onError: (err) => { console.error('PayPal error', err); alert('Error con PayPal. Intenta de nuevo.'); }
  }).render('#' + containerId);
}

// Aplica la renovación (extiende 30 días)
async function applyRenewal({ orderID, amount, licenseType }) {
  const uid = $auth.currentUser?.uid;
  if (!uid) throw new Error('No autenticado');
  const u = await $db.collection('users').doc(uid).get();
  const tenantId = u.data()?.tenantId;
  if (!tenantId) throw new Error('Sin tenant');

  const tRef = $db.collection('tenants').doc(tenantId);
  await $db.runTransaction(async (tx) => {
    const t = await tx.get(tRef);
    if (!t.exists) throw new Error('Tenant no existe');
    const meta = t.data().meta || {};

    // Solo owner
    if (meta.ownerUid !== uid) throw new Error('Solo el owner puede renovar');

    const base = Math.max(Date.now(), meta.periodEnd?.toMillis?.() || Date.now());
    const DAY = 24 * 60 * 60 * 1000, PLUS = 30 * DAY, GRACE = 3 * DAY;

    const newStart = new Date(base);                 // arranca desde el fin actual o ahora
    const newEnd = new Date(base + PLUS);
    const newGrace = new Date(base + PLUS + GRACE);

    tx.update(tRef, {
      'meta.plan': licenseType || meta.plan,
      'meta.status': 'active',
      'meta.cancelAtPeriodEnd': false,
      'meta.periodStart': firebase.firestore.Timestamp.fromDate(newStart),
      'meta.periodEnd': firebase.firestore.Timestamp.fromDate(newEnd),
      'meta.periodEndGrace': firebase.firestore.Timestamp.fromDate(newGrace),
      'meta.renewalsCount': (meta.renewalsCount || 0) + 1,
      'meta.lastPayment': {
        orderId: orderID,
        amountUSD: Number(amount),
        paidAt: firebase.firestore.FieldValue.serverTimestamp()
      }
    });

    // historial (opcional)
    tx.set(tRef.collection('payments').doc(orderID), {
      orderId: orderID,
      amountUSD: Number(amount),
      plan: licenseType || meta.plan,
      type: 'renewal',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      by: uid
    });
  });
}

// ===============
// Cancelaciones
// ===============
async function cancelAtPeriodEndLanding() {
  try {
    const { tenantId, meta } = await loadTenantMetaForCurrentUser();
    await $db.collection('tenants').doc(tenantId).update({
      'meta.cancelAtPeriodEnd': true
    });
    alert(`Se cancelará al finalizar el período (sigue activo hasta ${fmtDate(meta.periodEnd)}).`);
    await landingRefreshRenewState();
  } catch (e) {
    console.error(e);
    $$('#renew-error').textContent = e.message || 'No se pudo marcar la cancelación al final del período.';
  }
}

async function cancelNowLanding() {
  try {
    const { tenantId } = await loadTenantMetaForCurrentUser();
    const nowTs = firebase.firestore.Timestamp.fromDate(new Date());
    await $db.collection('tenants').doc(tenantId).update({
      'meta.status': 'canceled',
      'meta.periodEnd': nowTs,
      'meta.periodEndGrace': nowTs
    });
    alert('Acceso cancelado de inmediato.');
    await landingRefreshRenewState();
  } catch (e) {
    console.error(e);
    $$('#renew-error').textContent = e.message || 'No se pudo cancelar de inmediato.';
  }
}

// ===============
// Estado en la Landing
// ===============
async function landingRefreshRenewState() {
  const boxOut = $$('#renew-logged-out');
  const boxLoad = $$('#renew-loading');
  const boxIn = $$('#renew-logged-in');

  if (!$auth.currentUser) {
    boxOut.hidden = false;
    boxLoad.hidden = true;
    boxIn.hidden = true;
    return;
  }

  // Logueado
  boxOut.hidden = true;
  boxLoad.hidden = false;
  boxIn.hidden = true;

  try {
    const { tenantId, meta } = await loadTenantMetaForCurrentUser();
    showRenewData({ tenantId, meta, email: $auth.currentUser.email });

    boxLoad.hidden = true;
    boxIn.hidden = false;

    // Render PayPal al pulsar el botón (evita render doble)
    $$('#btn-render-renew').onclick = () => {
      renderRenewPayPalButton({ amount: meta.amountUSD || '30.00', licenseType: meta.plan || 'basic' });
      document.getElementById('paypal-renew')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  } catch (e) {
    console.error(e);
    $$('#renew-error').textContent = e.message || 'No se pudo cargar la licencia.';
    boxLoad.hidden = true;
    boxIn.hidden = false; // mostramos el contenedor para ver el error
  }
}

// ===============
// Login modal (landing)
// ===============
(function landingAuthUI() {
  const modal = $$('#login-modal');
  const openBtn = $$('#btn-open-login');
  const closeBtn = $$('#login-close');
  const form = $$('#login-form');
  const err = $$('#login-error');

  openBtn?.addEventListener('click', () => { modal.classList.add('show'); $$('#login-email').focus(); });
  closeBtn?.addEventListener('click', () => { modal.classList.remove('show'); err.textContent = ''; });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const email = $$('#login-email').value.trim();
    const pass = $$('#login-pass').value;
    const btn = $$('#login-submit'); btn.disabled = true;
    try {
      await $auth.signInWithEmailAndPassword(email, pass);
      modal.classList.remove('show');
      await landingRefreshRenewState();
    } catch (e2) {
      console.error(e2);
      err.textContent = e2?.message || 'Error al iniciar sesión';
    } finally {
      btn.disabled = false;
    }
  });

  // Logout
  $$('#btn-logout')?.addEventListener('click', async () => {
    await $auth.signOut();
    document.getElementById('paypal-renew').innerHTML = '';
    await landingRefreshRenewState();
  });

  // Botones cancelar
  $$('#btn-cancel-later')?.addEventListener('click', cancelAtPeriodEndLanding);
  $$('#btn-cancel-now')?.addEventListener('click', cancelNowLanding);

  // Estado inicial
  $auth.onAuthStateChanged(() => {
    // Cuando cambia el auth, refresca bloque de renovación
    landingRefreshRenewState();
  });
})();
