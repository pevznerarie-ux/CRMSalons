// ════════════════════════════════════════════════════════════════════════════
//  CRM Beth Menahem — logique de l'interface
// ════════════════════════════════════════════════════════════════════════════
let TOKEN = localStorage.getItem('crm_token') || '';
let ME = {};
let CONFIG = { spaces: [], event_types: [], time_slots: [], options: [] };
let RES_CACHE = [];

const STATUT_LABELS = { demande:'Demande', devis_envoye:'Devis envoyé', option:'Option', confirme:'Confirmé', realise:'Réalisé', annule:'Annulé', perdu:'Perdu' };
const ROLE_LABELS = { admin:'Administrateur', commercial:'Commercial', regisseur:'Régisseur', administratif:'Administratif' };

// ─── API ────────────────────────────────────────────────────────────────────
async function api(method, path, data, isForm) {
  const opts = { method, headers: TOKEN ? { Authorization:'Bearer '+TOKEN } : {} };
  if (isForm) opts.body = data;
  else if (data !== undefined) { opts.headers['Content-Type']='application/json'; opts.body=JSON.stringify(data); }
  const res = await fetch('/api'+path, opts);
  if (res.status === 401) { logout(); throw new Error('Session expirée'); }
  const json = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(json.error || 'Erreur');
  return json;
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
const UI = {
  openModal:(id)=>document.getElementById(id).classList.add('active'),
  closeModal:(id)=>document.getElementById(id).classList.remove('active'),
  esc:(s)=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
};
function toast(msg,type){const el=document.getElementById('toast');el.textContent=msg;el.className='show '+(type||'success');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),3500);}
function fmtEur(n){return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n||0);}
function fmtDate(d){if(!d)return'—';try{return new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});}catch{return d;}}
function statutBadge(s){return `<span class="badge b-${s}">${STATUT_LABELS[s]||s}</span>`;}
function can(...roles){return ME.role==='admin'||roles.includes(ME.role);}
function confirmDialog(title,text,okLabel,cb){
  document.getElementById('confirmTitle').textContent=title;
  document.getElementById('confirmText').innerHTML=text;
  const btn=document.getElementById('confirmOkBtn');btn.textContent=okLabel||'Confirmer';
  btn.onclick=async()=>{try{await cb();UI.closeModal('confirmDialog');}catch(e){toast('❌ '+e.message,'error');}};
  UI.openModal('confirmDialog');
}

// ─── AUTH ────────────────────────────────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();const err=document.getElementById('loginError');err.style.display='none';
  try{
    const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:loginUser.value,password:loginPass.value})});
    const j=await r.json();if(!r.ok)throw new Error();
    TOKEN=j.token;localStorage.setItem('crm_token',TOKEN);
    if(j.must_change_password){document.getElementById('loginScreen').style.display='none';document.getElementById('forcePwScreen').style.display='flex';}
    else boot();
  }catch{err.textContent='Identifiants incorrects.';err.style.display='block';}
});
document.getElementById('forcePwForm').addEventListener('submit',async e=>{
  e.preventDefault();const err=document.getElementById('forcePwError');err.style.display='none';
  const nw=forcePwNew.value,cf=forcePwConfirm.value;
  if(nw!==cf){err.textContent='Les mots de passe ne correspondent pas.';err.style.display='block';return;}
  if(nw.length<6){err.textContent='Minimum 6 caractères.';err.style.display='block';return;}
  try{await api('PUT','/password',{newPass:nw});toast('✅ Mot de passe créé');document.getElementById('forcePwScreen').style.display='none';document.getElementById('loginScreen').style.display='flex';TOKEN='';localStorage.removeItem('crm_token');}
  catch(e){err.textContent=e.message;err.style.display='block';}
});
function logout(){TOKEN='';localStorage.removeItem('crm_token');document.getElementById('app').style.display='none';document.getElementById('loginScreen').style.display='flex';}
document.getElementById('btnLogout').addEventListener('click',logout);

