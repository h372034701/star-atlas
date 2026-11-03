import {decrypt} from './crypto.js';
let current,key,envelope;
export const CACHE_KEY='star-atlas:encrypted-catalog:v1';
export function initialize(bundle,cryptoKey,base){current=bundle;key=cryptoKey;envelope=base;}
export async function getLibraryData(){if(!current)throw new Error('请先解锁个人目录。');return [current.data,current.editorial];}
export async function refreshLibraryData(){
 const response=await fetch(`data/vault.json?refresh=${Date.now()}`,{cache:'no-store'});
 if(!response.ok)throw new Error('暂时无法读取线上目录，原目录已保留，请稍后重试。');
 const remote=await response.json();
 if(remote.salt!==envelope.salt)throw new Error('线上目录已重新加密，请点击锁定后重新解锁。');
 const bundle=await decrypt(remote,key);
 if(bundle.data.account.login!==current.data.account.login)throw new Error('目录账号不匹配，原目录已保留。');
 current=bundle;envelope=remote;
 return bundle.data.repositories.length;
}
