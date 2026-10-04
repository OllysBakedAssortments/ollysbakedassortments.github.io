document.addEventListener('DOMContentLoaded',async()=>{
  const d=await OBA_LONGNECK.requireSession(); if(!d)return;
  const u=d.user,s=d.summary;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const tierLabel=tier=>tier==='gold'?'Gold Longneck':tier==='platinum'?'Platinum Longneck':'Longneck';
  const stampGlyph=i=>['🦒','🍪','🛒','✨','🌴','☀️'][i%6];
  const stampRotation=i=>[-7,5,-3,8,-5,3][i%6];
  const formatDate=v=>{if(!v)return'';const raw=String(v);const dt=new Date(raw.endsWith('Z')?raw:raw+'Z');return Number.isNaN(dt.getTime())?'':dt.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})};

  $('displayName').textContent=u.displayName; $('handle').textContent='@'+u.username+' · '+u.longneckId;
  $('chipBalance').textContent=s.chips+' 🍪'; $('homeFaves').textContent=s.faves; $('homeAdventures').textContent=s.adventures; $('homeMoments').textContent=s.moments;
  const rem=s.chips<500?500-s.chips:0; $('rewardProgress').textContent=rem?rem+' until a Classic Cookie':'A reward is ready'; $('progressBar').style.width=Math.min(100,(s.chips/500)*100)+'%';
  $('profileDisplay').value=u.displayName; $('profileUsername').value=u.username; $('profileAvatar').value=u.avatarKey||'olly'; $('marketingEmail').checked=u.marketingEmail; $('marketingSms').checked=u.marketingSms;

  function renderMembership(m){
    m=m||{tier:'longneck',status:'inactive'}; const tier=['gold','platinum'].includes(m.tier)?m.tier:'longneck';
    $('passportLicense').dataset.membershipTier=tier; $('cookieClass').textContent=tierLabel(tier).toUpperCase(); $('membershipTier').textContent=tierLabel(tier);
    $('membershipCard').dataset.tier=tier;
    $('membershipStatus').textContent=tier==='longneck'?'Standard Longneck account':(m.status==='active'?'Active membership':`${m.status||'inactive'} membership`);
  }
  renderMembership(s.membership);

  function renderStamps(items){
    const a=items||[]; $('stampCount').textContent=`${a.length} collected`; $('adventureCount').textContent=a.length;
    $('passportStamps').innerHTML=a.length?a.slice(0,6).map((x,i)=>`<span class="mini-stamp" style="--stamp-rotate:${stampRotation(i)}deg" title="${esc(x.event_name)} · ${esc(formatDate(x.checked_in_at))}"><b>${stampGlyph(i)}</b><small>${esc((x.event_name||'OBA').slice(0,18))}</small></span>`).join(''):'<span class="stamp-placeholder">Your first verified event stamp will land here.</span>';
    $('adventureList').innerHTML=a.length?a.map((x,i)=>`<article class="adventure-stamp-card"><div class="scrap-stamp" style="--stamp-rotate:${stampRotation(i)}deg"><b>${stampGlyph(i)}</b><span>OBA</span><small>VERIFIED</small></div><div class="scrap-copy"><span class="scrap-date">${esc(formatDate(x.checked_in_at))}</span><h3>${esc(x.event_name)}</h3><p>Stamped into your Longneck Passport.</p><span class="verified-attendance">✓ Attended</span></div></article>`).join(''):'<div class="empty-state scrapbook-empty"><strong>No stamps yet.</strong><span>Scan the event QR at a future OBA adventure and your verified stamp will appear here.</span></div>';
  }
  renderStamps([]);
  try{const x=await OBA_LONGNECK.api('/longneck/adventures');renderStamps(x.adventures||[])}catch(e){console.error(e)}

  const tabs=document.querySelectorAll('[data-tab]');
  tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));document.querySelectorAll('.passport-panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById(b.dataset.tab).classList.add('active');loadTab(b.dataset.tab)});
  async function loadTab(tab){try{
    if(tab==='chips'){const x=await OBA_LONGNECK.api('/longneck/chips');$('rewards').innerHTML=x.rewards.map(r=>`<div class="reward-row ${x.balance<r.chips?'locked':''}"><strong>${esc(r.label)}</strong><span>${r.chips} 🍪</span></div>`).join('');$('ledger').innerHTML=x.transactions.length?x.transactions.map(t=>`<div class="ledger-row"><span>${esc(t.description)}<small><br>${esc(formatDate(t.created_at))}</small></span><strong>${t.amount>0?'+':''}${t.amount}</strong></div>`).join(''):'<div class="empty-state">No Chip activity yet.</div>'}
    if(tab==='faves'){const x=await OBA_LONGNECK.api('/longneck/faves');$('faveList').innerHTML=x.faves.length?x.faves.map(f=>`<div class="simple-row"><strong>${esc(f.cookie_name)}</strong><span>♥</span></div>`).join(''):'<div class="empty-state">No Faves yet.</div>'}
    if(tab==='adventures'){const x=await OBA_LONGNECK.api('/longneck/adventures');renderStamps(x.adventures||[])}
    if(tab==='moments'){const x=await OBA_LONGNECK.api('/longneck/moments');$('momentList').innerHTML=x.moments.length?x.moments.map(m=>`<div class="simple-row"><span>${esc(m.caption||'OBA Moment')}</span><strong>${esc(m.moderation_status)}</strong></div>`).join(''):'<div class="empty-state">No Moments yet.</div>'}
    if(tab==='profile'){const x=await OBA_LONGNECK.api('/longneck/membership');renderMembership(x.membership)}
  }catch(e){console.error(e)}}
  $('profileForm').onsubmit=async e=>{e.preventDefault();try{await OBA_LONGNECK.api('/longneck/profile',{method:'POST',body:JSON.stringify({displayName:$('profileDisplay').value,username:$('profileUsername').value,avatarKey:$('profileAvatar').value,marketingEmail:$('marketingEmail').checked,marketingSms:$('marketingSms').checked})});OBA_LONGNECK.message($('profileMsg'),'Passport saved.');setTimeout(()=>location.reload(),500)}catch(x){OBA_LONGNECK.message($('profileMsg'),x.message,true)}};
  $('logout').onclick=async()=>{await OBA_LONGNECK.api('/longneck/logout',{method:'POST'});location.href='/'};
  $('logoutAll').onclick=async()=>{await OBA_LONGNECK.api('/longneck/logout-all',{method:'POST'});location.href='/'};
  $('deactivate').onclick=async()=>{if(!$('deactivatePassword').value)return;if(!confirm('Deactivate your Longneck account?'))return;try{await OBA_LONGNECK.api('/longneck/deactivate',{method:'POST',body:JSON.stringify({password:$('deactivatePassword').value})});location.href='/'}catch(x){OBA_LONGNECK.message($('profileMsg'),x.message,true)}};
});
