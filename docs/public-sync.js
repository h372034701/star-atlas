const languageColors={'C#':'#178600','C++':'#f34b7d',C:'#555555',Rust:'#dea584',Python:'#3572A5',JavaScript:'#f1e05a',TypeScript:'#3178c6',HTML:'#e34c26',Go:'#00ADD8',Lua:'#000080'};
export async function refreshPublicStars(previous, request=fetch){
 const oldByName=new Map(previous.repositories.map(r=>[r.nameWithOwner,r]));
 const repositories=[];let page=1;
 while(true){
  const url=`https://api.github.com/users/${encodeURIComponent(previous.account.login)}/starred?per_page=100&page=${page}&sort=created&direction=desc`;
  const response=await request(url,{headers:{Accept:'application/vnd.github.star+json'}});
  if(!response.ok)throw new Error([403,429].includes(response.status)?'GitHub 请求频率受限，原目录已保留，请稍后重试。':'GitHub 暂时无法连接，原目录已保留。');
  const entries=await response.json();
  if(!Array.isArray(entries))throw new Error('GitHub 返回格式异常，原目录已保留。');
  for(const entry of entries){
   const r=entry.repo;if(!r||r.private)continue;
   const old=oldByName.get(r.full_name);
   const language=r.language?{name:r.language,color:old?.primaryLanguage?.name===r.language?old.primaryLanguage.color:languageColors[r.language]||'#88948c'}:null;
   repositories.push({id:r.node_id,name:r.name,nameWithOwner:r.full_name,description:r.description,url:r.html_url,homepageUrl:r.homepage,isPrivate:false,isArchived:r.archived,isFork:r.fork,stargazerCount:r.stargazers_count,forkCount:r.forks_count,pushedAt:r.pushed_at,updatedAt:r.updated_at,createdAt:r.created_at,primaryLanguage:language,languages:[...new Set([r.language,...(old?.languages||[])].filter(Boolean))],licenseInfo:r.license?{spdxId:r.license.spdx_id,name:r.license.name}:null,starredAt:entry.starred_at,topics:r.topics||[]});
  }
  if(entries.length<100)break;
  if(++page>1000)throw new Error('Star 页数异常，原目录已保留。');
 }
 const ids=new Set(repositories.map(r=>r.id));
 return {...previous,repositories,lists:previous.lists.map(l=>({...l,repositories:l.repositories.filter(id=>ids.has(id))})),syncedAt:new Date().toISOString(),source:'GitHub public REST API'};
}
