import {reminderPlan,reminderCalendar,reminderText,chinaDay} from './reminder-core.js';
import {BANKS,latestBills} from './core.js';
export function setupReminders({getBills,download,toast,esc,isDemo}){
 const $=id=>document.getElementById(id),key='bill-reminder-family-settings-v1';
 let settings={offsets:[3,1,0],hour:9,lastExport:null,confirmed:false,confirmedSignature:null,webEnabled:false},sent=new Set(),registration=null,storageOK=true;
 try{const s=JSON.parse(localStorage.getItem(key)||'null');if(s&&Array.isArray(s.offsets)&&s.offsets.length&&s.offsets.every(x=>[3,1,0].includes(x))&&Number.isInteger(s.hour)&&s.hour>=0&&s.hour<=23)settings={...settings,...s};}catch{storageOK=false;toast('提醒设置读取失败，本次使用默认设置，不会覆盖原设置。');}
 const save=()=>{if(!storageOK){toast('提醒设置无法保存，请先检查浏览器存储。');return;}try{localStorage.setItem(key,JSON.stringify(settings));}catch{toast('提醒设置未能保存，请检查浏览器存储。');}};
 const signature=()=>JSON.stringify({bills:latestBills(getBills()).map(b=>[b.id,b.period,b.due,b.amount,b.minimum,b.paid,b.payments??null]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),offsets:settings.offsets,hour:settings.hour});
 const jobs=()=>reminderPlan(getBills(),settings);
 function render(){
  const list=latestBills(getBills()).filter(b=>!b.paid&&b.amount>0&&b.due>=chinaDay()).sort((a,b)=>a.due.localeCompare(b.due));
  $('reminderCount').textContent=list.length+' 个账户';
  $('reminderMode').textContent=isDemo()?'示例提醒 · 不会发送通知':'仅保存在本机 · 每期账单需更新';
  const plan=jobs();$('reminderEventCount').textContent=`可安排 ${plan.length} 次提醒 · 北京时间`;
  $('reminderHour').value=String(settings.hour);document.querySelectorAll('[data-reminder-offset]').forEach(el=>el.checked=settings.offsets.includes(Number(el.dataset.reminderOffset)));
  $('reminderStatus').textContent=settings.confirmed&&settings.confirmedSignature===signature()?'你已确认导入日历；请以手机日历中实际事件和通知设置为准。':settings.lastExport?'文件已生成；尚未确认手机日历导入。账单或设置变化后需重新导入。':'尚未设置手机日历提醒。生成文件后，还需导入日历并确认通知。';
  $('calendarConfirmed').checked=!!settings.confirmed&&settings.confirmedSignature===signature();
  $('calendarConfirmed').disabled=!settings.lastExport||settings.lastExport.signature!==signature();
  $('reminderExport').disabled=!plan.length;
  $('reminderList').innerHTML=list.length?list.map(b=>{const bank=BANKS.find(x=>x.id===b.bank);return `<article class="reminder-item"><div><b>${esc(bank.name)} <small>尾号 ${esc(b.tail)}</small></b><span>${b.due} 还款 · ${b.period} 账期</span></div><div class="reminder-money"><strong>¥${(b.amount/100).toFixed(2)}</strong><span>最低 ${b.minimum===null?'待核对':'¥'+(b.minimum/100).toFixed(2)}</span></div></article>`;}).join(''):'<p class="hint">没有今天或以后到期、未标记已还的账单。可在账单页导入或更新。</p>';
  $('reminderSchedule').innerHTML=plan.slice(0,12).map(j=>`<li><time>${new Date(j.at+8*3600000).toISOString().slice(0,16).replace('T',' ')}</time><span>${esc(reminderText(j).title)}${j.catchUp?'（补充提醒）':''}</span></li>`).join('');
  const supported='Notification'in window&&'serviceWorker'in navigator&&window.isSecureContext;
  $('enableWebReminder').disabled=!supported||isDemo();$('testWebReminder').disabled=!supported||Notification.permission!=='granted'||isDemo();
  $('webReminderStatus').textContent=!supported?'当前浏览器不支持网页通知，请使用日历提醒。':Notification.permission==='denied'?'通知权限被关闭；请在浏览器或手机设置中调整。':settings.webEnabled&&Notification.permission==='granted'?'当前网页通知已开启，仅在网页运行时检查提醒。关闭网页后不检查。':'网页通知尚未开启。苹果手机请先添加到主屏幕，再从主屏幕进入。';
 }
 async function reg(){if(!registration)registration=await navigator.serviceWorker.register('./reminder-sw.js',{scope:'./'});await navigator.serviceWorker.ready;return registration;}
 $('saveReminderSettings').onclick=()=>{const offsets=[...document.querySelectorAll('[data-reminder-offset]:checked')].map(e=>Number(e.dataset.reminderOffset));if(!offsets.length)return toast('请至少选择一个提醒日期。');settings={...settings,offsets,hour:Number($('reminderHour').value),confirmed:false};save();render();toast('提醒偏好已保存；手机日历需重新生成并导入。');};
 $('reminderExport').onclick=()=>{const plan=jobs();if(!plan.length)return toast('当前没有可安排的提醒。');download(reminderCalendar(plan),'text/calendar;charset=utf-8',`账单还款提醒-${chinaDay()}${isDemo()?'-示例':''}.ics`);settings.lastExport={at:new Date().toISOString(),signature:signature()};settings.confirmed=false;save();render();toast('文件已生成。请在手机日历导入，再勾选确认。');};
 $('calendarConfirmed').onchange=e=>{settings.confirmed=e.target.checked;settings.confirmedSignature=e.target.checked?signature():null;save();render();};
 $('enableWebReminder').onclick=async()=>{try{const permission=await Notification.requestPermission();if(permission!=='granted'){render();return toast('尚未取得通知权限，可继续使用日历提醒。');}await reg();settings.webEnabled=true;save();render();toast('已开启网页运行时的通知，请点击测试。');}catch{toast('通知启用失败，请使用手机日历提醒。');render();}};
 $('testWebReminder').onclick=async()=>{try{const r=await reg();await r.showNotification('账单有数 · 测试提醒',{body:'这是一条测试通知，不代表已有还款提醒生效。关闭网页后的定时提醒请使用手机日历。',tag:'card-ledger-test',data:{url:'./'}});toast('测试通知已提交给浏览器，请检查手机通知。');}catch{toast('测试通知失败，请检查通知权限或使用手机日历。');}};
 async function check(){if(!settings.webEnabled||isDemo()||!('Notification'in window)||Notification.permission!=='granted')return;
  const now=new Date();
  // A short look-back tolerates timer delays without notifying on old bills.
  const dayStart=new Date(chinaDay(now)+'T00:00:00+08:00');
  const due=reminderPlan(getBills(),{...settings,now:dayStart}).filter(j=>j.at<=+now&&j.at>+now-300000);
  for(const j of due){const marker=j.id+'-'+j.at;if(sent.has(marker))continue;try{if(localStorage.getItem(key+'-sent-'+marker))continue;const r=await reg();const t=reminderText(j);await r.showNotification(t.title,{body:t.body,tag:j.id,data:{url:'./'}});sent.add(marker);localStorage.setItem(key+'-sent-'+marker,'1');}catch{/* A failed attempt can retry while the page remains active. */}}
 }
 setInterval(check,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();check();}});
 return {render};
}
