/* ============================================================
   WEST FALMOUTH MARKET — DELI BOARD APP
   Displays the slideshow. All editing now happens on a separate
   page (admin.html) which saves to the server (see /api/board),
   so every screen showing this page automatically stays in sync
   — nothing is read from or written to this browser's storage.
   ============================================================ */
const DATA_API = 'api/board';
const REFRESH_MS = 3 * 60 * 1000; // re-check the server for edits every 3 minutes

// Show something immediately using the bundled defaults from data.js,
// then swap in the live server copy as soon as it arrives.
let data = JSON.parse(JSON.stringify(BOARD_DATA));
let slides = [];
let current = 0;
let timer = null;
let paused = false;

function normalizeData(d){
  if(!d || !Array.isArray(d.categories) || !Array.isArray(d.promos) || !d.settings) return null;
  return d;
}

async function fetchServerData(){
  try{
    const res = await fetch(DATA_API, { cache:'no-store' });
    if(!res.ok) return null;
    const record = await res.json();
    return normalizeData(record && record.data);
  }catch(e){
    return null; // offline, or the /api/board function isn't set up yet — keep using data.js
  }
}

async function refreshDataFromServer(){
  const serverData = await fetchServerData();
  if(serverData){
    const changed = JSON.stringify(serverData) !== JSON.stringify(data);
    data = serverData;
    if(changed){ current = 0; render(); resetTimer(); }
  }
}

