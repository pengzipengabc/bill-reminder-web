export const BANKS = [
 {id:'huaxia',name:'华夏银行',short:'华',color:'#a54d43',aliases:['华夏银行','华夏信用卡']},
 {id:'everbright',name:'光大银行',short:'光',color:'#85669b',aliases:['光大银行','光大信用卡']},
 {id:'ccb',name:'建设银行',short:'建',color:'#426d99',aliases:['建设银行','建行','龙卡信用卡']},
 {id:'cmb',name:'招商银行',short:'招',color:'#a84b48',aliases:['招商银行','招商信用卡','招行']},
 {id:'abc',name:'农业银行',short:'农',color:'#548572',aliases:['农业银行','农行','金穗信用卡']},
 {id:'icbc',name:'工商银行',short:'工',color:'#a75b53',aliases:['工商银行','工行','牡丹信用卡']},
 {id:'citic',name:'中信银行',short:'信',color:'#9d5154',aliases:['中信银行','中信信用卡']},
 {id:'bocom',name:'交通银行',short:'交',color:'#536c95',aliases:['交通银行','交行','买单吧','太平洋信用卡']},
 {id:'cmbc',name:'民生银行',short:'民',color:'#5b8185',aliases:['民生银行','民生信用卡']}
];
export function dateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function validDate(s) { if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d=new Date(s+'T12:00:00'); return Number.isFinite(+d)&&dateKey(d)===s; }
export function validMonth(s){return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);}
export function daysUntil(s,today=dateKey()){return Math.round((Date.parse(s+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);}
export function amountToCents(s){const v=String(s).replace(/,/g,'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(v))return null;const n=Math.round(Number(v)*100);return Number.isSafeInteger(n)&&n<=9999999900?n:null;}
export function validateBill(b){return b&&typeof b==='object'&&typeof b.id==='string'&&/^[\w-]{1,80}$/.test(b.id)&&BANKS.some(x=>x.id===b.bank)&&/^\d{4}$/.test(b.tail)&&validMonth(b.period)&&Number.isSafeInteger(b.amount)&&b.amount>=0&&b.amount<=9999999900&&(b.minimum===null||(Number.isSafeInteger(b.minimum)&&b.minimum>=0&&b.minimum<=b.amount))&&validDate(b.due)&&typeof b.paid==='boolean'&&typeof b.note==='string'&&b.note.length<=120;}
export function duplicateKey(b){return `${b.bank}|${b.tail}|${b.period}`;}
export function latestBills(bills){const map=new Map();for(const b of bills){const key=`${b.bank}|${b.tail}`;const old=map.get(key);if(!old||b.period>old.period||(b.period===old.period&&(b.statementDate||'')>(old.statementDate||'')))map.set(key,b);}return [...map.values()];}
function normalizeDate(s){const m=s.match(/(\d{4})\s*[年/.-]\s*(\d{1,2})\s*[月/.-]\s*(\d{1,2})\s*日?/);if(!m)return '';const r=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;return validDate(r)?r:'';}
export function parseStatement(raw){
 const text=String(raw).normalize('NFKC').replace(/\u00a0/g,' ');
 const found=BANKS.filter(b=>b.aliases.some(x=>text.includes(x)));const bank=found.length===1?found[0].id:'';
 const multi=/美元|美金|港币|港元|日元|欧元|USD|HKD|EUR|JPY|\$/i.test(text);
 const warnings=[]; if(found.length>1)warnings.push('出现多家银行，请选择这份账单所属银行。');
 if(multi)warnings.push('包含外币内容，金额未自动填入；请只填写人民币账单，勿将不同币种相加。');
 function value(labels){const candidates=[];for(const label of labels){const re=new RegExp(label+'[ \\t]*(?:[（(][^\\n)）]{0,16}[)）])?[ \\t]*[:：]?[ \\t\\r\\n]*(?:人民币|RMB|CNY|¥|￥)?[ \\t]*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)(?![0-9.])','gi');for(const m of text.matchAll(re)){const n=amountToCents(m[1]);if(n!==null)candidates.push(n);}}const unique=[...new Set(candidates)];return unique.length===1?(unique[0]/100).toFixed(2):'';}
 const amount=multi?'':value(['本期应还(?:款)?(?:总)?金额','本期应还款额','本期账单金额','本期应还总额','本期应还款','应还款总额','账单应还金额','本期账单应还款']);
 const minimum=multi?'':value(['本期最低还款额','最低还款(?:金额|额)']);
 const tails=[...text.matchAll(/(?:卡号|尾号|账户)[^\n\d]{0,12}(?:[\d*Xx•· -]{0,24}[*Xx•· -])?(\d{4})(?!\d)/g)].map(m=>m[1]);
 const tail=[...new Set(tails)].length===1?tails[0]:'';
 const dueMatches=[];for(const m of text.matchAll(/(?:最后还款日|到期还款日|本期还款日|还款截止日|还款日期|还款日)[ \t:：]*(\d{4}\s*[年/.-]\s*\d{1,2}\s*[月/.-]\s*\d{1,2}\s*日?)/g)){const d=normalizeDate(m[1]);if(d)dueMatches.push(d);}
 const due=[...new Set(dueMatches)].length===1?dueMatches[0]:'';
 const periodMatches=[...text.matchAll(/(?:账单月份|账单月|账单日)[ \t:：]*(\d{4})[年/.-](\d{1,2})/g)].map(m=>`${m[1]}-${m[2].padStart(2,'0')}`).filter(validMonth);
 const period=[...new Set(periodMatches)].length===1?periodMatches[0]:'';
 if(!amount)warnings.push('应还金额未可靠识别，请根据原文填写。');
 if(!due)warnings.push('还款日未可靠识别，请填写含年份的完整日期。');
 if(!tail)warnings.push('卡号尾号未可靠识别，请填写后四位。');
 if(!period)warnings.push('请核对账单所属月份，不要直接用还款日月份代替。');
 return {bank,tail,amount,minimum,due,period,warnings};
}
function icsEscape(s){return String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
function foldLine(s){const lines=[];let line='',size=0;for(const ch of s){const n=new TextEncoder().encode(ch).length;if(size+n>73){lines.push(line);line=' ';size=1;}line+=ch;size+=n;}lines.push(line);return lines.join('\r\n');}
export function makeCalendar(bills,now=new Date()){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ZhangDanYouShu//Bills//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 for(const b of bills.filter(x=>!x.paid&&validateBill(x))){const bank=BANKS.find(x=>x.id===b.bank);const d=new Date(b.due+'T12:00:00');d.setDate(d.getDate()+1);const desc=`账单有数手动记录；请向银行确认实际欠款和到账。人民币 ${(b.amount/100).toFixed(2)} 元，卡尾号 ${b.tail}。`;
 lines.push('BEGIN:VEVENT',`UID:${b.id}@zhangdanyoushu.local`,`DTSTAMP:${now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;VALUE=DATE:${b.due.replaceAll('-','')}`,`DTEND;VALUE=DATE:${dateKey(d).replaceAll('-','')}`,`SUMMARY:${icsEscape(bank.name+'信用卡还款 · 尾号'+b.tail)}`,`DESCRIPTION:${icsEscape(desc)}`,'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${icsEscape(bank.name+'信用卡明日到期，请核对账单')}`,'TRIGGER:-P1D','END:VALARM','END:VEVENT');}
 lines.push('END:VCALENDAR');return lines.map(foldLine).join('\r\n')+'\r\n';
}
