import {BANKS,validateBill,latestBills,paidAmount,remainingAmount} from './core.js';
export function chinaDay(now=new Date()){return new Date(+now+8*3600000).toISOString().slice(0,10);}
export function reminderPlan(bills,{now=new Date(),offsets=[3,1,0],hour=9}={}){
 if(!Number.isFinite(+now)||!Number.isInteger(hour)||hour<0||hour>23||!offsets.length||offsets.some(x=>![0,1,3].includes(x)))throw Error('请至少选择一个提醒时间。');
 const today=chinaDay(now),jobs=[];
 for(const b of latestBills(bills.filter(validateBill))){
  if(b.paid||b.amount===0||b.due<today)continue;
  for(const offset of new Set(offsets)){
   const day=new Date(Date.parse(b.due+'T00:00:00Z')-offset*86400000).toISOString().slice(0,10);
   let at=Date.parse(day+`T${String(hour).padStart(2,'0')}:00:00+08:00`),catchUp=false;
   // Keep a reminder for today's unpaid bill when the chosen hour has passed.
   if(offset===0&&day===today&&at<=+now){at=Date.parse(day+'T18:00:00+08:00');catchUp=true;}
   if(at<=+now)continue;
   jobs.push({id:`${b.id}-${offset}`,at,offset,catchUp,bill:b});
  }
 }
 return jobs.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
}
export function reminderText(job){const b=job.bill,bank=BANKS.find(x=>x.id===b.bank).name;return {title:`${bank} 尾号${b.tail} · ${job.offset===0?'今天还款':job.offset+'天后还款'}`,body:`账单 ¥${(b.amount/100).toFixed(2)}；累计已还 ¥${(paidAmount(b)/100).toFixed(2)}；剩余应还 ¥${(remainingAmount(b)/100).toFixed(2)}；原账单最低 ${b.minimum===null?'待核对':'¥'+(b.minimum/100).toFixed(2)}；还款日 ${b.due}。已还请忽略并标记。`};}
const stamp=n=>new Date(n).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const escape=s=>String(s).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(s){const lines=[];let line='',size=0;for(const ch of s){const n=new TextEncoder().encode(ch).length;if(size+n>75){lines.push(line);line=' ';size=1;}line+=ch;size+=n;}lines.push(line);return lines.join('\r\n');}
export function reminderCalendar(jobs,now=new Date()){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Bill Reminders//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:账单有数还款提醒'];
 for(const j of jobs){const t=reminderText(j),b=j.bill;lines.push('BEGIN:VEVENT',`UID:${j.id}@card-ledger.local`,`DTSTAMP:${stamp(now)}`,`DTSTART:${stamp(j.at)}`,`DTEND:${stamp(j.at+300000)}`,`SUMMARY:${escape(t.title)}`,`DESCRIPTION:${escape(t.body+'\n账期 '+b.period+'。仅为已导入账单安排，不自动更新新账单。还款状态未由银行确认；已还后请自行删除剩余日历事件。')}`,'TRANSP:TRANSPARENT','BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${escape(t.body)}`,'TRIGGER:PT0S','END:VALARM','END:VEVENT');}
 lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
