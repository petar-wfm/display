/* ============================================================
   DELI BOARD — MANAGEMENT PANEL
   Loads the live menu/promos/settings from the server (/api/board),
   lets you edit them, and saves back to the server — so any screen
   showing index.html picks up the change, no matter which browser
   or device you used to make it here.
   ============================================================ */
const DATA_API = 'api/board';
const PW_KEY = 'wfm_admin_pw'; // remembers the admin password on THIS browser only, for convenience

let data = null;
let serverHadData = false;

/* ---------------- login ---------------- */
const loginWrap = document.getElementById('loginWrap');
const panel = document.getElementById('panel');
const pwInput = document.getElementById('pwInput');
const loginError = document.getElementById('loginError');

function getSavedPassword(){
  return localStorage.getItem(PW_KEY) || '';
}
function setSavedPassword(pw){
  localStorage.setItem(PW_KEY, pw);
}

async function tryUnlock(pw){
  loginError.textContent = '';
  // There's no password-only check endpoint — GET is intentionally public
  // (it's just the menu, already visible on the TV), so we can't confirm
  // the password here. It's verified the first time you hit Save; a wrong
  // password shows a clear error there instead. Loading now just gets the
  // editor populated, falling back to the built-in defaults if the server
  // storage isn't reachable or hasn't been set up yet.
  await loadFromServer();
  setSavedPassword(pw);
  loginWrap.classList.add('hidden');
  panel.classList.remove('hidden');
  renderAll();
}

document.getElementById('loginBtn').addEventListener('click', ()=> tryUnlock(pwInput.value));
pwInput.addEventListener('keydown', e=>{ if(e.key==='Enter') tryUnlock(pwInput.value); });
document.getElementById('logoutBtn').addEventListener('click', ()=>{
  localStorage.removeItem(PW_KEY);
  location.reload();
});
document.getElementById('viewBoardBtn').addEventListener('click', ()=> window.open('index.html','_blank'));

/* ---------------- server load / save ---------------- */
function setStatus(html){
  document.getElementById('statusLine').innerHTML = html;
}
function setSaveMsg(text, kind){
  const el = document.getElementById('saveMsg');
  el.textContent = text;
  el.className = 'msg' + (kind ? ' '+kind : '');
}

async function loadFromServer(){
  setStatus('Loading…');
  try{
    const res = await fetch(DATA_API, { cache:'no-store' });
    if(res.status === 500){
      const body = await res.json().catch(()=>({}));
      data = JSON.parse(JSON.stringify(BOARD_DATA));
      serverHadData = false;
      setStatus(body.message || "Server storage isn't set up yet — showing the built-in default menu below. See README.md section 5 to finish setup; Save will keep failing until then.");
      return 'not_configured';
    }
    if(!res.ok) throw new Error('HTTP '+res.status);
    const record = await res.json();
    if(record && record.data && record.data.categories){
      data = record.data;
      serverHadData = true;
      setStatus(`Last saved: <b>${formatWhen(record.updatedAt)}</b>`);
    } else {
      // Nothing saved to the server yet — start from the site's built-in defaults.
      data = JSON.parse(JSON.stringify(BOARD_DATA));
      serverHadData = false;
      setStatus('No saved changes yet — showing the built-in default menu. Edit and hit Save to publish it.');
    }
    return 'ok';
  }catch(e){
    data = JSON.parse(JSON.stringify(BOARD_DATA));
    serverHadData = false;
    setStatus("Couldn't reach the server — showing the built-in default menu below. Check your connection and hit \"Reload from server.\"");
    return 'error';
  }
}
function formatWhen(iso){
  if(!iso) return 'never';
  try{
    return new Date(iso).toLocaleString([], { dateStyle:'medium', timeStyle:'short' });
  }catch(e){ return iso; }
}