async function boot(){
  try{ME=await api('GET','/me');}catch{return logout();}
  CONFIG=await api('GET','/config');
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('forcePwScreen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('userAvatar').textContent=(ME.nom||ME.email||'A')[0].toUpperCase();
  document.getElementById('userName').textContent=ME.nom||ME.email;
  document.getElementById('userRoleLabel').textContent=ROLE_LABELS[ME.role]||ME.role;
  // visibilité selon rôle
  document.querySelectorAll('[data-roles]').forEach(el=>{
    const roles=el.dataset.roles.split(',');
    el.classList.toggle('hidden',!(ME.role==='admin'||roles.includes(ME.role)));
  });
  // remplir les filtres
  fillSelect('filterStatut',Object.entries(STATUT_LABELS).map(([v,l])=>({value:v,label:l})),'Tous statuts');
  fillSelect('filterSpace',CONFIG.spaces.map(s=>({value:s.id,label:s.nom})),'Toutes salles');
  fillSelect('calFilterSpace',CONFIG.spaces.map(s=>({value:s.id,label:s.nom})),'Toutes les salles');
  Dash.load();
}
function fillSelect(id,items,placeholder){
  const el=document.getElementById(id);if(!el)return;
  el.innerHTML=(placeholder?`<option value="">${placeholder}</option>`:'')+items.map(i=>`<option value="${i.value}">${UI.esc(i.label)}</option>`).join('');
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item[data-page]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const pg=btn.dataset.page;
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById('page-'+pg).classList.add('active');
    document.getElementById('topbarTitle').textContent=btn.textContent.trim();
    ({dashboard:()=>Dash.load(),calendar:()=>Cal.load(),reservations:()=>Res.load(),payments:()=>Pay.load(),config:()=>Config.load(),users:()=>Users.load(),account:()=>{}}[pg]||(()=>{}))();
  });
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const Dash={
  async load(){
    const s=await api('GET','/stats');
    const cards=[
      ['📋',s.total,'Total','#EBF8FF'],['📨',s.demandes,'Demandes','#EBF8FF'],
      ['📄',s.devis,'Devis envoyés','#FAF5FF'],['✅',s.confirmes,'Confirmés','#F0FFF4'],
      ['📈',s.taux_conversion+'%','Conversion','#FFFBEB'],
      ['💰',fmtEur(s.ca_confirme),'CA confirmé','#FFFBEB'],
      ['🏦',fmtEur(s.encaisse),'Encaissé','#F0FFF4'],
      ['⏳',fmtEur(s.a_encaisser),'À encaisser','#FFF5F5'],
    ];
    document.getElementById('statsGrid').innerHTML=cards.map(c=>`<div class="stat-card"><div class="stat-icon" style="background:${c[3]}">${c[0]}</div><div><div class="stat-num">${c[1]}</div><div class="stat-label">${c[2]}</div></div></div>`).join('');
    document.getElementById('pendingBadge').textContent=s.demandes+' demande(s)';
    const ne=document.getElementById('nextEvents');
    ne.innerHTML=s.next_events.length?s.next_events.map(r=>`<div class="event-row"><div class="ev-date">${fmtDate(r.date_evenement)}</div><div style="flex:1"><div class="ev-name">${UI.esc(r.prenom)} ${UI.esc(r.nom)}</div><div class="ev-type">${UI.esc(r.type_label)} · ${UI.esc(r.space_label)}</div></div>${statutBadge(r.statut)}<button class="btn btn-ghost btn-sm" onclick="Res.open(${r.id})">Ouvrir</button></div>`).join(''):'<div class="empty-state">Aucun événement à venir</div>';
    document.getElementById('retardsList').innerHTML=s.retards?`<div class="alert alert-err">⚠️ <b>${s.retards}</b> paiement(s) en retard — total <b>${fmtEur(s.retards_montant)}</b></div><button class="btn btn-gold btn-sm" onclick="document.querySelector('[data-page=payments]').click()">Voir les paiements</button>`:'<div class="empty-state">Aucun retard 👍</div>';
  }
};

