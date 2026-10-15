import {LOCKED_BILLS} from './locked-bills.js';
const form=document.getElementById('unlockForm'),status=document.getElementById('unlockStatus'),button=document.getElementById('unlockButton');
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
form.addEventListener('submit',async event=>{
 event.preventDefault();button.disabled=true;status.textContent='正在本机解密账单…';
 try{
  if(!crypto.subtle)throw Error('当前浏览器无法安全解密，请使用较新版本的手机浏览器。');
  const password=document.getElementById('accessCode').value.trim();
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:bytes(LOCKED_BILLS.salt),iterations:LOCKED_BILLS.iterations},material,{name:'AES-GCM',length:256},false,['decrypt']);
  let plain;try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(LOCKED_BILLS.iv)},key,bytes(LOCKED_BILLS.data));}catch{throw Error('口令不正确，请检查复制是否完整。');}
  const data=JSON.parse(new TextDecoder().decode(plain));
  const {validateBill}=await import('./core.js');
  if(data.format!=='card-ledger'||!Array.isArray(data.bills)||!data.bills.every(validateBill))throw Error('账单校验失败，请保留备份并联系维护者。');
  // Preserve bills already edited in this browser; the published snapshot is an initial seed only.
  const existing=localStorage.getItem('bill-reminder-independent-v1');
  if(existing===null)localStorage.setItem('bill-reminder-independent-v1',JSON.stringify(data.bills));
  await import('./app.js');
  document.getElementById('accessCode').value='';document.getElementById('unlockGate').hidden=true;document.querySelector('.app').hidden=false;
 }catch(error){status.textContent=error.message||'无法打开账单，请检查口令或浏览器存储权限。';button.disabled=false;}
});
