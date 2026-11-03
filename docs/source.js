import {encrypt} from './crypto.js';
import {refreshPublicStars} from './public-sync.js';
export const CACHE_KEY='star-atlas:encrypted-catalog:v1';
let current,key,envelope;
export function initialize(bundle,cryptoKey,base){current=bundle;key=cryptoKey;envelope=base;}
export async function getLibraryData(){if(!current)throw new Error('请先解锁个人目录。');return [current.data,current.editorial];}
export async function refreshLibraryData(){
 const data=await refreshPublicStars(current.data);
 const updated={...current,data};
 const cached=await encrypt(updated,key,envelope);
 try{localStorage.setItem(CACHE_KEY,JSON.stringify(cached));}catch{throw new Error('浏览器存储空间不足，原目录已保留。请清理空间后重试。');}
 current=updated;
 return data.repositories.length;
}
