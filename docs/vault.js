import {deriveKey,decrypt} from './crypto.js';
import {initialize,CACHE_KEY} from './source.js';
const form=document.getElementById('unlock-form');
const password=document.getElementById('vault-password');
const status=document.getElementById('unlock-status');
const envelopePromise=fetch('data/vault.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('目录暂时无法加载，请稍后刷新。');return response.json();});
envelopePromise.catch(()=>{});
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;status.textContent='正在解锁你的开源地图…';
 try{
  const remote=await envelopePromise;
  const key=await deriveKey(password.value,remote);
  let bundle;
  try{bundle=await decrypt(remote,key);}catch{throw new Error('访问口令不正确，请重新输入。');}
  try{
   const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
   if(cached?.salt===remote.salt){const local=await decrypt(cached,key);if(local.data.account.login===bundle.data.account.login&&local.data.syncedAt>bundle.data.syncedAt)bundle={...bundle,data:{...local.data,lists:bundle.data.lists.map(l=>({...l,repositories:l.repositories.filter(id=>local.data.repositories.some(r=>r.id===id))}))}};}
  }catch{/* An older or damaged cache never prevents opening the published snapshot. */}
  initialize(bundle,key,remote);password.value='';
  await import('./app.js');
  document.getElementById('vault-screen').hidden=true;document.getElementById('library-app').hidden=false;
  document.getElementById('lock').addEventListener('click',()=>{history.replaceState(null,'',location.pathname);location.reload();});
  document.getElementById('search').focus({preventScroll:true});
 }catch(error){status.textContent=error.message||'解锁失败，请稍后重试。';password.focus();password.select();}finally{button.disabled=false;}
});
