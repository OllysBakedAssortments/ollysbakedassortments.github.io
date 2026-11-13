/* OBA Cookies — Phase 03C.2 customer-facing read-only pack builder.
   Deliberately separate from OBA_CART until atomic pack reservations and server-authoritative checkout are available. */
(() => {
  'use strict';
  const root=document.getElementById('giraffe-pack-builder');
  if(!root)return;
  const el=id=>document.getElementById(id);
  const api='https://api.ollysbakedassortments.com';
  const sizes={lil:{quantity:3,baseCents:1000},tall:{quantity:6,baseCents:1800},feast:{quantity:13,baseCents:4000}};
  const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
  const STORAGE_KEY='oba-giraffe-pack-draft-v1';
  const quantities=new Map();
  let menu=null;
  let size='lil';
  let requesting=false;
  let revision=0;
  let verified=null;
  const status=el('oba-pack-status'),controls=el('oba-pack-controls'),flavors=el('oba-pack-flavors');
  const quoteButton=el('oba-pack-quote'),result=el('oba-pack-quote-result');
  const saved=el('oba-pack-saved'),saveButton=el('oba-pack-save'),discardButton=el('oba-pack-discard');
  const selected=()=>[...quantities.values()].reduce((sum,q)=>sum+q,0);
  const available=()=>menu?.products?.length>0;
  function render(){
    if(!available())return;
    const required=sizes[size].quantity,count=selected();
    el('oba-pack-progress').textContent=`${count} / ${required} selected`;
    const specialty=menu.products.reduce((sum,p)=>sum+(p.classification==='specialty'?(quantities.get(p.productId)||0):0),0);
    el('oba-pack-price').textContent=`Estimated total: ${money(sizes[size].baseCents+specialty*100)}`;
    quoteButton.disabled=requesting||count!==required;
    saveButton.disabled=requesting||!verified||verified.revision!==revision;
    flavors.replaceChildren();
    menu.products.forEach(product=>{
      const countFor=quantities.get(product.productId)||0;
      const row=document.createElement('div');row.className='oba-pack-flavor';
      const detail=document.createElement('div');
      const name=document.createElement('span');name.className='oba-pack-flavor-name';name.textContent=product.name;
      const type=document.createElement('small');type.className='oba-pack-flavor-type';type.textContent=product.classification==='specialty'?'Specialty · +$1 per cookie':'Regular cookie';
      detail.append(name,type);
      const stepper=document.createElement('div');stepper.className='oba-pack-stepper';
      const minus=document.createElement('button');minus.type='button';minus.textContent='−';minus.setAttribute('aria-label',`Remove one ${product.name}`);minus.disabled=countFor<=0;
      const counter=document.createElement('output');counter.textContent=String(countFor);counter.setAttribute('aria-label',`${product.name} selected`);
      const plus=document.createElement('button');plus.type='button';plus.textContent='+';plus.setAttribute('aria-label',`Add one ${product.name}`);plus.disabled=count>=required;
      minus.addEventListener('click',()=>setQuantity(product.productId,countFor-1));
      plus.addEventListener('click',()=>setQuantity(product.productId,countFor+1));
      stepper.append(minus,counter,plus);row.append(detail,stepper);flavors.append(row);
    });
  }
  function setQuantity(id,amount){
    if(!available()||requesting||amount<0||selected()-(quantities.get(id)||0)+amount>sizes[size].quantity)return;
    quantities.set(id,amount);revision++;verified=null;result.hidden=true;render();
  }
  root.querySelectorAll('input[name="oba-pack-size"]').forEach(input=>{
    input.addEventListener('change',()=>{
      if(!input.checked)return;
      size=input.value;
      // Clear selections when changing sizes to avoid silently trimming a customer's choices.
      quantities.clear();revision++;verified=null;result.hidden=true;render();
    });
  });
  quoteButton.addEventListener('click',async()=>{
    if(requesting||!available()||selected()!==sizes[size].quantity)return;
    requesting=true;render();result.hidden=true;
    const requestRevision=revision;
    const payload={planningDropId:menu.planningDropId,size,items:[...quantities].filter(([,q])=>q>0).map(([productId,quantity])=>({productId,quantity}))};
    try{
      const response=await fetch(`${api}/storefront/giraffe-packs/quote`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
      const data=await response.json();
      if(revision!==requestRevision)return;
      result.hidden=false;
      verified=null;
      if(!response.ok||!data.ok){result.textContent=data.error||'This pack could not be quoted. Please try again.';return;}
      if(data.available && Number.isInteger(data.quotedTotalCents))verified={revision,quotedTotalCents:data.quotedTotalCents};
      result.textContent=data.available
        ? `Pack preview: ${money(data.quotedTotalCents)} for ${data.requiredCookies} cookies (${data.specialtyCookies} specialty). Availability checked, not reserved. Checkout for packs is not active yet.`
        : 'One or more selected flavors does not have enough Online stock. Try another combination.';
    }catch(error){
      if(revision!==requestRevision)return;
      result.hidden=false;result.textContent='Pack pricing is temporarily unavailable. Please try again later.';
    }finally{requesting=false;render();}
  });
  // Saved packs are planning drafts, NEVER shared-cart entries or inventory reservations.
  // We never store availability, approvals, or a price as checkout authority.
  function readDraft(){
    try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!value||value.v!==1||typeof value.planningDropId!=='string'||!sizes[value.size]||!Array.isArray(value.items))return null;
      return value;
    }catch{return null;}
  }
  function displaySaved(){
    const draft=readDraft();
    saved.replaceChildren();
    if(!draft){saved.hidden=true;discardButton.hidden=true;return;}
    saved.hidden=false;discardButton.hidden=false;
    const title=document.createElement('strong');title.textContent='Saved Giraffe Pack draft';
    const details=document.createElement('p');
    const sizeName={lil:'Lil Giraffe',tall:'Tall Giraffe',feast:'Giraffe Feast'}[draft.size];
    const label=draft.items.map(item=>`${item.quantity} ${item.name}`).join(' · ');
    details.textContent=`${sizeName}: ${label}. Not reserved or added to checkout.`;
    saved.append(title,details);
  }
  saveButton.addEventListener('click',()=>{
    if(!menu||requesting||!verified||verified.revision!==revision||selected()!==sizes[size].quantity)return;
    const items=[...quantities].filter(([,q])=>q>0).map(([productId,quantity])=>({productId,quantity,name:menu.products.find(p=>p.productId===productId)?.name||productId}));
    const draft={v:1,planningDropId:menu.planningDropId,size,items,savedAt:new Date().toISOString()};
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(draft));displaySaved();result.hidden=false;
      result.textContent='Pack draft saved on this device. Availability and price must be checked again before checkout is enabled.';
    }catch{result.hidden=false;result.textContent='Unable to save the draft in this browser.';}
  });
  discardButton.addEventListener('click',()=>{
    try{localStorage.removeItem(STORAGE_KEY);}catch{}displaySaved();
  });
  function restoreDraft(){
    const draft=readDraft();if(!draft||draft.planningDropId!==menu.planningDropId)return;
    const productIds=new Set(menu.products.map(p=>p.productId));
    if(!draft.items.every(i=>productIds.has(i.productId)&&Number.isInteger(i.quantity)&&i.quantity>0))return;
    if(draft.items.reduce((n,i)=>n+i.quantity,0)!==sizes[draft.size].quantity)return;
    size=draft.size;
    const radio=root.querySelector(`input[name="oba-pack-size"][value="${size}"]`);
    if(radio)radio.checked=true;
    for(const item of draft.items)quantities.set(item.productId,item.quantity);
    revision++;verified=null;
  }
  async function init(){
    try{
      const response=await fetch(`${api}/storefront/giraffe-packs/menu`,{headers:{'Accept':'application/json'},cache:'no-store'});
      const data=await response.json();
      if(!response.ok||!data.ok)throw Error(data.error||'Unavailable');
      if(!Array.isArray(data.products)||!data.products.length||!data.planningDropId){
        status.textContent='Giraffe Pack builder opens when this week’s Online flavors and prices are approved. Individual cookies can still be ordered below.';
        return;
      }
      menu=data;
      restoreDraft();
      controls.hidden=false;status.hidden=true;render();
    }catch(error){status.textContent='The pack builder is temporarily unavailable. You can still order individual cookies.';}
  }
  displaySaved();
  init();
})();