// ─── CALENDRIER ───────────────────────────────────────────────────────────────
const Cal={
  inst:null,
  load(){
    document.getElementById('calLegend').innerHTML=CONFIG.spaces.map(s=>`<span><span class="cal-dot" style="background:${s.couleur}"></span>${UI.esc(s.nom)}</span>`).join('');
    if(!this.inst){
      this.inst=new FullCalendar.Calendar(document.getElementById('calendar'),{
        initialView:'dayGridMonth',locale:'fr',firstDay:1,height:'auto',
        headerToolbar:{left:'prev,next today',center:'title',right:'dayGridMonth,timeGridWeek,listMonth'},
        buttonText:{today:"Aujourd'hui",month:'Mois',week:'Semaine',list:'Liste'},
        eventClick:(info)=>Res.open(parseInt(info.event.id)),
        events:(info,success)=>this.fetch(info,success),
      });
      this.inst.render();
    } else this.inst.refetchEvents();
  },
  async fetch(info,success){
    const evs=await api('GET',`/calendar?from=${info.startStr.slice(0,10)}&to=${info.endStr.slice(0,10)}`);
    const filter=document.getElementById('calFilterSpace').value;
    success(evs.filter(e=>!filter||e.space_id==filter).map(e=>({
      id:e.id,title:`${e.title} (${e.space_label})`,start:e.start,
      end:e.end&&e.end!==e.start?addDay(e.end):null,allDay:true,
      backgroundColor:e.color,borderColor:e.color,
      classNames:['stat-'+e.statut],
    })));
  },
  render(){if(this.inst)this.inst.refetchEvents();}
};
function addDay(d){const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+1);return x.toISOString().slice(0,10);}

// ─── RÉSERVATIONS (liste) ─────────────────────────────────────────────────────
let resPage=1;const RES_PAGE_SIZE=20;
const Res={
  async load(){
    const q=new URLSearchParams();
    const s=document.getElementById('searchInput').value;if(s)q.set('search',s);
    const st=document.getElementById('filterStatut').value;if(st)q.set('statut',st);
    const sp=document.getElementById('filterSpace').value;if(sp)q.set('space',sp);
    RES_CACHE=await api('GET','/reservations?'+q);resPage=1;this.render();
  },
  clearFilters(){['searchInput','filterStatut','filterSpace'].forEach(i=>document.getElementById(i).value='');this.load();},
  render(){
    const tb=document.getElementById('resBody'),pg=document.getElementById('resPagination');
    if(!RES_CACHE.length){tb.innerHTML='<tr><td colspan="9"><div class="empty-state">Aucune réservation</div></td></tr>';pg.innerHTML='';return;}
    const start=(resPage-1)*RES_PAGE_SIZE,items=RES_CACHE.slice(start,start+RES_PAGE_SIZE);
    tb.innerHTML=items.map(r=>`<tr>
      <td class="td-ref">${r.reference}</td>
      <td class="td-name">${UI.esc(r.prenom)} ${UI.esc(r.nom)}<br><span style="font-size:11px;color:var(--text-lt)">${UI.esc(r.telephone)}</span></td>
      <td>${UI.esc(r.type_label)}</td>
      <td style="white-space:nowrap">${fmtDate(r.date_evenement)}</td>
      <td>${UI.esc(r.space_label)||'—'}</td>
      <td><strong>${fmtEur(r.total)}</strong></td>
      <td>${r._encaisse!=null?fmtEur(r._encaisse):'—'}</td>
      <td>${statutBadge(r.statut)}</td>
      <td><div style="display:flex;gap:6px"><button class="btn btn-ghost btn-sm btn-icon" onclick="Res.open(${r.id})" title="Ouvrir">✏️</button>
      ${can()?`<button class="btn btn-red btn-sm btn-icon" onclick="Res.del(${r.id},'${r.reference}')" title="Supprimer">🗑️</button>`:''}</div></td>
    </tr>`).join('');
    const pages=Math.ceil(RES_CACHE.length/RES_PAGE_SIZE);
    pg.innerHTML=(pages>1?Array.from({length:pages},(_,i)=>`<button class="page-btn ${i+1===resPage?'active':''}" onclick="resPage=${i+1};Res.render()">${i+1}</button>`).join(''):'')+`<span class="page-info">${RES_CACHE.length} résultat(s)</span>`;
  },
  del(id,ref){confirmDialog('Supprimer la réservation',`Supprimer <b>${ref}</b> ? Action irréversible.`,'Supprimer',async()=>{await api('DELETE','/reservations/'+id);toast('🗑️ Supprimé','info');Res.load();Dash.load();});},
  openNew(){ this.current=null; this.renderModal({statut:'demande',source:'telephone',options:[],payments:[],documents:[],activity:[],remise_pct:0}); },
  async open(id){ const r=await api('GET','/reservations/'+id); this.current=r; this.renderModal(r); },
  // … (suite : renderModal + sauvegarde) dans la partie 2
};

// le reste de la logique (modale réservation, paiements, documents, config, users)
// est chargé depuis app2.js pour garder des fichiers lisibles
