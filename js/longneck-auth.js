(() => {
'use strict';
const API='https://api.ollysbakedassortments.com';
async function api(path,options={}){const r=await fetch(API+path,{credentials:'include',headers:{'Accept':'application/json','Content-Type':'application/json',...(options.headers||{})},...options});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||'Something went wrong.');return d}
async function session(){try{return await api('/longneck/session',{method:'GET'})}catch{return {authenticated:false}}}
function message(el,text,error=false){if(!el)return;el.hidden=!text;el.textContent=text||'';el.className='form-message'+(error?' error':'')}
async function bootHeader(){const d=await session();document.querySelectorAll('[data-longneck-nav]').forEach(el=>{el.textContent=d.authenticated?'My OBA':'Longneck Login';el.href=d.authenticated?'/my-oba/':'/my-oba/login.html';});document.documentElement.dataset.longneckAuth=d.authenticated?'yes':'no'}
async function requireSession(){const d=await session();if(!d.authenticated){location.replace('/my-oba/login.html?next='+encodeURIComponent(location.pathname));return null}return d}
window.OBA_LONGNECK={API,api,session,requireSession,message,bootHeader};
document.addEventListener('DOMContentLoaded',bootHeader);
})();