async function saveToServer(){
  setSaveMsg('Saving…');
  document.getElementById('saveBtn').disabled = true;
  try{
    const res = await fetch(DATA_API, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-admin-password': getSavedPassword() },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(()=>({}));
    if(res.status === 401){
      setSaveMsg('Wrong password — log out and try again.', 'error');
    } else if(res.status === 500 && body.error === 'not_configured'){
      setSaveMsg(body.message || 'Server storage is not configured yet.', 'error');
    } else if(!res.ok){
      setSaveMsg('Save failed: ' + (body.message || res.status), 'error');
    } else {
      serverHadData = true;
      setSaveMsg('Saved ✓', 'ok');
      setStatus(`Last saved: <b>${formatWhen(body.updatedAt)}</b>`);
    }
  }catch(e){
    setSaveMsg('Save failed — check your connection.', 'error');
  }
  document.getElementById('saveBtn').disabled = false;
}
document.getElementById('saveBtn').addEventListener('click', saveToServer);
document.getElementById('reloadBtn').addEventListener('click', async ()=>{
  if(!confirm('Reload from the server? Any unsaved edits here will be lost.')) return;
  await loadFromServer();
  renderAll();
});

/* ============================================================
   EDITOR — same behavior as the old on-screen editor, just living
   on a normal page instead of a modal over the slideshow.
   ============================================================ */
function esc(str){
  return (str||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function slugify(str){
  return (str||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'category';
}

function renderAll(){
  renderCategoryEditor();
  renderPromoEditor();
  renderSettingsEditor();
}

document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('pane-'+btn.dataset.tab).classList.add('active');
  });
});

