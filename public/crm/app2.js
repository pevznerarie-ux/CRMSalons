// ════════════════════════════════════════════════════════════════════════════
//  app2.js — modale réservation, paiements, documents, configuration, users
// ════════════════════════════════════════════════════════════════════════════
let USERS_CACHE = null;
async function getUsers(){ if(USERS_CACHE)return USERS_CACHE; try{USERS_CACHE=await api('GET','/users');}catch{USERS_CACHE=[];} return USERS_CACHE; }
const val=(id)=>{const e=document.getElementById(id);return e?e.value:'';};
const numv=(id)=>parseFloat(val(id))||0;

// ─── MODALE RÉSERVATION ────────────────────────────────────────────────────────
Object.assign(Res, {
  renderModal(r){
    const editable = can('commercial','administratif');
    const isReg = ME.role==='regisseur';
    document.getElementById('resModalTitle').textContent = r.reference?`Réservation ${r.reference}`:'Nouvelle réservation';
    document.getElementById('resId').value = r.id||'';
    const opt=(arr,sel,ph)=>`<option value="">${ph||'—'}</option>`+arr.map(x=>`<option value="${x.id}" ${x.id==sel?'selected':''}>${UI.esc(x.nom)}</option>`).join('');
    const body=document.getElementById('resModalBody');
    body.innerHTML=`<input type="hidden" id="resId" value="${r.id||''}">
    <!-- CLIENT -->
    <div class="tab-pane active" data-pane="client">
      <div class="form-section-title">👤 Client</div>
      <div class="form-grid">
        <div class="form-field"><label>Nom *</label><input id="f-nom" value="${UI.esc(r.nom)}"></div>
        <div class="form-field"><label>Prénom *</label><input id="f-prenom" value="${UI.esc(r.prenom)}"></div>
        <div class="form-field"><label>Téléphone *</label><input id="f-telephone" value="${UI.esc(r.telephone)}"></div>
        <div class="form-field"><label>Email *</label><input id="f-email" value="${UI.esc(r.email)}"></div>
        <div class="form-field"><label>Société</label><input id="f-societe" value="${UI.esc(r.societe)}"></div>
        <div class="form-field"><label>Adresse</label><input id="f-adresse" value="${UI.esc(r.adresse)}"></div>
      </div>
      <div class="form-section-title" style="margin-top:20px">🎊 Événement</div>
      <div class="form-grid">
        <div class="form-field"><label>Type</label><select id="f-event_type_id" onchange="Res.checkAvail()">${opt(CONFIG.event_types,r.event_type_id)}</select></div>
        <div class="form-field"><label>Salle / espace</label><select id="f-space_id" onchange="Res.checkAvail()">${opt(CONFIG.spaces,r.space_id)}</select></div>
        <div class="form-field"><label>Date *</label><input type="date" id="f-date_evenement" value="${r.date_evenement||''}" onchange="Res.checkAvail()"></div>
        <div class="form-field"><label>Plage horaire</label><select id="f-time_slot_id" onchange="Res.checkAvail()">${opt(CONFIG.time_slots,r.time_slot_id)}</select></div>
        <div class="form-field"><label>Nombre de personnes</label><input type="number" id="f-nombre_personnes" min="0" value="${r.nombre_personnes||''}" oninput="Res.recalc()"></div>
        <div class="form-field"><label>Source</label><select id="f-source">${['site','telephone','recommandation','salon','reseaux','autre'].map(s=>`<option ${r.source===s?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="form-field span2" id="commercialWrap"></div>
        <div class="form-field span2"><label>Message client</label><textarea id="f-message_client">${UI.esc(r.message_client)}</textarea></div>
      </div>
      <div id="availBox"></div>
    </div>
    <!-- TARIF -->
    <div class="tab-pane" data-pane="tarif">
      <div class="form-section-title">💰 Tarification</div>
      <div class="form-grid cols3">
        <div class="form-field"><label>Prix de base (€)</label><input type="number" id="f-prix_base" step="0.01" value="${r.prix_base||0}" oninput="Res.recalc()"></div>
        <div class="form-field"><label>Remise (%)</label><input type="number" id="f-remise_pct" step="0.1" value="${r.remise_pct||0}" oninput="Res.recalc()"></div>
        <div class="form-field"><label>Remise fixe (€)</label><input type="number" id="f-remise_montant" step="0.01" value="${r.remise_montant||0}" oninput="Res.recalc()"></div>
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="Res.autoPrice()">🔄 Calculer le prix de base automatiquement</button>
      <div class="form-section-title" style="margin-top:20px">➕ Options</div>
      <div id="optionsList">${CONFIG.options.map(o=>{const sel=(r.options||[]).find(x=>x.id===o.id);return `<div class="opt-row"><input type="checkbox" id="opt-${o.id}" data-id="${o.id}" data-prix="${o.prix}" data-unite="${o.unite}" ${sel?'checked':''} onchange="Res.recalc()"><label for="opt-${o.id}" style="flex:1">${UI.esc(o.nom)} — ${fmtEur(o.prix)} <span style="color:var(--text-lt)">/ ${o.unite.replace('_',' ')}</span></label>${o.unite!=='par_personne'?`<input type="number" min="1" value="${sel?sel.quantite:1}" id="optq-${o.id}" style="width:64px;padding:5px;border:1px solid var(--border);border-radius:6px" oninput="Res.recalc()">`:''}</div>`;}).join('')}</div>
      <div class="prix-recap">
        <div class="prix-item"><div class="p-label">Sous-total</div><div class="p-val" id="rc-sous">0 €</div></div>
        <div class="prix-item"><div class="p-label">Remise</div><div class="p-val" id="rc-remise">0 €</div></div>
        <div class="prix-item total"><div class="p-label">Total net</div><div class="p-val" id="rc-total">0 €</div></div>
      </div>
      <div class="form-grid" style="margin-top:14px"><div class="form-field"><label>Acompte demandé (€)</label><input type="number" id="f-acompte_montant" step="0.01" value="${r.acompte_montant||0}"></div></div>
      ${r.id?`<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" onclick="Res.generateDoc('devis')">📄 Générer le devis PDF</button><button class="btn btn-gold btn-sm" onclick="Res.sendDevis()">✉️ Envoyer le devis au client</button></div>`:'<div class="alert alert-info" style="margin-top:12px">💡 Enregistrez d\'abord pour générer un devis.</div>'}
    </div>
    <!-- PAIEMENTS -->
    <div class="tab-pane" data-pane="paiements"><div id="payPane"></div></div>
    <!-- DOCUMENTS -->
    <div class="tab-pane" data-pane="documents"><div id="docPane"></div></div>
    <!-- LOGISTIQUE -->
    <div class="tab-pane" data-pane="logistique">
      <div class="form-section-title">🤝 Prestataires & logistique</div>
      <div class="form-grid">
        <div class="form-field"><label>Traiteur</label><input id="f-traiteur" value="${UI.esc(r.traiteur)}"></div>
        <div class="form-field"><label>Décorateur</label><input id="f-decorateur" value="${UI.esc(r.decorateur)}"></div>
        <div class="form-field span2"><label>Autres prestataires</label><input id="f-prestataires" value="${UI.esc(r.prestataires)}"></div>
        <div class="form-field span2"><label>Consignes techniques / déroulé</label><textarea id="f-logistique" style="min-height:120px">${UI.esc(r.logistique)}</textarea></div>
      </div>
      ${r.id?`<button class="btn btn-gold btn-sm" style="margin-top:12px" onclick="Res.whatsapp()">💬 Notifier le régisseur (WhatsApp)</button>`:''}
    </div>
    <!-- HISTORIQUE -->
    <div class="tab-pane" data-pane="historique"><div id="logPane"></div></div>`;

    // footer
    const foot=document.getElementById('resModalFoot');
    let statutSel = `<select id="f-statut" class="filter-select" ${!can('commercial','administratif')?'disabled':''}>${Object.entries(STATUT_LABELS).map(([v,l])=>`<option value="${v}" ${r.statut===v?'selected':''}>${l}</option>`).join('')}</select>`;
    foot.innerHTML=`<div style="margin-right:auto;display:flex;align-items:center;gap:8px"><span style="font-size:12px;color:var(--text-lt)">Statut</span>${statutSel}</div>
      <button class="btn btn-ghost" onclick="UI.closeModal('modalReservation')">Fermer</button>
      ${(editable||isReg)?`<button class="btn btn-navy" onclick="Res.save()">💾 Enregistrer</button>`:''}`;

    // tabs
    document.querySelectorAll('.res-tab').forEach(t=>t.onclick=()=>{
      document.querySelectorAll('.res-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
      document.querySelectorAll('#resModalBody .tab-pane').forEach(p=>p.classList.toggle('active',p.dataset.pane===t.dataset.tab));
    });
    document.querySelector('.res-tab[data-tab=client]').click();

    // commercial select (admin)
    if(ME.role==='admin'){ getUsers().then(us=>{ const w=document.getElementById('commercialWrap'); if(w) w.innerHTML=`<label>Commercial assigné</label><select id="f-commercial_id"><option value="">—</option>${us.filter(u=>['admin','commercial'].includes(u.role)).map(u=>`<option value="${u.id}" ${r.commercial_id==u.id?'selected':''}>${UI.esc(u.nom||u.email)}</option>`).join('')}</select>`; }); }

    this.renderPayments(r); this.renderDocs(r); this.renderLog(r);
    this.recalc();
    UI.openModal('modalReservation');
  },

  selectedOptions(){
    return [...document.querySelectorAll('#optionsList input[type=checkbox]:checked')].map(c=>{
      const id=+c.dataset.id, unite=c.dataset.unite, qEl=document.getElementById('optq-'+id);
      return {id, unite, quantite: qEl?(+qEl.value||1):1};
    });
  },
  recalc(){
    const base=numv('f-prix_base'), nb=numv('f-nombre_personnes');
    let optTotal=0;
    this.selectedOptions().forEach(s=>{
      const cb=document.getElementById('opt-'+s.id);const prix=+cb.dataset.prix;
      optTotal += s.unite==='par_personne'? prix*nb : prix*s.quantite;
    });
    const sous=base+optTotal;
    const remise=(numv('f-remise_pct')>0?sous*numv('f-remise_pct')/100:0)+numv('f-remise_montant');
    const total=Math.max(0,sous-remise);
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=fmtEur(v);};
    set('rc-sous',sous);set('rc-remise',remise);set('rc-total',total);
  },
  async autoPrice(){
    const q=await api('POST','/quote',{space_id:+val('f-space_id')||null,event_type_id:+val('f-event_type_id')||null,time_slot_id:+val('f-time_slot_id')||null,date:val('f-date_evenement')});
    document.getElementById('f-prix_base').value=q.prix_base;
    toast(q.rule?`Tarif appliqué : ${q.rule}`:'Aucune règle — saisissez le prix','info');this.recalc();
  },
  async checkAvail(){
    const sp=val('f-space_id'),date=val('f-date_evenement'),slot=val('f-time_slot_id');
    const box=document.getElementById('availBox');if(!sp||!date){box.innerHTML='';return;}
    try{const a=await api('GET',`/availability?space_id=${sp}&date=${date}&time_slot_id=${slot}&exclude=${val('resId')||0}`);
      box.innerHTML=a.available?'<div class="alert alert-ok">✅ Salle disponible à cette date.</div>':`<div class="alert alert-warn">⚠️ Conflit : <b>${a.conflit.reference}</b> — ${UI.esc(a.conflit.prenom)} ${UI.esc(a.conflit.nom)} (${a.conflit.slot_label||'—'}) occupe déjà cette salle ce jour-là.</div>`;
    }catch{}
    if(!val('f-prix_base')||numv('f-prix_base')===0) this.autoPrice();
  },
  gather(){
    const o={nom:val('f-nom'),prenom:val('f-prenom'),telephone:val('f-telephone'),email:val('f-email'),societe:val('f-societe'),adresse:val('f-adresse'),
      event_type_id:+val('f-event_type_id')||null,space_id:+val('f-space_id')||null,time_slot_id:+val('f-time_slot_id')||null,
      date_evenement:val('f-date_evenement'),nombre_personnes:+val('f-nombre_personnes')||0,source:val('f-source'),message_client:val('f-message_client'),
      prix_base:numv('f-prix_base'),remise_pct:numv('f-remise_pct'),remise_montant:numv('f-remise_montant'),acompte_montant:numv('f-acompte_montant'),
      options:this.selectedOptions(),traiteur:val('f-traiteur'),decorateur:val('f-decorateur'),prestataires:val('f-prestataires'),logistique:val('f-logistique')};
    const cm=document.getElementById('f-commercial_id');if(cm)o.commercial_id=+cm.value||null;
    return o;
  },
  async save(){
    const id=val('resId');const data=this.gather();const statut=val('f-statut');
    try{
      if(id){
        await api('PUT','/reservations/'+id,data);
        if(can('commercial','administratif') && this.current && statut!==this.current.statut) await api('POST',`/reservations/${id}/statut`,{statut});
        toast('✅ Réservation enregistrée');
      }else{
        if(!data.nom||!data.prenom||!data.telephone||!data.email||!data.date_evenement){toast('❌ Nom, prénom, téléphone, email et date sont requis','error');return;}
        const res=await api('POST','/reservations',data);
        if(statut!=='demande') await api('POST',`/reservations/${res.id}/statut`,{statut});
        toast('✅ Réservation créée — '+res.reference);
      }
      UI.closeModal('modalReservation');Res.load();Dash.load();if(Cal.inst)Cal.render();
    }catch(e){toast('❌ '+e.message,'error');}
  },
  async generateDoc(type){try{await api('POST',`/reservations/${val('resId')}/documents/generate`,{type});toast('✅ '+(type==='contrat'?'Contrat':'Devis')+' généré');const r=await api('GET','/reservations/'+val('resId'));this.renderDocs(r);}catch(e){toast('❌ '+e.message,'error');}},
  async sendDevis(){try{await api('POST',`/reservations/${val('resId')}/send-devis`);toast('✅ Devis envoyé au client');}catch(e){toast('❌ '+e.message,'error');}},
  async whatsapp(){try{const {url}=await api('GET',`/reservations/${val('resId')}/whatsapp`);window.open(url,'_blank');}catch(e){toast('❌ '+e.message,'error');}},

  // PAIEMENTS (onglet)
  renderPayments(r){
    const el=document.getElementById('payPane');if(!el)return;
    if(!r.id){el.innerHTML='<div class="alert alert-info">Enregistrez la réservation pour gérer les paiements.</div>';return;}
    const pays=r.payments||[];
    el.innerHTML=`<div class="form-section-title">💳 Échéancier de paiement</div>
      ${pays.length?pays.map(p=>this.payRow(p,r)).join(''):'<div class="empty-state">Aucune échéance. Confirmez la réservation pour générer l\'acompte + le solde, ou ajoutez-en une.</div>'}
      ${can('administratif','commercial')?`<div class="line-item" style="background:#fff;border:1px dashed var(--border);margin-top:10px">
        <select id="np-type" class="filter-select"><option value="acompte">Acompte</option><option value="solde">Solde</option><option value="autre">Autre</option></select>
        <input type="number" id="np-montant" placeholder="Montant €" style="width:110px;padding:8px;border:1px solid var(--border);border-radius:6px">
        <input type="date" id="np-ech" class="filter-select" title="Échéance">
        <button class="btn btn-navy btn-sm" onclick="Res.addPayment(${r.id})">+ Ajouter</button></div>`:''}`;
  },
  payRow(p,r){
    const st=p.statut==='paye'?'paye':(p.date_echeance&&p.date_echeance<new Date().toISOString().slice(0,10)?'retard':'attendu');
    return `<div class="line-item"><div class="li-main"><b>${fmtEur(p.montant)}</b> — ${p.libelle||p.type}<br>
      <span style="font-size:11px;color:var(--text-lt)">${p.date_echeance?'échéance '+fmtDate(p.date_echeance):''}${p.date_paiement?' · payé le '+fmtDate(p.date_paiement):''}${p.relance_count?` · ${p.relance_count} relance(s)`:''}</span></div>
      <span class="badge b-${st}">${st==='paye'?'Payé':st==='retard'?'En retard':'En attente'}</span>
      ${can('administratif','commercial')?`${p.statut!=='paye'?`<button class="btn btn-green btn-sm" onclick="Res.markPaid(${p.id})">✓ Payé</button>
        <button class="btn btn-purple btn-sm" onclick="Res.helloasso(${p.id})" title="Lien de paiement en ligne">💳</button>
        <button class="btn btn-gold btn-sm" onclick="Res.relance(${p.id})" title="Relancer par email">📨</button>`:''}
      ${can('administratif')?`<button class="btn btn-red btn-sm btn-icon" onclick="Res.delPayment(${p.id})">🗑️</button>`:''}`:''}</div>`;
  },
  async addPayment(id){const montant=numv('np-montant');if(!montant)return toast('❌ Montant requis','error');await api('POST',`/reservations/${id}/payments`,{type:val('np-type'),libelle:val('np-type'),montant,date_echeance:val('np-ech')||null});await this.refresh(id);},
  async markPaid(pid){await api('PUT','/payments/'+pid,{statut:'paye'});toast('✅ Paiement encaissé');await this.refresh(val('resId'));Dash.load();},
  async delPayment(pid){await api('DELETE','/payments/'+pid);await this.refresh(val('resId'));},
  async relance(pid){try{await api('POST','/payments/'+pid+'/relance');toast('📨 Relance envoyée');await this.refresh(val('resId'));}catch(e){toast('❌ '+e.message,'error');}},
  async helloasso(pid){try{const r=await api('POST','/payments/'+pid+'/helloasso');toast('✅ Lien généré et envoyé');await this.refresh(val('resId'));}catch(e){toast('❌ '+e.message,'error');}},
  async refresh(id){const r=await api('GET','/reservations/'+id);this.current=r;this.renderPayments(r);this.renderDocs(r);this.renderLog(r);},

  // DOCUMENTS (onglet)
  renderDocs(r){
    const el=document.getElementById('docPane');if(!el)return;
    if(!r.id){el.innerHTML='<div class="alert alert-info">Enregistrez la réservation pour gérer les documents.</div>';return;}
    const docs=r.documents||[];
    el.innerHTML=`<div class="form-section-title">📄 Documents</div>
      ${can('commercial','administratif')?`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn btn-ghost btn-sm" onclick="Res.generateDoc('devis')">📄 Générer devis</button>
        <button class="btn btn-ghost btn-sm" onclick="Res.generateDoc('contrat')">📑 Générer contrat</button></div>`:''}
      ${docs.length?docs.map(d=>`<div class="line-item"><div class="li-main">${({devis:'📄',contrat:'📑',assurance:'🛡️',facture:'🧾'}[d.type]||'📎')} <b>${d.type}</b> — ${UI.esc(d.original_name||d.filename)} ${d.genere?'<span style="font-size:10px;color:var(--green)">(généré)</span>':''}<br><span style="font-size:11px;color:var(--text-lt)">${d.created_at}</span></div>
        <a href="/uploads/${d.filename}" target="_blank" class="btn btn-ghost btn-sm">Voir</a>
        ${can('commercial','administratif')?`<button class="btn btn-red btn-sm btn-icon" onclick="Res.delDoc(${d.id})">🗑️</button>`:''}</div>`).join(''):'<div class="empty-state">Aucun document</div>'}
      <div class="upload-zone" style="margin-top:12px" onclick="document.getElementById('docFile').click()">📎 Charger un document (contrat signé, assurance…)
        <select id="docType" class="filter-select" style="margin-top:8px" onclick="event.stopPropagation()"><option value="contrat">Contrat signé</option><option value="assurance">Assurance</option><option value="facture">Facture</option><option value="autre">Autre</option></select>
        <input type="file" id="docFile" style="display:none" onchange="Res.uploadDoc(${r.id})"></div>`;
  },
  async uploadDoc(id){const f=document.getElementById('docFile').files[0];if(!f)return;const fd=new FormData();fd.append('file',f);fd.append('type',val('docType'));try{await api('POST',`/reservations/${id}/documents`,fd,true);toast('✅ Document ajouté');await this.refresh(id);}catch(e){toast('❌ '+e.message,'error');}},
  async delDoc(did){await api('DELETE','/documents/'+did);await this.refresh(val('resId'));},

  renderLog(r){const el=document.getElementById('logPane');if(!el)return;const a=r.activity||[];el.innerHTML='<div class="form-section-title">🕓 Historique</div>'+(a.length?a.map(l=>`<div class="log-item"><b>${UI.esc(l.user_label)}</b> — ${UI.esc(l.action)} ${l.details?'· '+UI.esc(l.details):''}<br>${l.created_at}</div>`).join(''):'<div class="empty-state">Aucune activité</div>');},
});

// ─── PAIEMENTS (page globale) ──────────────────────────────────────────────────
const Pay={
  async load(){
    const all=await api('GET','/reservations');const today=new Date().toISOString().slice(0,10);
    const rows=[];
    for(const r of all){const full=await api('GET','/reservations/'+r.id);for(const p of full.payments){rows.push({...p,reference:r.reference,client:`${r.prenom} ${r.nom}`,email:r.email});}}
    const f=document.getElementById('payFilter').value;
    const filtered=rows.filter(p=>{const retard=p.statut==='attendu'&&p.date_echeance&&p.date_echeance<today;
      if(f==='retard')return retard;if(f==='attendu')return p.statut==='attendu';if(f==='paye')return p.statut==='paye';return true;});
    document.getElementById('payBody').innerHTML=filtered.length?filtered.map(p=>{
      const retard=p.statut==='attendu'&&p.date_echeance&&p.date_echeance<today;const st=p.statut==='paye'?'paye':retard?'retard':'attendu';
      return `<tr><td class="td-ref">${p.reference}</td><td>${UI.esc(p.client)}</td><td>${p.libelle||p.type}</td><td><b>${fmtEur(p.montant)}</b></td>
      <td>${p.date_echeance?fmtDate(p.date_echeance):'—'}</td><td><span class="badge b-${st}">${st==='paye'?'Payé':st==='retard'?'En retard':'En attente'}</span></td><td>${p.moyen||'—'}</td>
      <td><div style="display:flex;gap:6px">${p.statut!=='paye'?`<button class="btn btn-green btn-sm" onclick="Pay.markPaid(${p.id})">✓</button><button class="btn btn-gold btn-sm" onclick="Pay.relance(${p.id})">📨</button>`:''}</div></td></tr>`;
    }).join(''):'<tr><td colspan="8"><div class="empty-state">Aucun paiement</div></td></tr>';
  },
  async markPaid(id){await api('PUT','/payments/'+id,{statut:'paye'});toast('✅ Encaissé');this.load();Dash.load();},
  async relance(id){try{await api('POST','/payments/'+id+'/relance');toast('📨 Relance envoyée');this.load();}catch(e){toast('❌ '+e.message,'error');}},
  relanceAll(){confirmDialog('Relancer les retards','Envoyer une relance par email à tous les paiements en retard ?','Relancer',async()=>{
    const today=new Date().toISOString().slice(0,10);const all=await api('GET','/reservations');let n=0;
    for(const r of all){const full=await api('GET','/reservations/'+r.id);for(const p of full.payments){if(p.statut==='attendu'&&p.date_echeance&&p.date_echeance<today){try{await api('POST','/payments/'+p.id+'/relance');n++;}catch{}}}}
    toast(`📨 ${n} relance(s) envoyée(s)`);this.load();});},
};

// ─── CONFIGURATION (admin) ─────────────────────────────────────────────────────
const Config={
  data:null,active:'spaces',
  async load(){this.data=await api('GET','/config/all');this.settings=await api('GET','/settings');this.render();},
  render(){
    const tabs=[['spaces','🏛️ Salles'],['pricing','💶 Tarifs'],['options','➕ Options'],['event_types','🎊 Types'],['time_slots','⏰ Horaires'],['settings','⚙️ Paramètres']];
    let html=`<div class="config-tabs">${tabs.map(t=>`<button class="config-tab ${this.active===t[0]?'active':''}" onclick="Config.active='${t[0]}';Config.render()">${t[1]}</button>`).join('')}</div><div class="card"><div style="padding:20px">`;
    html+=({spaces:()=>this.tableSpaces(),pricing:()=>this.tablePricing(),options:()=>this.tableOptions(),event_types:()=>this.tableSimple('event_types','Types d\'événement'),time_slots:()=>this.tableSlots(),settings:()=>this.formSettings()}[this.active])();
    html+='</div></div>';
    document.getElementById('configRoot').innerHTML=html;
  },
  tableSpaces(){return `<div style="display:flex;justify-content:space-between;margin-bottom:14px"><b>Salles & espaces</b><button class="btn btn-navy btn-sm" onclick="Config.editSpace()">+ Ajouter</button></div>
    <table><thead><tr><th>Nom</th><th>Assis</th><th>Debout</th><th>Couleur</th><th>Actif</th><th></th></tr></thead><tbody>
    ${this.data.spaces.map(s=>`<tr><td><b>${UI.esc(s.nom)}</b></td><td>${s.capacite_assise}</td><td>${s.capacite_debout}</td><td><span class="cal-dot" style="background:${s.couleur}"></span></td><td>${s.actif?'✅':'—'}</td>
    <td><button class="btn btn-ghost btn-sm" onclick="Config.editSpace(${s.id})">✏️</button> <button class="btn btn-red btn-sm" onclick="Config.del('spaces',${s.id})">🗑️</button></td></tr>`).join('')}</tbody></table>`;},
  tablePricing(){return `<div style="display:flex;justify-content:space-between;margin-bottom:14px"><b>Règles tarifaires</b><button class="btn btn-navy btn-sm" onclick="Config.editPricing()">+ Ajouter</button></div>
    <div class="alert alert-info">La règle la plus précise l'emporte. La <b>priorité</b> départage en cas d'égalité (plus élevé = prioritaire).</div>
    <table><thead><tr><th>Libellé</th><th>Salle</th><th>Type</th><th>Jour</th><th>Prix</th><th>Prio</th><th></th></tr></thead><tbody>
    ${this.data.pricing_rules.map(p=>`<tr><td>${UI.esc(p.libelle)}</td><td>${this.name('spaces',p.space_id)}</td><td>${this.name('event_types',p.event_type_id)}</td><td>${p.day_type}</td><td><b>${fmtEur(p.prix)}</b></td><td>${p.priorite}</td>
    <td><button class="btn btn-ghost btn-sm" onclick="Config.editPricing(${p.id})">✏️</button> <button class="btn btn-red btn-sm" onclick="Config.del('pricing-rules',${p.id})">🗑️</button></td></tr>`).join('')}</tbody></table>`;},
  tableOptions(){return `<div style="display:flex;justify-content:space-between;margin-bottom:14px"><b>Options & prestations</b><button class="btn btn-navy btn-sm" onclick="Config.editOption()">+ Ajouter</button></div>
    <table><thead><tr><th>Nom</th><th>Prix</th><th>Unité</th><th></th></tr></thead><tbody>
    ${this.data.options.map(o=>`<tr><td>${UI.esc(o.nom)}</td><td>${fmtEur(o.prix)}</td><td>${o.unite}</td><td><button class="btn btn-ghost btn-sm" onclick="Config.editOption(${o.id})">✏️</button> <button class="btn btn-red btn-sm" onclick="Config.del('options',${o.id})">🗑️</button></td></tr>`).join('')}</tbody></table>`;},
  tableSimple(table,title){return `<div style="display:flex;justify-content:space-between;margin-bottom:14px"><b>${title}</b><button class="btn btn-navy btn-sm" onclick="Config.editSimple('${table}','event-types')">+ Ajouter</button></div>
    <table><thead><tr><th>Nom</th><th>Actif</th><th></th></tr></thead><tbody>${this.data[table].map(x=>`<tr><td>${UI.esc(x.nom)}</td><td>${x.actif?'✅':'—'}</td><td><button class="btn btn-ghost btn-sm" onclick="Config.editSimple('${table}','event-types',${x.id})">✏️</button> <button class="btn btn-red btn-sm" onclick="Config.del('event-types',${x.id})">🗑️</button></td></tr>`).join('')}</tbody></table>`;},
  tableSlots(){return `<div style="display:flex;justify-content:space-between;margin-bottom:14px"><b>Plages horaires</b><button class="btn btn-navy btn-sm" onclick="Config.editSlot()">+ Ajouter</button></div>
    <table><thead><tr><th>Nom</th><th>Début</th><th>Fin</th><th></th></tr></thead><tbody>${this.data.time_slots.map(s=>`<tr><td>${UI.esc(s.nom)}</td><td>${s.heure_debut}</td><td>${s.heure_fin}</td><td><button class="btn btn-ghost btn-sm" onclick="Config.editSlot(${s.id})">✏️</button> <button class="btn btn-red btn-sm" onclick="Config.del('time-slots',${s.id})">🗑️</button></td></tr>`).join('')}</tbody></table>`;},
  name(table,id){if(!id)return'<span style="color:var(--text-lt)">tous</span>';const x=this.data[table].find(e=>e.id===id);return x?UI.esc(x.nom):'?';},
  formSettings(){const s=this.settings;const f=(k,l,t='text')=>`<div class="form-field"><label>${l}</label><input id="set-${k}" type="${t}" value="${UI.esc(s[k]||'')}"></div>`;
    return `<b>Identité & paramètres</b><div class="form-grid" style="margin-top:14px">
      ${f('org_nom','Nom')}${f('org_email','Email')}${f('org_telephone','Téléphone')}${f('org_siret','SIRET')}
      <div class="form-field span2">${''}<label>Adresse</label><input id="set-org_adresse" value="${UI.esc(s.org_adresse||'')}"></div>
      ${f('org_iban','IBAN')}${f('acompte_pct','Acompte par défaut (%)','number')}${f('solde_jours_avant','Solde dû X jours avant','number')}${f('relance_delai_jours','Délai entre relances (jours)','number')}
      <div class="form-field span2"><label>Relances automatiques</label><select id="set-relance_active"><option value="1" ${s.relance_active==='1'?'selected':''}>Activées</option><option value="0" ${s.relance_active==='0'?'selected':''}>Désactivées</option></select></div>
      <div class="form-field span2"><label>Conditions générales (CGV — apparaissent sur le contrat)</label><textarea id="set-cgv" style="min-height:120px">${UI.esc(s.cgv||'')}</textarea></div>
    </div><button class="btn btn-navy" style="margin-top:14px" onclick="Config.saveSettings()">💾 Enregistrer</button>`;},
  async saveSettings(){const keys=['org_nom','org_email','org_telephone','org_siret','org_adresse','org_iban','acompte_pct','solde_jours_avant','relance_delai_jours','relance_active','cgv'];const body={};keys.forEach(k=>body[k]=val('set-'+k));await api('PUT','/settings',body);toast('✅ Paramètres enregistrés');this.load();},
  // éditeurs génériques via modale
  genModal(title,fields,onSave){
    document.getElementById('genTitle').textContent=title;
    document.getElementById('genBody').innerHTML='<div class="form-grid">'+fields.map(f=>{
      if(f.type==='select')return `<div class="form-field ${f.span?'span2':''}"><label>${f.label}</label><select id="g-${f.k}">${f.opts.map(o=>`<option value="${o.v}" ${o.v==f.value?'selected':''}>${o.l}</option>`).join('')}</select></div>`;
      if(f.type==='textarea')return `<div class="form-field span2"><label>${f.label}</label><textarea id="g-${f.k}">${UI.esc(f.value??'')}</textarea></div>`;
      return `<div class="form-field ${f.span?'span2':''}"><label>${f.label}</label><input id="g-${f.k}" type="${f.type||'text'}" value="${UI.esc(f.value??'')}"></div>`;}).join('')+'</div>';
    document.getElementById('genFoot').innerHTML=`<button class="btn btn-ghost" onclick="UI.closeModal('modalGeneric')">Annuler</button><button class="btn btn-navy" id="genSave">💾 Enregistrer</button>`;
    document.getElementById('genSave').onclick=async()=>{try{await onSave();UI.closeModal('modalGeneric');Config.load();}catch(e){toast('❌ '+e.message,'error');}};
    UI.openModal('modalGeneric');
  },
  gv:(k)=>document.getElementById('g-'+k).value,
  editSpace(id){const s=id?this.data.spaces.find(x=>x.id===id):{};this.genModal(id?'Modifier la salle':'Nouvelle salle',[
    {k:'nom',label:'Nom',value:s.nom,span:true},{k:'capacite_assise',label:'Capacité assise',type:'number',value:s.capacite_assise},{k:'capacite_debout',label:'Capacité debout',type:'number',value:s.capacite_debout},
    {k:'surface_m2',label:'Surface (m²)',type:'number',value:s.surface_m2},{k:'couleur',label:'Couleur',type:'color',value:s.couleur||'#1E3A5F'},
    {k:'actif',label:'Actif',type:'select',value:s.actif??1,opts:[{v:1,l:'Oui'},{v:0,l:'Non'}]},{k:'description',label:'Description',type:'textarea',value:s.description}],
    ()=>api(id?'PUT':'POST','/spaces'+(id?'/'+id:''),{nom:this.gv('nom'),capacite_assise:+this.gv('capacite_assise'),capacite_debout:+this.gv('capacite_debout'),surface_m2:+this.gv('surface_m2'),couleur:this.gv('couleur'),actif:+this.gv('actif'),description:this.gv('description')}));},
  editPricing(id){const p=id?this.data.pricing_rules.find(x=>x.id===id):{day_type:'tous',priorite:0,actif:1};
    const so=[{v:'',l:'Toutes'}].concat(this.data.spaces.map(s=>({v:s.id,l:s.nom})));
    const eo=[{v:'',l:'Tous'}].concat(this.data.event_types.map(s=>({v:s.id,l:s.nom})));
    const to=[{v:'',l:'Toutes'}].concat(this.data.time_slots.map(s=>({v:s.id,l:s.nom})));
    this.genModal(id?'Modifier la règle':'Nouvelle règle tarifaire',[
    {k:'libelle',label:'Libellé',value:p.libelle,span:true},{k:'prix',label:'Prix (€)',type:'number',value:p.prix},{k:'priorite',label:'Priorité',type:'number',value:p.priorite},
    {k:'space_id',label:'Salle',type:'select',value:p.space_id||'',opts:so},{k:'event_type_id',label:'Type',type:'select',value:p.event_type_id||'',opts:eo},
    {k:'time_slot_id',label:'Plage',type:'select',value:p.time_slot_id||'',opts:to},{k:'day_type',label:'Jour',type:'select',value:p.day_type,opts:[{v:'tous',l:'Tous'},{v:'semaine',l:'Semaine'},{v:'weekend',l:'Week-end'}]}],
    ()=>api(id?'PUT':'POST','/pricing-rules'+(id?'/'+id:''),{libelle:this.gv('libelle'),prix:+this.gv('prix'),priorite:+this.gv('priorite'),space_id:+this.gv('space_id')||null,event_type_id:+this.gv('event_type_id')||null,time_slot_id:+this.gv('time_slot_id')||null,day_type:this.gv('day_type'),actif:1}));},
  editOption(id){const o=id?this.data.options.find(x=>x.id===id):{unite:'forfait'};this.genModal(id?'Modifier l\'option':'Nouvelle option',[
    {k:'nom',label:'Nom',value:o.nom,span:true},{k:'prix',label:'Prix (€)',type:'number',value:o.prix},
    {k:'unite',label:'Unité',type:'select',value:o.unite,opts:[{v:'forfait',l:'Forfait'},{v:'par_personne',l:'Par personne'},{v:'par_heure',l:'Par heure'}]}],
    ()=>api(id?'PUT':'POST','/options'+(id?'/'+id:''),{nom:this.gv('nom'),prix:+this.gv('prix'),unite:this.gv('unite'),actif:1}));},
  editSimple(table,route,id){const x=id?this.data[table].find(e=>e.id===id):{};this.genModal(id?'Modifier':'Ajouter',[{k:'nom',label:'Nom',value:x.nom,span:true}],
    ()=>api(id?'PUT':'POST','/'+route+(id?'/'+id:''),{nom:this.gv('nom'),actif:1}));},
  editSlot(id){const s=id?this.data.time_slots.find(x=>x.id===id):{};this.genModal(id?'Modifier la plage':'Nouvelle plage',[
    {k:'nom',label:'Nom',value:s.nom,span:true},{k:'heure_debut',label:'Début',value:s.heure_debut},{k:'heure_fin',label:'Fin',value:s.heure_fin}],
    ()=>api(id?'PUT':'POST','/time-slots'+(id?'/'+id:''),{nom:this.gv('nom'),heure_debut:this.gv('heure_debut'),heure_fin:this.gv('heure_fin'),actif:1}));},
  async del(route,id){confirmDialog('Supprimer','Confirmer la suppression ?','Supprimer',async()=>{await api('DELETE','/'+route+'/'+id);toast('🗑️ Supprimé','info');Config.load();});},
};

// ─── UTILISATEURS (admin) ──────────────────────────────────────────────────────
const Users={
  async load(){const us=await api('GET','/users');USERS_CACHE=us;
    document.getElementById('usersBody').innerHTML=us.map(u=>`<tr><td><b>${UI.esc(u.email)}</b></td><td>${UI.esc(u.nom)||'—'}</td>
      <td><span class="badge b-role-${u.role}">${ROLE_LABELS[u.role]}</span></td>
      <td>${u.must_change_password?'<span class="badge b-attendu">Connexion en attente</span>':(u.active?'<span class="badge b-paye">Actif</span>':'<span class="badge b-retard">Inactif</span>')}</td>
      <td style="font-size:12px;color:var(--text-lt)">${u.created_at||'—'}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="Users.edit(${u.id})">✏️</button> <button class="btn btn-red btn-sm" onclick="Users.del(${u.id},'${UI.esc(u.email)}')">🗑️</button></td></tr>`).join('');},
  form(u){const roles=[['commercial','Commercial — pipeline, devis, clients'],['regisseur','Régisseur — planning & logistique'],['administratif','Administratif — finances, paiements, contrats'],['admin','Administrateur — accès complet']];
    document.getElementById('genTitle').textContent=u?'Modifier l\'utilisateur':'Nouvel utilisateur';
    document.getElementById('genBody').innerHTML=`<div class="form-grid">
      <div class="form-field span2"><label>Email (identifiant)</label><input id="g-email" value="${UI.esc(u?.email||'')}" ${u?'disabled':''}></div>
      <div class="form-field span2"><label>Nom affiché</label><input id="g-nom" value="${UI.esc(u?.nom||'')}"></div>
      <div class="form-field span2"><label>Rôle</label><select id="g-role">${roles.map(r=>`<option value="${r[0]}" ${u?.role===r[0]?'selected':''}>${r[1]}</option>`).join('')}</select></div>
      ${!u?'<div class="alert alert-info span2" style="grid-column:span 2">📧 Un mot de passe temporaire sera envoyé par email à l\'utilisateur.</div>':''}</div>`;
    document.getElementById('genFoot').innerHTML=`<button class="btn btn-ghost" onclick="UI.closeModal('modalGeneric')">Annuler</button><button class="btn btn-navy" id="genSave">💾 Enregistrer</button>`;
    document.getElementById('genSave').onclick=async()=>{try{const body={nom:val('g-nom'),role:val('g-role')};if(u){await api('PUT','/users/'+u.id,body);}else{body.email=val('g-email');await api('POST','/users',body);}toast('✅ Enregistré');UI.closeModal('modalGeneric');USERS_CACHE=null;Users.load();}catch(e){toast('❌ '+e.message,'error');}};
    UI.openModal('modalGeneric');},
  openNew(){this.form(null);},
  async edit(id){const us=await api('GET','/users');this.form(us.find(u=>u.id===id));},
  del(id,email){confirmDialog('Supprimer l\'utilisateur',`Supprimer <b>${email}</b> ?`,'Supprimer',async()=>{await api('DELETE','/users/'+id);toast('🗑️ Supprimé','info');USERS_CACHE=null;Users.load();});},
};

// ─── MON COMPTE ────────────────────────────────────────────────────────────────
async function changePassword(){const cur=val('pwCurrent'),nw=val('pwNew'),cf=val('pwConfirm'),msg=document.getElementById('pwMsg');
  const show=(t,c)=>{msg.style.display='block';msg.style.color=c;msg.textContent=t;};
  if(nw!==cf)return show('Les mots de passe ne correspondent pas.','var(--red)');
  if(nw.length<6)return show('Minimum 6 caractères.','var(--red)');
  try{await api('PUT','/password',{current:cur,newPass:nw});show('✅ Mot de passe mis à jour','var(--green)');['pwCurrent','pwNew','pwConfirm'].forEach(i=>document.getElementById(i).value='');}
  catch(e){show('❌ '+e.message,'var(--red)');}}

// ─── INIT ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)UI.closeModal(o.id);}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-overlay.active').forEach(m=>m.classList.remove('active'));});
if(TOKEN){try{const p=JSON.parse(atob(TOKEN.split('.')[1]));if(p.exp*1000>Date.now()){if(p.mcp){document.getElementById('loginScreen').style.display='none';document.getElementById('forcePwScreen').style.display='flex';}else boot();}else logout();}catch{logout();}}