/* ---------------- daypart logic ---------------- */
function toMinutes(hhmm){
  const [h,m] = (hhmm||'0:0').split(':').map(Number);
  return h*60+(m||0);
}
function isBreakfastWindow(now){
  const dp = data.settings.daypart;
  const day = now.getDay(); // 0 = Sunday
  const mins = now.getHours()*60 + now.getMinutes();
  const start = toMinutes(dp.breakfastStart);
  const end = toMinutes(day===0 ? dp.breakfastEndSunday : dp.breakfastEndWeekday);
  return mins >= start && mins < end;
}
function currentDaypartLabel(){
  const h = new Date().getHours();
  if(h < 11) return 'Good Morning';
  if(h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/* ---------------- slide building ---------------- */
function esc(str){
  return (str||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function visibleCategories(){
  const now = new Date();
  const inBreakfast = isBreakfastWindow(now);
  return data.categories.filter(cat=>{
    if(cat.daypart === 'breakfast' && data.settings.daypart.hideBreakfastOutsideWindow){
      return inBreakfast;
    }
    return true;
  });
}

function buildSlides(){
  const s = [];
  if(data.settings.showWelcome) s.push({ type:'welcome' });

  const slidePromos = data.promos.filter(p=>p.active && p.mode==='slide');
  let promoCursor = 0, sinceLastPromo = 0;
  const freq = Math.max(1, data.settings.promoFrequency||3);

  visibleCategories().forEach(cat=>{
    s.push({ type:'category', cat });
    sinceLastPromo++;
    if(slidePromos.length && sinceLastPromo>=freq){
      s.push({ type:'promo', promo: slidePromos[promoCursor % slidePromos.length] });
      promoCursor++; sinceLastPromo=0;
    }
  });
  if(!s.length) s.push({ type:'welcome' });
  return s;
}

function columnsFor(count){
  if(count<=3) return 1;
  if(count<=8) return 2;
  if(count<=15) return 3;
  return 4;
}

function renderSlideHTML(slide){
  if(slide.type==='welcome'){
    return `<div class="slide welcome">
      <img src="assets/logo.png" alt="West Falmouth Market">
      <div class="greeting">${esc(currentDaypartLabel())}</div>
      <div class="tagline">Boar's Head meats, fresh-baked bread &amp; house-smoked everything &mdash; sliced, stacked and ready for you.</div>
    </div>`;
  }
  if(slide.type==='promo'){
    const p = slide.promo;
    return `<div class="slide promo-slide">
      <div class="badge">${esc(p.badge||'Special')}</div>
      <h1>${esc(p.title||'')}</h1>
      ${p.desc?`<p>${esc(p.desc)}</p>`:''}
      ${p.price?`<div class="price">${esc(p.price)}</div>`:''}
    </div>`;
  }

  const cat = slide.cat;
  const items = cat.items || [];
  const solo = items.length <= 4 && cat.image;
  const cols = solo ? 1 : columnsFor(items.length);

  const itemHTML = items.map(it=>`
    <div class="item">
      <div class="top-row"><h3>${esc(it.name)}</h3><span class="price">$${esc(it.price)}</span></div>
      ${it.desc?`<p>${esc(it.desc)}</p>`:''}
    </div>`).join('');

  const photoPanel = cat.image ? `<div class="photo-panel">
      <img src="${esc(cat.image)}" alt="${esc(cat.name)}" onerror="this.closest('.photo-panel').style.display='none'; this.closest('.cat-body').classList.remove('solo'); this.closest('.slide').classList.remove('has-photo');">
      <div class="caption">${esc(cat.name)}</div>
    </div>` : '';

  const bgStyle = cat.image ? ` style="--slide-photo:url('${esc(cat.image)}')"` : '';
  const hasPhotoClass = cat.image ? ' has-photo' : '';

  return `<div class="slide${hasPhotoClass}" data-cat="${esc(cat.id)}"${bgStyle}>
    <div class="cat-head">
      <h1>${esc(cat.name)}</h1>
      ${cat.note?`<div class="sub">${esc(cat.note)}</div>`:'<div class="rule"></div>'}
    </div>
    <div class="cat-body${solo?' solo':''}">
      ${solo?photoPanel:''}
      <div class="items-panel" style="--cols:${cols}">${itemHTML}</div>
    </div>
  </div>`;
}

function autoFitSlide(slideEl){
  const panel = slideEl.querySelector('.items-panel');
  if(!panel) return;
  panel.style.setProperty('--fit', 1);
  let fit = 1;
  let guard = 0;
  while(panel.scrollHeight > panel.clientHeight + 2 && fit > 0.5 && guard < 20){
    fit -= 0.04;
    panel.style.setProperty('--fit', fit.toFixed(2));
    guard++;
  }
}

function render(){
  slides = buildSlides();
  if(current >= slides.length) current = 0;
  const stage = document.getElementById('stage');
  stage.innerHTML = slides.map(renderSlideHTML).join('');
  stage.style.transform = `translateX(-${current*100}vw)`;

  stage.querySelectorAll('.slide[data-cat]').forEach(autoFitSlide);

  const dots = document.getElementById('dots');
  dots.innerHTML = slides.map((_,i)=>`<div class="dot ${i===current?'on':''}"></div>`).join('');

  const ribbon = data.promos.find(p=>p.active && p.mode==='ribbon');
  const wrap = document.getElementById('ribbonPennant');
  if(ribbon){
    wrap.classList.add('active');
    document.getElementById('ribbonBadge').textContent = ribbon.badge || 'Promo';
    document.getElementById('ribbonTitle').textContent = ribbon.title || '';
  } else {
    wrap.classList.remove('active');
  }
}

function goTo(i){
  current = ((i % slides.length) + slides.length) % slides.length;
  document.getElementById('stage').style.transform = `translateX(-${current*100}vw)`;
  document.querySelectorAll('.dot').forEach((d,idx)=>d.classList.toggle('on', idx===current));
}
function next(){ goTo(current+1); }

function resetTimer(){
  clearInterval(timer);
  if(paused) return;
  const secs = Math.max(4, data.settings.slideDurationSec||12);
  timer = setInterval(next, secs*1000);
}
function togglePause(){
  paused = !paused;
  document.getElementById('pausePill').classList.toggle('show', paused);
  resetTimer();
}
document.getElementById('stage').addEventListener('click', togglePause);

/* re-check daypart + rebuild slides once a minute, so breakfast
   drops off the board automatically at closing time */
setInterval(()=>{
  const before = JSON.stringify(slides.map(s=>s.type + (s.cat?s.cat.id:'')));
  const after = JSON.stringify(buildSlides().map(s=>s.type + (s.cat?s.cat.id:'')));
  if(before !== after){ current = 0; render(); resetTimer(); }
}, 60*1000);

/* clock */
function tickClock(){
  const now = new Date();
  const time = now.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
  const date = now.toLocaleDateString([], {weekday:'long', month:'long', day:'numeric'});
  document.getElementById('clock').innerHTML = `${time}<span class="date">${date}</span>`;
}
tickClock();
setInterval(tickClock, 15000);

/* ============================================================
   FULLSCREEN / KIOSK MODE
   Needed so an old Android box's Chrome browser fills the whole
   TV instead of showing the address bar / nav buttons. Mobile
   Chrome (including on Android 5) only allows entering fullscreen
   from a real tap, so we show a full-screen "tap to start" gate
   once on load; after that first tap the board stays fullscreen
   on its own. If fullscreen ever drops (e.g. Chrome reloads the
   page after a brief network hiccup) the gate quietly reappears.
   ============================================================ */
function isFullscreen(){
  return !!(document.fullscreenElement || document.webkitFullscreenElement ||
            document.mozFullScreenElement || document.msFullscreenElement);
}
function requestFullscreen(){
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen ||
              el.webkitRequestFullScreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if(req){ try{ req.call(el); }catch(e){} }
}
function hideAddressBarFallback(){
  // Belt-and-suspenders for browsers/devices where the Fullscreen API is
  // unavailable or blocked: the classic scroll trick nudges the page so
  // the URL bar slides away even without true fullscreen.
  window.scrollTo(0,1);
  setTimeout(()=>window.scrollTo(0,1), 300);
}
function enterKiosk(){
  requestFullscreen();
  hideAddressBarFallback();
  const gate = document.getElementById('fsGate');
  if(gate) gate.classList.add('hide');
}
const fsGate = document.getElementById('fsGate');
if(fsGate){
  fsGate.addEventListener('click', enterKiosk);
  fsGate.addEventListener('touchend', enterKiosk);
}
['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'].forEach(evt=>{
  document.addEventListener(evt, ()=>{
    if(!isFullscreen() && fsGate) fsGate.classList.remove('hide');
  });
});
window.addEventListener('load', hideAddressBarFallback);
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible' && !isFullscreen() && fsGate) fsGate.classList.remove('hide');
});

/* keyboard helpers for screens with a mouse/keyboard attached */
document.addEventListener('keydown', e=>{
  if(e.key==='f' || e.key==='F') enterKiosk();
  if(e.key==='e' || e.key==='E') window.open('admin.html', '_blank');
  if(e.key==='Escape' && fsGate) fsGate.classList.remove('hide');
});

/* ============================================================
   INIT
   ============================================================ */
render();
resetTimer();
refreshDataFromServer();
setInterval(refreshDataFromServer, REFRESH_MS);