/* ---- category / item editor ---- */
function renderCategoryEditor(){
  const wrap = document.getElementById('categoryList');
  wrap.innerHTML = data.categories.map((cat,ci)=>`
    <div class="cat-block" data-ci="${ci}">
      <div class="cat-block-head">
        <input type="text" class="catname" value="${esc(cat.name)}" data-role="catname" />
        <button class="btn ghost small" data-action="movecatup">↑</button>
        <button class="btn ghost small" data-action="movecatdown">↓</button>
        <button class="btn danger small" data-action="delcat">Delete category</button>
      </div>
      <div class="cat-meta-row">
        <input type="text" value="${esc(cat.note||'')}" placeholder="Category note (optional)" data-role="catnote" />
        <input type="text" value="${esc(cat.image||'')}" placeholder="Image path (assets/images/name.jpg)" data-role="catimage" />
        <select data-role="catdaypart">
          <option value="always" ${cat.daypart!=='breakfast'?'selected':''}>Always show</option>
          <option value="breakfast" ${cat.daypart==='breakfast'?'selected':''}>Breakfast hours only</option>
        </select>
      </div>
      <div data-role="items">
        ${cat.items.map((it,ii)=>`
          <div class="item-row" data-ii="${ii}">
            <input type="text" value="${esc(it.name)}" data-role="itemname" placeholder="Name" />
            <textarea data-role="itemdesc" placeholder="Description">${esc(it.desc||'')}</textarea>
            <input type="text" value="${esc(it.price)}" data-role="itemprice" placeholder="Price" />
            <div class="row-actions">
              <button class="btn ghost small" data-action="moveitemup">↑</button>
              <button class="btn ghost small" data-action="moveitemdown">↓</button>
              <button class="btn danger small" data-action="delitem">✕</button>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="btn small" data-action="additem" style="margin-top:1vh;">+ Add item</button>
    </div>
  `).join('');

  wrap.querySelectorAll('.cat-block').forEach(block=>{
    const ci = +block.dataset.ci;
    block.querySelector('[data-role=catname]').addEventListener('input', e=>{ data.categories[ci].name = e.target.value; });
    block.querySelector('[data-role=catnote]').addEventListener('input', e=>{ data.categories[ci].note = e.target.value; });
    block.querySelector('[data-role=catimage]').addEventListener('input', e=>{ data.categories[ci].image = e.target.value; });
    block.querySelector('[data-role=catdaypart]').addEventListener('change', e=>{ data.categories[ci].daypart = e.target.value; });
    block.querySelectorAll('.item-row').forEach(row=>{
      const ii = +row.dataset.ii;
      row.querySelector('[data-role=itemname]').addEventListener('input', e=>{ data.categories[ci].items[ii].name = e.target.value; });
      row.querySelector('[data-role=itemdesc]').addEventListener('input', e=>{ data.categories[ci].items[ii].desc = e.target.value; });
      row.querySelector('[data-role=itemprice]').addEventListener('input', e=>{ data.categories[ci].items[ii].price = e.target.value; });
      row.querySelector('[data-action=moveitemup]').addEventListener('click', ()=>moveItem(ci,ii,-1));
      row.querySelector('[data-action=moveitemdown]').addEventListener('click', ()=>moveItem(ci,ii,1));
      row.querySelector('[data-action=delitem]').addEventListener('click', ()=>{ data.categories[ci].items.splice(ii,1); renderCategoryEditor(); });
    });
    block.querySelector('[data-action=additem]').addEventListener('click', ()=>{
      data.categories[ci].items.push({name:'New Item', desc:'', price:'0.00'}); renderCategoryEditor();
    });
    block.querySelector('[data-action=delcat]').addEventListener('click', ()=>{
      if(confirm('Delete category "'+data.categories[ci].name+'" and all its items?')){ data.categories.splice(ci,1); renderCategoryEditor(); }
    });
    block.querySelector('[data-action=movecatup]').addEventListener('click', ()=>moveCategory(ci,-1));
    block.querySelector('[data-action=movecatdown]').addEventListener('click', ()=>moveCategory(ci,1));
  });
}
function moveItem(ci, ii, dir){
  const arr = data.categories[ci].items; const j = ii+dir;
  if(j<0 || j>=arr.length) return;
  [arr[ii],arr[j]] = [arr[j],arr[ii]]; renderCategoryEditor();
}
function moveCategory(ci, dir){
  const arr = data.categories; const j = ci+dir;
  if(j<0 || j>=arr.length) return;
  [arr[ci],arr[j]] = [arr[j],arr[ci]]; renderCategoryEditor();
}
document.getElementById('addCategoryBtn').addEventListener('click', ()=>{
  const name = 'New Category';
  data.categories.push({ id:slugify(name)+'-'+Date.now(), name, note:'', daypart:'always', image:'', items:[{name:'New Item', desc:'', price:'0.00'}] });
  renderCategoryEditor();
});

/* ---- promo editor ---- */
function renderPromoEditor(){
  const wrap = document.getElementById('promoList');
  wrap.innerHTML = data.promos.map((p,pi)=>`
    <div class="promo-card" data-pi="${pi}">
      <div class="promo-grid">
        <div class="full toggle-row">
          <label><input type="checkbox" data-role="active" ${p.active?'checked':''}/> Active</label>
          <select data-role="mode">
            <option value="ribbon" ${p.mode==='ribbon'?'selected':''}>Ribbon (small flag, every slide)</option>
            <option value="slide" ${p.mode==='slide'?'selected':''}>Full slide (own turn in rotation)</option>
          </select>
        </div>
        <div><span class="field-label">Badge / eyebrow</span><input type="text" data-role="badge" value="${esc(p.badge||'')}" placeholder="e.g. Today Only" /></div>
        <div><span class="field-label">Price / offer</span><input type="text" data-role="price" value="${esc(p.price||'')}" placeholder="e.g. $3.50" /></div>
        <div class="full"><span class="field-label">Title</span><input type="text" data-role="title" value="${esc(p.title||'')}" placeholder="Promo headline" /></div>
        <div class="full"><span class="field-label">Details (full-slide promos only)</span><textarea data-role="desc" placeholder="Extra detail shown on a full promo slide">${esc(p.desc||'')}</textarea></div>
      </div>
      <button class="btn danger small" data-action="delpromo" style="margin-top:1vh;">Delete promo</button>
    </div>
  `).join('');

  wrap.querySelectorAll('.promo-card').forEach(card=>{
    const pi = +card.dataset.pi;
    card.querySelector('[data-role=active]').addEventListener('change', e=>{ data.promos[pi].active = e.target.checked; });
    card.querySelector('[data-role=mode]').addEventListener('change', e=>{ data.promos[pi].mode = e.target.value; });
    card.querySelector('[data-role=badge]').addEventListener('input', e=>{ data.promos[pi].badge = e.target.value; });
    card.querySelector('[data-role=price]').addEventListener('input', e=>{ data.promos[pi].price = e.target.value; });
    card.querySelector('[data-role=title]').addEventListener('input', e=>{ data.promos[pi].title = e.target.value; });
    card.querySelector('[data-role=desc]').addEventListener('input', e=>{ data.promos[pi].desc = e.target.value; });
    card.querySelector('[data-action=delpromo]').addEventListener('click', ()=>{ data.promos.splice(pi,1); renderPromoEditor(); });
  });
}
document.getElementById('addPromoBtn').addEventListener('click', ()=>{
  data.promos.push({ id:'promo'+Date.now(), active:true, mode:'ribbon', badge:'New', title:'New promo', desc:'', price:'' });
  renderPromoEditor();
});

/* ---- settings editor ---- */
function renderSettingsEditor(){
  document.getElementById('setDuration').value = data.settings.slideDurationSec;
  document.getElementById('setPromoFreq').value = data.settings.promoFrequency;
  document.getElementById('setShowWelcome').value = data.settings.showWelcome ? '1':'0';
  document.getElementById('setBreakfastStart').value = data.settings.daypart.breakfastStart;
  document.getElementById('setBreakfastEndWeekday').value = data.settings.daypart.breakfastEndWeekday;
  document.getElementById('setBreakfastEndSunday').value = data.settings.daypart.breakfastEndSunday;
  document.getElementById('setHideBreakfast').checked = !!data.settings.daypart.hideBreakfastOutsideWindow;
}
document.getElementById('setDuration').addEventListener('input', e=>{ data.settings.slideDurationSec = +e.target.value || 12; });
document.getElementById('setPromoFreq').addEventListener('input', e=>{ data.settings.promoFrequency = +e.target.value || 3; });
document.getElementById('setShowWelcome').addEventListener('change', e=>{ data.settings.showWelcome = e.target.value === '1'; });
document.getElementById('setBreakfastStart').addEventListener('input', e=>{ data.settings.daypart.breakfastStart = e.target.value; });
document.getElementById('setBreakfastEndWeekday').addEventListener('input', e=>{ data.settings.daypart.breakfastEndWeekday = e.target.value; });
document.getElementById('setBreakfastEndSunday').addEventListener('input', e=>{ data.settings.daypart.breakfastEndSunday = e.target.value; });
document.getElementById('setHideBreakfast').addEventListener('change', e=>{ data.settings.daypart.hideBreakfastOutsideWindow = e.target.checked; });

/* ---- backup ---- */
document.getElementById('exportBtn').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'deli-board-backup.json'; a.click();
  URL.revokeObjectURL(url);
});
document.getElementById('importBtn').addEventListener('click', ()=>document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', e=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = evt=>{
    try{
      const parsed = JSON.parse(evt.target.result);
      if(parsed && parsed.categories && parsed.settings && parsed.promos){
        data = parsed;
        renderAll();
        setSaveMsg('Backup imported — remember to hit Save changes to publish it.', 'ok');
      } else { alert("That file doesn't look like a valid backup."); }
    }catch(err){ alert('Could not read that file: ' + err.message); }
  };
  reader.readAsText(file);
});
document.getElementById('resetBtn').addEventListener('click', ()=>{
  if(confirm('Reset the editor to the built-in default menu from data.js? This does not publish until you hit Save changes.')){
    data = JSON.parse(JSON.stringify(BOARD_DATA));
    renderAll();
    setSaveMsg('Reset to defaults in the editor — remember to hit Save changes to publish it.', 'ok');
  }
});

/* ============================================================
   INIT — auto-unlock if we already have a saved password
   ============================================================ */
(function init(){
  const saved = getSavedPassword();
  if(saved){
    pwInput.value = saved;
    tryUnlock(saved);
  }
})();
