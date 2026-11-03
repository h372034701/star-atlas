// Plain data and the access passphrase must remain outside this repository.
import fs from 'node:fs/promises';
import path from 'node:path';
import {webcrypto} from 'node:crypto';
const [sourceRoot,passwordFile]=process.argv.slice(2);
if(!sourceRoot||!passwordFile)throw new Error('Usage: node scripts/pack.mjs /path/to/local/star-atlas /path/to/access-password.txt');
const source=path.resolve(sourceRoot);
const password=(await fs.readFile(passwordFile,'utf8')).trim();
if(password.length<24)throw new Error('Use a randomly generated passphrase of at least 24 characters.');
const {encrypt,deriveKey}=await import('../docs/crypto.js');
const data=JSON.parse(await fs.readFile(path.join(source,'data/stars.json'),'utf8'));
const editorial=JSON.parse(await fs.readFile(path.join(source,'data/editorial.json'),'utf8'));
const allowed=new Set(data.repositories.filter(r=>!r.isPrivate).map(r=>r.id));
data.repositories=data.repositories.filter(r=>allowed.has(r.id));
data.lists=data.lists.map(l=>({...l,repositories:l.repositories.filter(id=>allowed.has(id))}));
const base={version:1,algorithm:'AES-GCM',iterations:600000,salt:Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString('base64')};
const key=await deriveKey(password,base);
const envelope=await encrypt({data,editorial},key,base);
await fs.mkdir('docs/data',{recursive:true});
await fs.writeFile('docs/data/vault.json',JSON.stringify(envelope));
for(const filename of ['styles.css','catalog.js']){
 let content=await fs.readFile(path.join(source,filename),'utf8');
 if(filename==='catalog.js')for(const list of data.lists.filter(l=>l.isPrivate))content=content.replaceAll(`,'${list.name}':'games'`,'');
 await fs.writeFile(path.join('docs',filename),content);
}
let app=await fs.readFile(path.join(source,'app.js'),'utf8');
app="import {getLibraryData,refreshLibraryData} from './source.js';\n"+app;
const start=app.indexOf(' const responses=await Promise.all(');
const end=app.indexOf(' if(!Array.isArray(data.repositories)',start);
if(start<0||end<0)throw new Error('Local app structure changed; check the adapter.');
app=app.slice(0,start)+' [data,editorial]=await getLibraryData();\n'+app.slice(end);
const syncStart=app.indexOf('async function syncGitHub(){');
const syncEnd=app.indexOf("document.addEventListener('click'",syncStart);
app=app.slice(0,syncStart)+`async function syncGitHub(){
 $('sync').disabled=true;$('sync').textContent='⟳ 正在同步…';
 try{await refreshLibraryData();await load();toast('已载入线上最新快照；GitHub 后台每 6 小时刷新公开 Star。');}catch(error){toast(error.message||'GitHub 暂时无法连接，原目录已保留。');}finally{$('sync').disabled=false;$('sync').textContent='⟳ 同步 GitHub';}
}
`+app.slice(syncEnd);
app=app.replaceAll('私密分类（仅本机显示）','私密分类（解锁后可见）').replaceAll('本地个人索引','加密个人索引').replaceAll('GitHub GraphQL ·','GitHub ·');
app=app.replace('<p>请在项目目录运行：<code>python scripts/serve.py</code></p>','<p>请刷新网页后重新解锁。</p>');
app=app.replace('new URLSearchParams(location.search)','new URLSearchParams(location.hash.slice(1))');
app=app.replace("location.pathname+(query.size?'?'+query:'')","location.pathname+(query.size?'#'+query:'')");
await fs.writeFile('docs/app.js',app);
let html=await fs.readFile(path.join(source,'index.html'),'utf8');
html=html.replace('<body>',`<body>
  <section id="vault-screen" class="vault-screen" aria-labelledby="vault-title">
    <div class="vault-card"><div class="vault-brand">✳ STAR ATLAS</div><span class="eyebrow">YOUR PRIVATE OPEN SOURCE LIBRARY</span><h1 id="vault-title">让好奇心，<br>有迹可循。</h1><p>你的个人开源地图。输入访问口令，继续探索。</p><form id="unlock-form"><label for="vault-password">访问口令</label><input id="vault-password" name="password" type="password" autocomplete="current-password" required placeholder="输入你的访问口令"><button type="submit" class="solid-button">解锁我的书架 ↗</button><div id="unlock-status" role="status" aria-live="polite"></div></form><small>目录加密保存，口令只在当前设备用于解锁。</small></div>
  </section><div id="library-app" hidden>`);
html=html.replace('<div class="top-actions">','<div class="top-actions"><button id="lock" class="text-button" title="锁定并清除当前页面的解锁状态">锁定 ⏣</button>');
html=html.replace('<span id="list-total">24</span>','<span id="list-total">—</span>');
html=html.replace('<script type="module" src="app.js"></script>','</div><script type="module" src="vault.js"></script>');
html=html.replace('<meta name="color-scheme"','<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="color-scheme"');
await fs.writeFile('docs/index.html',html);
await fs.appendFile('docs/styles.css',`\n.vault-screen{min-height:100dvh;display:grid;place-items:center;padding:35px 20px;background:radial-gradient(ellipse at 80% 20%,#e2ead6,transparent 50%),#f7f7f2}.vault-card{width:100%;max-width:440px;border:1px solid #dce4d2;border-radius:14px;background:#fcfcf7;padding:46px;box-shadow:0 20px 80px #3043290a}.vault-brand{font-size:20px;font-weight:750;letter-spacing:2px;margin-bottom:45px}.vault-card .eyebrow{font-size:8px;letter-spacing:1.8px}.vault-card h1{font-size:37px;line-height:1.5;letter-spacing:1px;font-weight:550;margin:20px 0}.vault-card>p{font-size:12px;color:#7e8f70;line-height:1.9;margin-bottom:30px}.vault-card label{display:block;font-size:11px;color:#809273;margin-bottom:9px}.vault-card input{width:100%;background:#fffef9;color:#2a4a32;border:1px solid #d9e3cb;padding:13px 14px;border-radius:5px;font-size:13px;min-height:46px}.vault-card input::placeholder{color:#a0ad92}.vault-card button{width:100%;margin-top:14px;padding:14px;font-size:12px}.vault-card small{display:block;color:#9aa98b;font-size:10px;line-height:1.9;margin-top:22px}#unlock-status{font-size:11px;color:#947e59;line-height:1.7;min-height:20px;margin-top:12px}@media(max-width:500px){.vault-card{padding:33px 26px}.vault-card h1{font-size:33px}.vault-brand{margin-bottom:32px}}\n`);
await fs.writeFile('docs/.nojekyll','');
for(const file of await fs.readdir('docs')){const stat=await fs.stat(path.join('docs',file));if(!stat.isFile())continue;const text=await fs.readFile(path.join('docs',file),'utf8');if(text.includes(password))throw new Error('Access key detected in public assets');for(const list of data.lists.filter(l=>l.isPrivate))if(text.includes(list.name))throw new Error('Private list label detected in '+file);}
console.log(`Prepared encrypted site: ${data.repositories.length} public Stars; ${data.lists.length} lists. No plaintext dataset is published.`);
