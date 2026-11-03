import {getLibraryData,refreshLibraryData} from './source.js';
import {categories, categoryById, classify} from './catalog.js';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = value => {try{const url=new URL(value); return ['https:','http:'].includes(url.protocol)?url.href:'#';}catch{return '#';}};
const number = value => new Intl.NumberFormat('zh-CN').format(value);
const compact = value => value>=1000 ? `${(value/1000).toFixed(value>=10000?0:1)}k` : String(value);
const date = value => value ? new Date(value).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}) : '未知';
const PAGE_SIZE=24;
let data, editorial={}, repos=[], filtered=[], notes={}, storageKey, selected=null, featureOffset=0;
let storageAvailable=true;
const params=new URLSearchParams(location.hash.slice(1));
const state={scope:params.get('scope')||'all',category:params.get('category')||'',list:params.get('list')||'',q:params.get('q')||'',language:params.get('language')||'',activity:params.get('activity')||'',license:params.get('license')||'',sort:params.get('sort')||'starred',view:params.get('view')==='list'?'list':'grid',page:Math.max(1,Number(params.get('page'))||1)};
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3600);}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(notes));return true;}catch{storageAvailable=false;toast('浏览器无法保存笔记，请导出 JSON 备份当前更改。');return false;}}
function rebuild(){
 repos=data.repositories.filter(r=>!r.isPrivate).map(r=>{
   const lists=data.lists.filter(l=>l.repositories.includes(r.id));
   const item={...r,lists,editorial:editorial[r.nameWithOwner]||{},personal:notes[r.nameWithOwner]||{}};
   item.categories=classify(r,lists,item.editorial,item.personal);
   if(!item.categories.length)item.categories=['other'];
   item.search=[r.nameWithOwner,r.description,...r.topics,...r.languages,...item.categories.map(id=>categoryById[id].name),...lists.map(l=>l.name),item.editorial.intro,item.personal.note].filter(Boolean).join(' ').toLowerCase();
   return item;
 });
}
function updateURL(){const query=new URLSearchParams();for(const [key,value] of Object.entries(state)){if(value && !({scope:'all',sort:'starred',view:'grid',page:1}[key]===value))query.set(key,value);}history.replaceState(null,'',location.pathname+(query.size?'#'+query:''));}
function navButton(label,count,attributes,icon=''){return `<button class="nav-item" ${attributes}><span class="nav-icon">${icon}</span><span class="nav-name">${esc(label)}</span><span class="nav-count">${count}</span></button>`;}
function renderNav(){
 $('primary-nav').innerHTML=[['all','全部收藏','▦',repos.length],['later','稍后阅读','♡',repos.filter(r=>r.personal.later).length],['notes','我的笔记','▱',repos.filter(r=>r.personal.note?.trim()).length],['unlisted','未加入原始分类','◌',repos.filter(r=>!r.lists.length).length]].map(([id,label,icon,count])=>navButton(label,count,`data-scope="${id}" ${state.scope===id&&!state.category&&!state.list?'aria-current="page"':''}`,icon)).join('');
 $('category-nav').innerHTML=categories.map(c=>{const count=repos.filter(r=>r.categories.includes(c.id)).length;return count?navButton(c.name,count,`data-category="${c.id}" ${state.category===c.id?'aria-current="page"':''}`,c.icon):'';}).join('');
 $('list-nav').innerHTML=data.lists.map(l=>navButton(l.name,l.repositories.length,`data-list="${esc(l.id)}" ${state.list===l.id?'aria-current="page"':''}`,'·')).join('');
 $('sidebar-count').textContent=repos.length;$('list-total').textContent=data.lists.length;
}
function renderStats(){
 const languageCount=new Set(repos.map(r=>r.primaryLanguage?.name).filter(Boolean)).size;
 const statItems=[['收藏仓库',repos.length,'PUBLIC STARS'],['探索主题',new Set(repos.flatMap(r=>r.categories)).size,'CURATED TOPICS'],['主要语言',languageCount,'PRIMARY LANGUAGES'],['原始分类',data.lists.length,'GITHUB LISTS']];
 $('stats').innerHTML=statItems.map(([label,count,sub],i)=>`<div class="stat"><span class="stat-label">${label}</span><strong>${number(count)}<span>${['↗','✳','⌘','▤'][i]}</span></strong><small>${sub}</small></div>`).join('');
}
const featuredNames=['OpenRA/OpenRA','Cysharp/UniTask','CoplayDev/unity-mcp','jrouwe/JoltPhysics','focus-creative-games/luban','godotengine/godot','rcsoccersim/rcssserver','Cysharp/MemoryPack','recastnavigation/recastnavigation','Anuken/Mindustry','genaray/Arch','mapeditor/tiled'];
function intro(repo){return repo.editorial.intro || repo.description || '仓库暂未提供介绍。可以从 README 与示例目录开始探索。';}
function renderFeatured(){
 const pool=featuredNames.map(name=>repos.find(r=>r.nameWithOwner===name)).filter(Boolean);
 $('featured').innerHTML=Array.from({length:Math.min(3,pool.length)},(_,i)=>pool[(featureOffset+i)%pool.length]).map((r,i)=>{
 const category=categoryById[r.categories[0]];
 return `<button class="feature-card feature-${i}" data-detail="${esc(r.id)}"><div class="feature-top"><span>${category.icon} &nbsp; ${category.short}</span><span>0${i+1} ↗</span></div><h3>${esc(r.name)}</h3><p>${esc(intro(r))}</p><div class="feature-bottom"><span>探索项目</span><span>↗</span></div></button>`;
 }).join('');
}
function titleAndDescription(){
 if(state.category&&categoryById[state.category])return [categoryById[state.category].name,categoryById[state.category].description];
 const list=data.lists.find(l=>l.id===state.list);
 if(list)return [list.name,`GitHub 原始分类${list.isPrivate?' · 私密分类（解锁后可见）':''}。仓库均为公开 Star。`];
 return {later:['稍后阅读','把想深入阅读的项目放在这里，留给下一次专注。'],notes:['我的笔记','保存你的观察、实验结果与下一步计划。'],unlisted:['未加入原始分类','这些 Star 尚未出现在你的 GitHub Lists 中；也可以通过主题导航找到它们。']}[state.scope]||['全部收藏','从灵感到实现，找到此刻需要的开源项目。'];
}
function filterRepos(){
 const tokens=state.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
 const yearAgo=Date.now()-365*86400000;
 filtered=repos.filter(r=>{
  if(state.category&&!r.categories.includes(state.category))return false;
  if(state.list&&!r.lists.some(l=>l.id===state.list))return false;
  if(state.scope==='later'&&!r.personal.later)return false;
  if(state.scope==='notes'&&!r.personal.note?.trim())return false;
  if(state.scope==='unlisted'&&r.lists.length)return false;
  if(state.language&&!r.languages.includes(state.language))return false;
  if(state.activity==='archived'&&!r.isArchived)return false;
  if(state.activity==='active'&&(r.isArchived||!r.pushedAt||new Date(r.pushedAt).getTime()<yearAgo))return false;
  if(state.activity==='older'&&(!r.pushedAt||new Date(r.pushedAt).getTime()>=yearAgo))return false;
  const known=r.licenseInfo?.spdxId&&r.licenseInfo.spdxId!=='NOASSERTION';
  if(state.license==='known'&&!known||state.license==='unknown'&&known)return false;
  return tokens.every(t=>r.search.includes(t));
 });
 const sorter={stars:(a,b)=>b.stargazerCount-a.stargazerCount,pushed:(a,b)=>(b.pushedAt||'').localeCompare(a.pushedAt||''),name:(a,b)=>a.nameWithOwner.localeCompare(b.nameWithOwner),starred:(a,b)=>b.starredAt.localeCompare(a.starredAt)};
 filtered.sort(sorter[state.sort]||sorter.starred);
 state.page=Math.min(Math.max(1,state.page),Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)));
}
function card(repo){
 const language=repo.primaryLanguage;
 return `<article class="repo-card"><div class="repo-top"><span class="owner">${esc(repo.nameWithOwner.split('/')[0])}</span><button class="bookmark ${repo.personal.later?'saved':''}" data-save="${esc(repo.id)}" aria-label="${repo.personal.later?'移出':'加入'}稍后阅读：${esc(repo.name)}" aria-pressed="${!!repo.personal.later}">${repo.personal.later?'♥':'♡'}</button></div><h3><a href="${safeURL(repo.url)}" target="_blank" rel="noopener noreferrer">${esc(repo.name)} <span>↗</span></a></h3><p class="repo-description" ${repo.editorial.intro?'lang="zh-CN"':''}>${esc(intro(repo))}</p><div class="repo-tags">${repo.categories.slice(0,3).map(id=>`<button data-category="${id}">${esc(categoryById[id].name)}</button>`).join('')}${repo.isArchived?'<span class="archived">已归档</span>':''}</div><div class="repo-bottom"><span class="repo-language">${language?`<i style="background:${/^#[\da-f]{6}$/i.test(language.color)?language.color:'#88948c'}"></i>${esc(language.name)}`:'未标注语言'}</span><span class="star-count">☆ ${compact(repo.stargazerCount)}</span><button class="detail-button" data-detail="${esc(repo.id)}">${repo.personal.note?'有笔记 · ':''}详情 ↗</button></div></article>`;
}
function render(){
 filterRepos();updateURL();renderNav();
 const [title,description]=titleAndDescription();
 $('results-title').innerHTML=`${esc(title)} <span id="result-count">${number(filtered.length)}</span>`;
 $('breadcrumb-current').textContent=title;$('category-description').textContent=description;
 $('filter-summary').textContent=`${number(filtered.length)} / ${number(repos.length)} 个仓库`;
 const changed=!!(state.q||state.language||state.activity||state.license||state.category||state.list||state.scope!=='all');
 $('clear').hidden=!changed;
 $('active-filters').innerHTML=[state.q&&`搜索：${state.q}`,state.language,state.activity&&$('activity').selectedOptions[0]?.textContent,state.license&&$('license').selectedOptions[0]?.textContent].filter(Boolean).map(t=>`<span>${esc(t)}</span>`).join('');
 $('repository-grid').classList.toggle('list-view',state.view==='list');
 $('grid-view').setAttribute('aria-pressed',state.view==='grid');$('list-view').setAttribute('aria-pressed',state.view==='list');
 const start=(state.page-1)*PAGE_SIZE;
 $('repository-grid').innerHTML=filtered.length?filtered.slice(start,start+PAGE_SIZE).map(card).join(''):`<div class="empty-state"><span>✳</span><h3>${state.scope==='later'?'给下次阅读留一个位置':'这里还没有匹配的仓库'}</h3><p>${state.scope==='later'?'点击仓库卡片上的 ♡，把感兴趣的项目放进来。':'试试更短的关键词，或清除筛选条件。'}</p><button class="outline-button" data-reset>查看全部收藏</button></div>`;
 const pages=Math.ceil(filtered.length/PAGE_SIZE);
 const visible=new Set([1,pages,state.page-1,state.page,state.page+1].filter(p=>p>0&&p<=pages));
 let last=0;
 $('pagination').innerHTML=pages>1?`<span>第 ${start+1}–${Math.min(start+PAGE_SIZE,filtered.length)} 项，共 ${number(filtered.length)} 项</span><div><button data-page="${state.page-1}" ${state.page===1?'disabled':''} aria-label="上一页">←</button>${[...visible].sort((a,b)=>a-b).map(p=>{const gap=p-last>1?'<span>…</span>':'';last=p;return `${gap}<button data-page="${p}" ${p===state.page?'aria-current="page"':''}>${p}</button>`;}).join('')}<button data-page="${state.page+1}" ${state.page===pages?'disabled':''} aria-label="下一页">→</button></div>`:'';
}
function syncControls(){for(const key of ['q','language','activity','license','sort'])$(key==='q'?'search':key).value=state[key];}
function setFilter(patch,scroll=false){Object.assign(state,patch,{page:1});syncControls();render();$('sidebar').classList.remove('open');$('mobile-menu').setAttribute('aria-expanded','false');if(scroll)$('results').scrollIntoView({behavior:'smooth',block:'start'});}
function reset(){setFilter({scope:'all',category:'',list:'',q:'',language:'',activity:'',license:''});}
function toggleSaved(id){const r=repos.find(r=>r.id===id);if(!r)return;notes[r.nameWithOwner]={...notes[r.nameWithOwner],later:!r.personal.later};persist();rebuild();render();toast(notes[r.nameWithOwner].later?'已加入稍后阅读':'已移出稍后阅读');}
function showDetail(id){
 const r=repos.find(r=>r.id===id);if(!r)return;selected=id;
 const known=r.licenseInfo?.spdxId&&r.licenseInfo.spdxId!=='NOASSERTION';
 $('detail-content').innerHTML=`<button class="dialog-close" data-close aria-label="关闭详情">×</button><span class="eyebrow">INSIDE THE REPOSITORY</span><div class="detail-owner">${esc(r.nameWithOwner)}</div><h2>${esc(r.name)} ${r.isArchived?'<span class="archived">已归档</span>':''}</h2>${r.editorial.intro?`<p class="detail-intro">${esc(r.editorial.intro)}</p>`:''}<p class="original-description">${esc(r.description||'GitHub 暂无仓库描述。')}</p><div class="detail-links"><a class="solid-button" href="${safeURL(r.url)}" target="_blank" rel="noopener noreferrer">打开 GitHub ↗</a>${r.homepageUrl&&safeURL(r.homepageUrl)!=='#'?`<a class="outline-button" href="${safeURL(r.homepageUrl)}" target="_blank" rel="noopener noreferrer">项目主页 ↗</a>`:''}</div><dl class="detail-facts"><div><dt>Star</dt><dd>${number(r.stargazerCount)}</dd></div><div><dt>最近推送</dt><dd>${date(r.pushedAt)}</dd></div><div><dt>我的收藏日期</dt><dd>${date(r.starredAt)}</dd></div><div><dt>许可证</dt><dd>${esc(known?r.licenseInfo.spdxId:'未识别 · 请查看仓库')}</dd></div></dl><div class="learning-box"><span class="eyebrow">学习切入点 · 基于主题的建议</span><p>${esc(categoryById[r.categories[0]].hint)}</p><small>主题由仓库元数据与原始分类匹配，可在下方调整。介绍不代表已审阅全部源码。</small></div><div class="detail-topics">${r.topics.map(t=>`<button class="topic-chip" data-search="${esc(t)}"># ${esc(t)}</button>`).join('')}</div>${r.lists.length?`<div class="detail-lists"><strong>GitHub 原始分类</strong><p>${r.lists.map(l=>`<button data-list="${esc(l.id)}">${esc(l.name)}${l.isPrivate?' · 私密':''}</button>`).join('')}</p></div>`:''}<form id="note-form"><div class="note-heading"><h3>我的学习笔记</h3><label><input id="note-later" type="checkbox" ${r.personal.later?'checked':''}> 稍后阅读</label></div><textarea id="note-text" rows="5" maxlength="20000" placeholder="为什么收藏它？看到了什么设计？下一步想试什么？" aria-label="学习笔记">${esc(r.personal.note||'')}</textarea><details class="category-editor"><summary>调整本地主题 <span>${r.personal.categories?'已手动设置':'自动匹配'}</span></summary><div>${categories.map(c=>`<label><input type="checkbox" name="category" value="${c.id}" ${r.categories.includes(c.id)?'checked':''}> ${esc(c.name)}</label>`).join('')}</div><button type="button" class="text-button" id="reset-categories">恢复自动分类</button></details><div class="note-actions"><small>保存在此浏览器 · 可通过 JSON 备份</small><button type="submit" class="solid-button">保存笔记与主题</button></div></form>`;
 $('note-form').addEventListener('submit',event=>{event.preventDefault();const cats=[...$('note-form').querySelectorAll('input[name="category"]:checked')].map(c=>c.value);notes[r.nameWithOwner]={note:$('note-text').value.trim(),later:$('note-later').checked,...(cats.join()===r.categories.join()&&!r.personal.categories?{}:{categories:cats.length?cats:['other']})};if(!notes[r.nameWithOwner].note&&!notes[r.nameWithOwner].later&&!notes[r.nameWithOwner].categories)delete notes[r.nameWithOwner];const ok=persist();rebuild();render();renderStats();showDetail(id);if(ok)toast('笔记与主题已保存');});
 $('reset-categories').addEventListener('click',()=>{notes[r.nameWithOwner]={note:$('note-text').value.trim(),later:$('note-later').checked};const ok=persist();rebuild();render();renderStats();showDetail(id);if(ok)toast('已保存笔记并恢复自动主题');});
 if(!$('detail-dialog').open)$('detail-dialog').showModal();
}
function download(filename,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const md=value=>String(value??'').replace(/[\[\]\\*_`<>]/g,'\\$&').replace(/\r?\n/g,' ');
function exportMarkdown(){
 const rows=filtered.map(r=>`### [${md(r.nameWithOwner)}](${safeURL(r.url)})\n\n${md(intro(r))}\n\n- 主题：${r.categories.map(id=>categoryById[id].name).join(' / ')}\n- 语言：${r.languages.join(', ')||'未标注'}；Star：${r.stargazerCount}；最近推送：${date(r.pushedAt)}\n- GitHub 分类：${r.lists.map(l=>md(l.name)).join(' / ')||'无'}\n- 学习切入点：${categoryById[r.categories[0]].hint}${r.personal.later?'\n- 稍后阅读：是':''}${r.personal.note?'\n\n我的笔记：\n\n'+r.personal.note:''}`);
 download('star-atlas.md',`# 我的 GitHub Star 索引\n\n账号：${data.account.login} · ${filtered.length} 个公开仓库 · ${date(data.syncedAt)} 同步\n\n${rows.join('\n\n---\n\n')}\n`,'text/markdown;charset=utf-8');toast('Markdown 目录已导出');
}
function exportJSON(){download('star-atlas-backup.json',JSON.stringify({format:'star-atlas',version:1,account:data.account.login,exportedAt:new Date().toISOString(),syncedAt:data.syncedAt,repositories:filtered,lists:data.lists,notes},null,2),'application/json');toast('已导出当前目录与全部个人笔记');}
async function importNotes(file){
 if(!file)return;
 try{
 if(file.size>25*1024*1024)throw new Error('文件过大，请使用 Star Atlas 导出的备份。');
 const backup=JSON.parse(await file.text());
 if(backup.format!=='star-atlas'||backup.version!==1||backup.account!==data.account.login||!backup.notes||typeof backup.notes!=='object'||Array.isArray(backup.notes))throw new Error('请选择当前 GitHub 账号的 Star Atlas JSON 备份。');
 const known=new Set(repos.map(r=>r.nameWithOwner));let count=0;
 for(const [name,value] of Object.entries(backup.notes)){
 if(!known.has(name)||!value||typeof value!=='object')continue;
 const item={note:typeof value.note==='string'?value.note.slice(0,20000):'',later:value.later===true};
 if(Array.isArray(value.categories)){const cats=value.categories.filter(id=>typeof id==='string'&&categoryById[id]);if(cats.length)item.categories=[...new Set(cats)];}
 notes[name]=item;count++;
 }
 const ok=persist();rebuild();render();renderStats();if(ok)toast(`已合并 ${count} 个项目的笔记和阅读状态`);
 }catch(e){toast(e.message||'无法读取备份文件');}finally{$('import-notes').value='';}
}
async function load(){
 [data,editorial]=await getLibraryData();
 if(!Array.isArray(data.repositories)||!Array.isArray(data.lists))throw new Error('目录数据格式不正确。请重新同步。');
 storageKey=`star-atlas:notes:v1:${data.account.login}`;
 try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');notes=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};}catch{notes={};storageAvailable=false;}
 if(!['all','later','notes','unlisted'].includes(state.scope))state.scope='all';
 if(!categoryById[state.category])state.category='';
 if(!data.lists.some(l=>l.id===state.list))state.list='';
 rebuild();
 const languages=[...new Set(repos.flatMap(r=>r.languages))].sort((a,b)=>a.localeCompare(b));
 $('language').innerHTML='<option value="">全部语言</option>'+languages.map(l=>`<option>${esc(l)}</option>`).join('');
 if(!languages.includes(state.language))state.language='';
 for(const key of ['activity','license','sort'])if(![...$(key).options].some(o=>o.value===state[key]))state[key]=key==='sort'?'starred':'';
 $('sync-time').textContent=`同步于 ${new Date(data.syncedAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}`;$('sidebar-user').textContent=`@${data.account.login}`;
 $('profile-name').textContent=data.account.login;$('profile-link').href=safeURL(data.account.url);
 $('footer-source').textContent=`GitHub · ${date(data.syncedAt)} · 加密个人索引`;
 syncControls();renderStats();renderFeatured();render();
 if(!storageAvailable)toast('浏览器存储不可用，个人笔记请通过 JSON 备份。');
}
async function syncGitHub(){
 $('sync').disabled=true;$('sync').textContent='⟳ 正在同步…';
 try{await refreshLibraryData();await load();toast('已载入线上最新快照；GitHub 后台每 6 小时刷新公开 Star。');}catch(error){toast(error.message||'GitHub 暂时无法连接，原目录已保留。');}finally{$('sync').disabled=false;$('sync').textContent='⟳ 同步 GitHub';}
}
document.addEventListener('click',event=>{
 const button=event.target.closest('button,a');if(!button)return;
 if(button.dataset.detail){showDetail(button.dataset.detail);return;}
 if(button.dataset.save){toggleSaved(button.dataset.save);return;}
 if('scope' in button.dataset){setFilter({scope:button.dataset.scope,category:'',list:''},true);return;}
 if('category' in button.dataset){setFilter({scope:'all',category:button.dataset.category,list:''},true);return;}
 if('list' in button.dataset){$('detail-dialog').close();setFilter({scope:'all',category:'',list:button.dataset.list},true);return;}
 if('search' in button.dataset){$('detail-dialog').close();setFilter({scope:'all',category:'',list:'',q:button.dataset.search},true);return;}
 if('reset' in button.dataset){reset();return;}
 if('close' in button.dataset){$('detail-dialog').close();return;}
 if('page' in button.dataset){state.page=Number(button.dataset.page);render();$('results').scrollIntoView({block:'start'});}
});
$('search').addEventListener('input',()=>setFilter({q:$('search').value}));
for(const key of ['language','activity','license','sort'])$(key).addEventListener('change',()=>setFilter({[key]:$(key).value}));
$('clear').addEventListener('click',reset);
document.querySelector('.brand').addEventListener('click',event=>{event.preventDefault();reset();window.scrollTo({top:0,behavior:'smooth'});});
$('grid-view').addEventListener('click',()=>{state.view='grid';render();});$('list-view').addEventListener('click',()=>{state.view='list';render();});
$('list-toggle').addEventListener('click',()=>{const expanded=$('list-toggle').getAttribute('aria-expanded')!=='true';$('list-toggle').setAttribute('aria-expanded',expanded);$('list-nav').hidden=!expanded;});
$('shuffle-featured').addEventListener('click',()=>{featureOffset+=3;renderFeatured();});
$('mobile-menu').addEventListener('click',()=>{const open=$('sidebar').classList.toggle('open');$('mobile-menu').setAttribute('aria-expanded',open);});
$('export').addEventListener('click',()=>{$('export-description').textContent=`当前筛选结果包含 ${filtered.length} 个公开仓库。Markdown 导出当前目录；JSON 同时备份全部个人笔记，导入时合并并覆盖同名项目。`;$('export-dialog').showModal();});
$('export-markdown').addEventListener('click',exportMarkdown);$('export-json').addEventListener('click',exportJSON);$('import-notes').addEventListener('change',()=>importNotes($('import-notes').files[0]));
$('sync').addEventListener('click',syncGitHub);
for(const id of ['detail-dialog','export-dialog'])$(id).addEventListener('click',e=>{if(e.target===$(id)){const rect=$(id).getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)$(id).close();}});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('detail-dialog').open&&!$('export-dialog').open){event.preventDefault();$('search').focus();}if(event.key==='Escape'){$('sidebar').classList.remove('open');$('mobile-menu').setAttribute('aria-expanded','false');}});
window.addEventListener('popstate',()=>location.reload());
load().catch(error=>{$('sync-time').textContent='目录加载失败';$('repository-grid').innerHTML=`<div class="empty-state"><h3>暂时无法读取收藏</h3><p>${esc(error.message)}</p><p>请刷新网页后重新解锁。</p><button class="outline-button" onclick="location.reload()">重新加载</button></div>`;});
