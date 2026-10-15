import {setupReminders} from './reminders.js';
import {BANKS,dateKey,validMonth,daysUntil,amountToCents,validateBill,duplicateKey,parseStatement,makeCalendar,latestBills,paidAmount,remainingAmount,paymentRecords,normalizePayment,addPayment,removePayment} from './core.js';
function newId(){if(globalThis.crypto?.randomUUID)return crypto.randomUUID();const a=new Uint8Array(16);crypto.getRandomValues(a);return [...a].map(v=>v.toString(16).padStart(2,'0')).join('');}
const $=id=>document.getElementById(id),KEY='bill-reminder-independent-v1';
const money=n=>(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let reminderUI;
let bills=[],demo=false,demoBills=[],filter='all',editing=null,hiddenAmounts=false,toastTimer,storageReadFailed=false,latestMode=true;
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4500);}
try{const raw=localStorage.getItem(KEY);if(raw){const data=JSON.parse(raw);if(!Array.isArray(data)||!data.every(validateBill))throw Error();bills=data.map(normalizePayment);}}catch{storageReadFailed=true;toast('本机数据读取失败，已停止写入以保护原数据。请先导出原始备份。');}
function persist(next){next=next.map(normalizePayment);if(storageReadFailed){toast('本机原数据异常，已停止写入。请先导出原始备份并联系维护者。');return false;}try{localStorage.setItem(KEY,JSON.stringify(next));bills=next;return true;}catch{toast('保存失败：请检查浏览器存储权限，或先导出备份。');return false;}}
function ask(message){return new Promise(resolve=>{const dialog=$('confirmDialog');$('confirmMessage').textContent=message;let result=false;$('acceptAction').onclick=()=>{result=true;dialog.close();};$('cancelAction').onclick=()=>dialog.close();dialog.onclose=()=>resolve(result);dialog.showModal();});}
function source(){return demo?demoBills:bills;}
function currentList(){return (latestMode?latestBills(source()):source().filter(b=>b.period===$('month').value)).sort((a,b)=>a.due.localeCompare(b.due)||a.bank.localeCompare(b.bank));}
function maskedMailbox(s){return s.replace(/^(.{3}).*?(@.*)$/,'$1…$2');}
function setMode(latest){latestMode=latest;$('monthbar').hidden=latest;$('latestButton').classList.toggle('selected',latest);$('periodButton').classList.toggle('selected',!latest);render();}
function replace(next){next=next.map(normalizePayment);if(demo){demoBills=next;return true;}return persist(next);}
function showView(id){for(const el of document.querySelectorAll('.view'))el.classList.toggle('active',el.id===id);for(const b of document.querySelectorAll('nav button'))b.classList.toggle('active',b.dataset.view===id);window.scrollTo({top:0,behavior:'smooth'});render();}
function display(n){return hiddenAmounts?'••••':money(n);}
function render(){
 const list=currentList();
 const pending=list.filter(b=>!b.paid),sum=xs=>xs.reduce((a,b)=>a+b.amount,0);
 $('total').textContent=display(list.reduce((n,b)=>n+remainingAmount(b),0));$('allTotal').textContent='¥'+display(sum(list));$('paidTotal').textContent='¥'+display(list.reduce((n,b)=>n+paidAmount(b),0));$('unpaidCount').textContent=pending.length+' 笔';$('billCount').textContent=list.length;
 $('totalLabel').textContent=latestMode?'各卡最新账单 · 剩余应还合计':'所选账期 · 剩余应还合计';$('listTitle').textContent=latestMode?'各卡最新账单':'所选账期账单';
 $('snapshotNote').textContent=demo?'示例模式 · 与真实账单分开':`本机保存 ${bills.length} 份账单 · 无需登录 · 未自动读取邮箱，请更新每期账单。`;
 $('demoNotice').hidden=!demo;$('calendarButton').disabled=!pending.length;
 const overdue=pending.filter(b=>daysUntil(b.due)<0);$('overdueNotice').hidden=!overdue.length;$('overdueNotice').textContent=`有 ${overdue.length} 份账单已过记录的还款日且未标记还款，最长逾期 ${overdue.length?Math.max(...overdue.map(b=>-daysUntil(b.due))):0} 天。天数按记录的还款日计算，请核对银行实际状态。`;
 const shown=list.filter(b=>filter==='all'||(filter==='paid'?b.paid:!b.paid));
 $('empty').hidden=list.length>0;
 $('billList').innerHTML=shown.map(b=>{const bank=BANKS.find(x=>x.id===b.bank),days=daysUntil(b.due);const status=b.paid?'已标记还款':days<0?`逾期 ${-days} 天 · 待核实`:days===0?'账单今天到期':days<=7?`${days} 天后到期`:'还款状态未核实';return `<article class="bill-card"><div class="bill-top"><span class="bank-avatar" style="--bank-color:${bank.color}">${bank.short}</span><div><div class="bill-bank">${bank.name}</div><div class="bill-tail">信用卡 · ${b.tail}</div></div><span class="badge ${!b.paid&&days<0?'late':!b.paid&&days<=7?'soon':''}">${status}</span></div><div class="bill-middle"><div class="bill-amount"><small>¥</small>${display(remainingAmount(b))}</div><div class="bill-due"><small>最后还款日</small>${b.due.replaceAll('-','.')}</div></div><p class="bill-source">剩余应还 · 账单 ¥${display(b.amount)} · 累计已还 ¥${display(paidAmount(b))}</p><p class="bill-source">${b.period} 账期${b.sourceMailbox?' · 来源 '+esc(maskedMailbox(b.sourceMailbox)):''}</p>${b.note?`<p class="bill-note">${esc(b.note)}</p>`:''}<div class="bill-bottom"><span>最低还款 ${b.minimum===null?'未填写':'¥'+display(b.minimum)}</span><button class="text-btn" data-edit="${b.id}">编辑</button><button class="paid-button" data-payment="${b.id}">${b.paid?'查看还款':'记一笔还款'}</button><button class="text-btn" data-delete="${b.id}" aria-label="删除${bank.name}尾号${b.tail}账单">删除</button></div></article>`;}).join('')+(list.length&&!shown.length?'<p class="footnote">这个筛选下还没有账单。</p>':'');
 $('bankList').innerHTML=BANKS.map(bank=>{const cards=new Set(source().filter(b=>b.bank===bank.id).map(b=>b.tail));const count=source().filter(b=>b.bank===bank.id&&!b.paid).length;return `<article class="bank-tile"><span class="bank-avatar" style="--bank-color:${bank.color}">${bank.short}</span><h3>${bank.name}</h3><p>${cards.size?`${cards.size} 张卡 · ${count} 份待还账单`:'尚未导入账单'}</p></article>`;}).join('');
 reminderUI?.render();
}
function openImport(){if(demo){toast('已退出示例模式，接下来保存的是真实账单。');demo=false;render();}$('importDialog').showModal();}
function openEditor(values={},isEdit=false){
 $('billForm').reset();editing=isEdit?values.id:null;
 $('editTitle').textContent=isEdit?'编辑账单':values.warnings?'核对识别结果':'手动记录账单';
 $('bankInput').value=values.bank||'';$('tailInput').value=values.tail||'';$('periodInput').value=values.period||'';
 $('amountInput').value=isEdit?(values.amount/100).toFixed(2):values.amount??'';
 $('minimumInput').value=isEdit?(values.minimum===null?'':(values.minimum/100).toFixed(2)):values.minimum??'';
 $('dueInput').value=values.due||'';$('noteInput').value=values.note||'';
 $('reviewNote').textContent=values.warnings?.length?values.warnings.join(' '):'请按银行账单原文核对金额和还款日。仅支持人民币账单。';
 $('editDialog').showModal();
}
function shiftMonth(n){const [y,m]=$('month').value.split('-').map(Number);const d=new Date(y,m-1+n,1,12);$('month').value=dateKey(d).slice(0,7);render();}
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function htmlToText(html){
 // Extract text without constructing a document, so email tracking images and
 // other remote resources cannot load during import.
 const plain=html.replace(/<!--[^]*?-->/g,'').replace(/<(script|style|head|iframe|object)\b[^>]*>[^]*?<\/\1\s*>/gi,'').replace(/<\s*(?:br\b[^>]*|\/(?:p|div|tr|td|li|table)\s*)>/gi,'\n').replace(/<[^>]*>/g,'');
 const entities={nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",yen:'¥'};
 return plain.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,key)=>{if(key[0]!=='#')return entities[key.toLowerCase()]??m;const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';});
}
function decodeBytes(bytes,charset){try{return new TextDecoder(charset||'utf-8').decode(bytes);}catch{return new TextDecoder('utf-8').decode(bytes);}}
function mimeText(input,depth=0){
 if(depth>12)throw Error('邮件嵌套过深，请直接复制正文。');
 const split=input.search(/\r?\n\r?\n/);if(split<0)return input;
 const headers=input.slice(0,split).replace(/\r?\n[ \t]+/g,' '),body=input.slice(split).replace(/^\r?\n\r?\n/,'');
 const ct=headers.match(/^Content-Type:\s*(.+)$/im)?.[1]||'text/plain';
 if(/multipart\//i.test(ct)){const boundary=ct.match(/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);if(!boundary)throw Error('邮件格式无法识别，请复制正文。');const parts=body.split('--'+(boundary[1]||boundary[2])).slice(1).filter(p=>!p.startsWith('--')).map(p=>p.replace(/^\r?\n/,'')).filter(p=>!/^Content-Disposition:.*attachment/im.test(p));const texts=parts.map(p=>mimeText(p,depth+1)).filter(Boolean);return [...new Set(texts)].join('\n');}
 if(!/^text\/(plain|html)/i.test(ct))return '';
 const charset=ct.match(/charset\s*=\s*"?([^;"\s]+)/i)?.[1]||'utf-8';
 const encoding=headers.match(/^Content-Transfer-Encoding:\s*(.+)$/im)?.[1]?.trim().toLowerCase();let out=body;
 if(encoding==='base64'){const bin=atob(body.replace(/\s/g,''));out=decodeBytes(Uint8Array.from(bin,c=>c.charCodeAt(0)),charset);}
 else if(encoding==='quoted-printable'){const s=body.replace(/=\r?\n/g,'');const bytes=[];for(let i=0;i<s.length;i++){if(s[i]==='='&&/^[0-9a-f]{2}$/i.test(s.slice(i+1,i+3))){bytes.push(parseInt(s.slice(i+1,i+3),16));i+=2;}else bytes.push(s.charCodeAt(i)&255);}out=decodeBytes(new Uint8Array(bytes),charset);}
 // The outer file has already been decoded as UTF-8. Common raw legacy EML
 // should be transfer-encoded; leave uncertain text for manual correction.
 return /^text\/html/i.test(ct)?htmlToText(out):out;
}
function setupDemo(){
 const period=$('month').value;demoBills=BANKS.slice(0,3).map((bank,i)=>{const d=new Date();d.setDate(d.getDate()+[3,9,-2][i]);return {id:'demo-'+i,bank:bank.id,tail:['6829','1036','5288'][i],period,amount:[428650,167800,302420][i],minimum:[42865,16780,30242][i],due:dateKey(d),paid:i===2,note:'示例数据，仅用于体验'};});demo=true;showView('overview');render();toast('已进入示例模式，真实账单不会受到影响。');
}
$('bankInput').innerHTML='<option value="">请选择银行</option>'+BANKS.map(b=>`<option value="${b.id}">${b.name}</option>`).join('');
$('month').value=dateKey().slice(0,7);$('month').addEventListener('change',()=>{if(!validMonth($('month').value))$('month').value=dateKey().slice(0,7);render();});
$('prevMonth').onclick=()=>shiftMonth(-1);$('nextMonth').onclick=()=>shiftMonth(1);$('todayMonth').onclick=()=>{$('month').value=dateKey().slice(0,7);render();};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>showView(b.dataset.view));document.querySelector('.brand').onclick=e=>{e.preventDefault();showView('overview');};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));render();});
$('privacyButton').onclick=()=>{hiddenAmounts=!hiddenAmounts;$('privacyButton').textContent=hiddenAmounts?'显示金额':'隐藏金额';render();};
$('helpButton').onclick=()=>$('helpDialog').showModal();$('importButton').onclick=openImport;$('emptyImport').onclick=openImport;
$('manualButton').onclick=()=>{if(demo){demo=false;render();}openEditor({period:$('month').value});};
$('parseButton').onclick=()=>{const text=$('statementText').value.trim();if(!text)return toast('请先粘贴账单文字或选择文件。');$('importDialog').close();openEditor(parseStatement(text));};
$('statementFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('文件超过 2MB，请复制需要的账单正文。');const ext=file.name.split('.').pop().toLowerCase();if(!['txt','html','htm','eml'].includes(ext))throw Error('请选择 TXT、HTML 或 EML 文件。');const raw=await file.text();const text=ext==='eml'?mimeText(raw):['html','htm'].includes(ext)?htmlToText(raw):raw;if(text.length>200000)throw Error('正文过长，请只复制当前账单部分。');if(!text.trim())throw Error('未找到文字正文，请手动填写。');$('statementText').value=text;toast('文件已读入，请点击“识别并核对”。');}catch(error){toast(error.message||'文件读取失败，请复制正文。');}finally{e.target.value='';}};
$('billForm').onsubmit=async e=>{
 e.preventDefault();const min=$('minimumInput').value.trim();const b={...(editing?source().find(x=>x.id===editing):{}),id:editing||newId(),bank:$('bankInput').value,tail:$('tailInput').value.trim(),period:$('periodInput').value,amount:amountToCents($('amountInput').value),minimum:min===''?null:amountToCents(min),due:$('dueInput').value,paid:editing?(source().find(x=>x.id===editing)?.paid||false):false,note:$('noteInput').value.trim()};
 if(!validateBill(b)||!$('confirmInput').checked)return toast('请检查字段：卡尾号需 4 位，最低还款额不能超过应还金额。');
 const duplicate=source().find(x=>duplicateKey(x)===duplicateKey(b)&&x.id!==b.id);if(duplicate)return toast('该卡本月已有账单，请编辑原账单，避免重复计入。');
 const previous=source().find(x=>x.id===editing);if(previous&&paidAmount(previous)>0&&duplicateKey(previous)!==duplicateKey(b)){if(!await ask('你修改了卡片或账期，这将作为另一份待还账单保存。继续？'))return;b.paid=false;b.payments=[];}
 const next=editing?source().map(x=>x.id===b.id?b:x):[...source(),b];if(replace(next)){$('editDialog').close();$('statementText').value='';$('month').value=b.period;showView('overview');toast(demo?'示例账单已保存':'账单已保存在本机。');}
};
let paymentBillId=null,paymentBusy=false;
function openPayments(id){paymentBillId=id;const b=source().find(x=>x.id===id);if(!b)return;$('paymentTitle').textContent=BANKS.find(x=>x.id===b.bank).name+' · 尾号 '+b.tail;$('paymentSummary').textContent='账单 ¥'+display(b.amount)+' · 累计已还 ¥'+display(paidAmount(b))+' · 剩余 ¥'+display(remainingAmount(b));$('paymentAmount').value='';$('paymentDate').value=dateKey();$('paymentAmount').max=(remainingAmount(b)/100).toFixed(2);$('paymentForm').hidden=remainingAmount(b)===0;$('paymentError').textContent='';$('paymentHistory').innerHTML=paymentRecords(b).map(p=>`<li><span>${p.date||'以前标记全额已还'} · ¥${display(p.amount)}</span><button type="button" class="text-btn" data-remove-payment="${esc(p.id)}">撤销</button></li>`).join('')||'<li>还没有还款记录。</li>';if(!$('paymentDialog').open)$('paymentDialog').showModal();}
$('billList').onclick=async e=>{const btn=e.target.closest('button');if(!btn)return;const id=btn.dataset.edit||btn.dataset.payment||btn.dataset.delete;const b=source().find(x=>x.id===id);if(!b)return;if(btn.dataset.edit)openEditor(b,true);if(btn.dataset.payment)openPayments(id);if(btn.dataset.delete&&await ask('删除这份账单？此操作无法撤销。')){if(replace(source().filter(x=>x.id!==id)))render();}};
$('paymentForm').onsubmit=e=>{e.preventDefault();if(paymentBusy)return;paymentBusy=true;try{const b=source().find(x=>x.id===paymentBillId);if(!b)throw Error('账单已发生变化，请重新打开。');const updated=addPayment(b,amountToCents($('paymentAmount').value),newId(),$('paymentDate').value);if(replace(source().map(x=>x.id===b.id?updated:x))){render();openPayments(b.id);toast('已记录本次还款，剩余金额已更新。');}}catch(error){$('paymentError').textContent=error.message;}finally{paymentBusy=false;}};
$('paymentHistory').onclick=async e=>{const btn=e.target.closest('[data-remove-payment]');if(!btn||paymentBusy)return;paymentBusy=true;try{if(!await ask('确认撤销这笔还款记录？剩余应还金额将重新计算。'))return;const b=source().find(x=>x.id===paymentBillId);if(!b)return;const updated=removePayment(b,btn.dataset.removePayment);if(replace(source().map(x=>x.id===b.id?updated:x))){render();openPayments(b.id);toast('这笔还款记录已撤销。');}}finally{paymentBusy=false;}};
$('demoButton').onclick=setupDemo;$('exitDemo').onclick=()=>{demo=false;render();};
$('calendarButton').onclick=()=>showView('reminders');
$('openReminder').onclick=()=>showView('reminders');
$('startRestore').onclick=()=>{showView('settings');$('backupFile').click();};
$('exportButton').onclick=()=>{if(storageReadFailed){try{download(localStorage.getItem(KEY)||'','application/json',`账单有数-原始数据-${dateKey()}.json`);toast('已导出原始数据，请交由维护者恢复。');}catch{toast('无法读取浏览器存储，请检查浏览器权限。');}return;}download(JSON.stringify({format:'card-ledger',version:1,exportedAt:new Date().toISOString(),bills},null,2),'application/json',`账单有数-备份-${dateKey()}.json`);toast('已导出真实账单备份。备份含账单信息，请妥善保存。');};
$('restoreButton').onclick=()=>$('backupFile').click();
$('backupFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5*1024*1024)throw Error('备份超过 5MB，无法导入。');const data=JSON.parse(await f.text());if(data.format!=='card-ledger'||data.version!==1||!Array.isArray(data.bills)||data.bills.length>10000||!data.bills.every(validateBill))throw Error('备份格式无效，未修改现有数据。');const map=new Map(bills.map(b=>[duplicateKey(b),b]));const conflicts=data.bills.filter(b=>map.has(duplicateKey(b))).length;if(!await ask(`将合并 ${data.bills.length} 份账单。同卡同月的 ${conflicts} 份记录保留本机版本。继续恢复？`))return;for(const b of data.bills)if(!map.has(duplicateKey(b)))map.set(duplicateKey(b),{...b,id:newId()});if(persist([...map.values()])){demo=false;render();toast('备份已合并恢复。');}}catch(error){toast(error.message||'备份读取失败。');}finally{e.target.value='';}};
$('clearButton').onclick=async()=>{if(bills.length===0)return toast('本机没有真实账单。');if(await ask(`清空本机 ${bills.length} 份真实账单？建议先导出备份。此操作无法撤销。`)&&persist([])){render();toast('本机真实账单已清空。');}};
$('latestButton').onclick=()=>setMode(true);$('periodButton').onclick=()=>setMode(false);
reminderUI=setupReminders({getBills:source,download,toast,esc,isDemo:()=>demo});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./reminder-sw.js',{scope:'./'}).catch(()=>{});
render();

let lastRenderedDay=dateKey();
function refreshOverdueDays(){const today=dateKey();if(today!==lastRenderedDay){lastRenderedDay=today;render();}}
setInterval(refreshOverdueDays,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshOverdueDays();});

// Keep other open pages from displaying and overwriting stale payment marks.
window.addEventListener('storage',event=>{
 if(event.storageArea!==localStorage||event.key!==KEY)return;
 try{const next=JSON.parse(event.newValue||'[]');if(!Array.isArray(next)||!next.every(validateBill))throw Error();bills=next.map(normalizePayment);storageReadFailed=false;render();if(paymentBillId&&$('paymentDialog').open)openPayments(paymentBillId);}
 catch{storageReadFailed=true;toast('其他页面的账单数据异常，已暂停写入以保护已保存记录。');}
});
