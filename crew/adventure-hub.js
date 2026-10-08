document.addEventListener('DOMContentLoaded',async()=>{
  const session=await OBA_CREW_AUTH.requireCrewSession();if(!session)return;
  OBA_CREW_SHELL.mount({activePage:'adventureHub'});OBA_CREW_SHELL.renderCrewIdentity(session);
  const $=id=>document.getElementById(id),esc=OBA_CREW_CORE.esc,api=OBA_CREW_CORE.api;
  const label=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
  const date=s=>s?new Date(s).toLocaleString('en-US',{timeZone:'America/Los_Angeles',dateStyle:'medium',timeStyle:'short'}):'Not scheduled';
  let adventures=[];
  const message=(s)=>{$('hubMessage').hidden=!s;$('hubMessage').textContent=s||'';$('hubMessage').className='adv-alert error'};
  const line=a=>`<tr><td><strong>${esc(a.title||'Untitled')}</strong><br><small>${esc(label(a.event_type))}</small></td><td>${esc(date(a.starts_at))}</td><td>${esc(a.location_name||'TBD')}</td><td><span class="adv-pill">${esc(label(a.lifecycle_status))}</span></td><td>${esc(label(a.recap_status))}</td></tr>`;
  const render=()=>{
    const count=s=>adventures.filter(a=>a.lifecycle_status===s).length;
    const pending=adventures.filter(a=>['recap_pending','ended_early'].includes(a.lifecycle_status)||(['past'].includes(a.lifecycle_status)&&a.recap_status!=='published'));
    $('hubStats').innerHTML=[['Total',adventures.length],['Upcoming',count('upcoming')+count('event_day')],['Live',count('live')],['Recaps needing attention',pending.length]].map(([k,v])=>`<div class="adv-stat"><strong>${v}</strong>${esc(k)}</div>`).join('');
    const upcoming=adventures.filter(a=>['upcoming','event_day','rescheduled'].includes(a.lifecycle_status)).sort((a,b)=>String(a.starts_at||'').localeCompare(String(b.starts_at||''))).slice(0,5);
    const blocks=[['Live now',adventures.filter(a=>a.lifecycle_status==='live')],['Recap queue',pending],['Next Adventures',upcoming],['Drafts to prepare',adventures.filter(a=>a.lifecycle_status==='draft')]];
    $('hubQueues').innerHTML=blocks.map(([title,items])=>`<div class="adv-card"><h3>${esc(title)} (${items.length})</h3>${items.length?`<ul>${items.map(a=>`<li><strong>${esc(a.title)}</strong> — ${esc(date(a.starts_at))} · ${esc(label(a.lifecycle_status))}</li>`).join('')}</ul>`:'<p class="adv-muted">Nothing in this queue.</p>'}</div>`).join('');
    const q=$('hubSearch').value.toLowerCase().trim(),s=$('hubFilter').value;const rows=adventures.filter(a=>(!s||a.lifecycle_status===s)&&(!q||[a.title,a.location_name,a.slug].some(x=>String(x||'').toLowerCase().includes(q))));
    $('hubRows').innerHTML=rows.map(line).join('')||'<tr><td colspan="5">No matching Adventures.</td></tr>';
  };
  const load=async()=>{try{const data=await api('/crew/adventures');adventures=data.adventures||[];message('');render()}catch(e){message(e.message||'Unable to load Adventures.');$('hubStats').innerHTML='';$('hubQueues').innerHTML='';$('hubRows').innerHTML='<tr><td colspan="5">Unable to load.</td></tr>'}};
  $('reloadHub').onclick=load;$('hubSearch').oninput=render;$('hubFilter').onchange=render;await load();
});
