import {BANKS} from './core.js';
import {mergeMailBills, syncIsStale} from './mail-sync-core.js';
const CONFIG_KEY = 'bill-reminder-family-mail-sync-v1';
const DEFAULT_URL = 'https://pzp661123-d7gx1k86t018385da-1507505704.ap-shanghai.app.tcloudbase.com/personal-sync/family';
const HOST = 'pzp661123-d7gx1k86t018385da-1507505704.ap-shanghai.app.tcloudbase.com';

export function setupAutoSync({getSavedBills, saveBills, toast, esc, isDemo, onStatus}) {
  const panel = document.createElement('div'); panel.className = 'setting-card';
  panel.innerHTML = `<h2>每期账单自动读取</h2><p>后台启用后每天检查你本人已授权的 QQ 邮箱，收到新一期账单后保存。打开网页时自动取回新账单；同卡同一期的已还标记和逐笔还款记录会保留。</p><p id="mailSyncState" role="status">尚未连接自动读取服务。</p><form id="mailSyncForm"><label class="field">家人版服务地址<input id="mailSyncUrl" type="url" required value="${DEFAULT_URL}" autocomplete="off"></label><label class="field">我的专属连接码<input id="mailSyncToken" type="password" minlength="32" maxlength="256" required autocomplete="off" placeholder="填写后台生成的我的专属连接码"></label><p class="hint">连接码会保存在当前浏览器，用于读取你云端的账单。邮箱授权码由邮箱本人填入私密同步设置，请不要填写在这里，也不要使用其他人的连接码。此功能不会上传本机还款记录，换手机仍需恢复还款备份。</p><button class="primary" type="submit">连接自动读取</button></form><div class="form-row"><button type="button" class="secondary" id="mailSyncRefresh" hidden>刷新云端账单</button><button type="button" class="secondary" id="mailSyncDisconnect" hidden>断开此设备</button></div><div id="mailSyncReview"></div><p class="hint">读取失败、识别不完整或达到读取上限时，会在这里提示。网页同步不代表银行实时欠款，也不会替你还款。</p>`;
  document.getElementById('settings').prepend(panel);
  const $ = id => panel.querySelector('#'+id);
  let config, busy = false, lastPull = 0, stateText = '尚未连接邮箱自动读取';
  const state = text => { stateText = text; $('mailSyncState').textContent = text; onStatus(text); };
  function validateConfig(value) {
    if (!value || typeof value.url !== 'string' || typeof value.token !== 'string' || value.token.length < 32 || value.token.length > 256) throw Error('请填写完整的服务地址与我的专属连接码。');
    let url; try { url = new URL(value.url); } catch { throw Error('服务地址格式不正确，请复制完整的 HTTPS 地址。'); }
    if (url.protocol !== 'https:' || url.hostname !== HOST || url.pathname !== '/personal-sync/family' || url.username || url.password || url.search || url.hash) throw Error('请使用家人版专用服务地址，不要填写个人版或其他网站。');
    return {url: url.href, token: value.token};
  }
  function controls() { $('mailSyncForm').hidden = !!config; $('mailSyncRefresh').hidden = !config; $('mailSyncDisconnect').hidden = !config; }
  async function pull() {
    if (!config || busy || isDemo()) return;
    busy = true; $('mailSyncRefresh').disabled = true;
    state('正在检查云端是否有新一期账单…');
    const controller = new AbortController(); const timeout = setTimeout(()=>controller.abort(), 20000);
    try {
      const response = await fetch(config.url, {method: 'GET', headers: {Authorization: 'Bearer '+config.token}, cache: 'no-store', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal});
      if (!response.ok) throw Error(response.status === 401 ? '我的专属连接码不正确或已失效，请断开后重新连接。' : '自动读取后台暂时不可用，已保存的账单不受影响。');
      const raw = await response.text(); if (raw.length > 4*1024*1024) throw Error('返回数据过大，已暂停同步。');
      const data = JSON.parse(raw);
      if (data.format !== 'family-mail-sync' || data.version !== 1 || !Array.isArray(data.accounts) || data.accounts.length > 3 || data.accounts.some(account=>!account || typeof account.label !== 'string' || !Array.isArray(account.notes) || account.notes.length > 12 || !Array.isArray(account.review) || account.review.length > 100)) throw Error('后台返回格式不正确，未修改本机账单。');
      if (!data.enabled) throw Error('后台定时读取尚未启用，请完成后台配置。');
      const merged = mergeMailBills(getSavedBills(), data.bills);
      if (merged.added && !saveBills(merged.bills)) throw Error('本机保存失败，请检查存储权限后刷新。');
      const accounts = data.accounts;
      const stale = accounts.some(account=>syncIsStale(account.lastSuccessAt));
      const pending = [...accounts.flatMap(account=>Array.isArray(account.review)?account.review:[]), ...merged.conflicts];
      const problems = accounts.some(account=>account.error || account.incomplete);
      const successTimes = accounts.map(account=>account.lastSuccessAt).filter(value=>Number.isFinite(Date.parse(value))).sort();
      const last = successTimes.length ? new Date(successTimes[0]).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai', hour12:false}) : '尚未成功读取';
      state(`${merged.added ? '已新增 '+merged.added+' 份账单。' : '未发现可新增账单。'}${!accounts.length || stale || problems ? '部分邮箱需检查，不能确认账单已齐。' : '已取回后台读取结果。'} 最早邮箱成功检查：${last}`);
      const accountRows = accounts.map(account=>`<li>${esc(account.label || '邮箱')}：${esc(account.error || (syncIsStale(account.lastSuccessAt)?'超过两天未成功读取，请检查定时任务。':account.incomplete?'本次读取有遗漏，请核对邮箱。':'已读取'))}${(account.notes||[]).map(note=>`<p>${esc(note)}</p>`).join('')}</li>`).join('');
      const reviewRows = pending.slice(0,100).map(item=>`<li>${esc(BANKS.find(bank=>bank.id===item.bank)?.name || '银行待核对')} · ${esc(item.tail || '尾号待核对')} · ${esc(item.period || '账期待核对')}：${esc(item.reason || '请核对原邮件。')}</li>`).join('');
      $('mailSyncReview').innerHTML = `<details><summary>邮箱读取情况${pending.length ? ' · '+pending.length+' 项待核对' : ''}</summary><ul>${accountRows}</ul>${reviewRows ? '<h3>需要核对的邮件</h3><ul>'+reviewRows+'</ul>' : ''}</details>`;
      lastPull = Date.now();
      if (merged.added) toast(`已自动新增 ${merged.added} 份账单，已有还款记录已保留。`);
    } catch (error) { state(error.name === 'AbortError' ? '连接超时，请稍后刷新；本机账单已保留。' : error instanceof SyntaxError ? '后台返回格式错误，本机账单已保留。' : error instanceof TypeError ? '无法连接自动读取后台，请检查网络和服务配置；本机账单已保留。' : error.message || '无法读取后台，本机账单已保留。'); }
    finally { clearTimeout(timeout); busy = false; $('mailSyncRefresh').disabled = false; }
  }
  try { const raw = localStorage.getItem(CONFIG_KEY); if (raw) config = validateConfig(JSON.parse(raw)); }
  catch { state('连接设置无法读取，请重新连接；本机账单不受影响。'); }
  $('mailSyncForm').onsubmit = event => {
    event.preventDefault();
    try { const next = validateConfig({url:$('mailSyncUrl').value.trim(), token:$('mailSyncToken').value.trim()}); localStorage.setItem(CONFIG_KEY, JSON.stringify(next)); config=next; $('mailSyncToken').value=''; controls(); void pull(); }
    catch(error) { state(error.message); }
  };
  $('mailSyncRefresh').onclick = () => void pull();
  $('mailSyncDisconnect').onclick = () => { if (busy) return; try {localStorage.removeItem(CONFIG_KEY); config=undefined; controls(); $('mailSyncReview').textContent=''; state('此设备已断开，后台仍会按计划检查邮箱；停止后台读取需要在腾讯云关闭任务。');}catch{state('断开失败，请检查浏览器存储权限。');} };
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && Date.now()-lastPull>30*60000) void pull();});
  setInterval(()=>{if(!document.hidden && Date.now()-lastPull>30*60000)void pull();}, 30*60000);
  controls();
  if(config) void pull();
  return {getStatus:()=>stateText};
}
