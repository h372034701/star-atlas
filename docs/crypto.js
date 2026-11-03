const encoder=new TextEncoder();
export function fromBase64(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
export function toBase64(value){let text='';for(const byte of new Uint8Array(value))text+=String.fromCharCode(byte);return btoa(text);}
export async function deriveKey(password,envelope){
 if(envelope.version!==1||envelope.algorithm!=='AES-GCM'||envelope.iterations!==600000)throw new Error('不支持的目录格式');
 const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt:fromBase64(envelope.salt),iterations:envelope.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function decrypt(envelope,key){
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(envelope.iv)},key,fromBase64(envelope.ciphertext));
 const result=JSON.parse(new TextDecoder().decode(plain));
 if(!result.data?.repositories||!result.editorial)throw new Error('目录数据格式不正确');
 return result;
}
export async function encrypt(bundle,key,base){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(bundle)));
 return {version:1,algorithm:'AES-GCM',iterations:600000,salt:base.salt,iv:toBase64(iv),ciphertext:toBase64(ciphertext)};
}
