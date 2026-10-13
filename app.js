import { parseInput, importKey, generateCode, validateOptions } from './totp.js';

const $ = (id) => document.getElementById(id);
const secret = $('secret'), code = $('code'), error = $('error');
const algorithm = $('algorithm'), digits = $('digits'), period = $('period');
let active = null, generation = 0, currentCode = '', displayedStep = -1;
let feedbackTimer, noticeTimer;

function notice(message) {
  clearTimeout(noticeTimer);
  $('notice').textContent = message;
}

function resetOutput() {
  active = null;
  currentCode = '';
  displayedStep = -1;
  code.textContent = '••• •••';
  code.className = 'code';
  $('copy').disabled = true;
  $('copy-label').textContent = '复制验证码';
  clearTimeout(feedbackTimer);
  $('progress').value = 0;
  $('progress').classList.remove('urgent');
  $('countdown').textContent = '输入密钥后自动更新';
  $('status').textContent = '等待输入';
  $('status').classList.remove('active');
  $('account').hidden = true;
  $('account').textContent = '';
}

async function configure(fromInput = false) {
  const version = ++generation;
  resetOutput();
  error.hidden = true;
  error.textContent = '';
  secret.removeAttribute('aria-invalid');
  $('clear').disabled = !secret.value;
  if (!secret.value.trim()) {
    notice('验证码每 30 秒自动刷新');
    return;
  }
  try {
    const defaults = { algorithm: algorithm.value, digits: digits.value, period: period.value };
    const parsed = parseInput(secret.value, defaults);
    if (fromInput && parsed.isUri) {
      algorithm.value = parsed.algorithm;
      digits.value = String(parsed.digits);
      period.value = String(parsed.period);
    }
    const options = validateOptions({ algorithm: algorithm.value, digits: digits.value, period: period.value });
    const key = await importKey(parsed.bytes, options.algorithm);
    parsed.bytes.fill(0);
    if (version !== generation) return;
    active = { key, ...options };
    if (parsed.label || parsed.issuer) {
      $('account').textContent = [parsed.issuer, parsed.label].filter(Boolean).join(' · ');
      $('account').hidden = false;
    }
    notice(`验证码每 ${options.period} 秒自动刷新`);
    await update();
  } catch (err) {
    if (version !== generation) return;
    error.textContent = err.message;
    error.hidden = false;
    secret.setAttribute('aria-invalid', 'true');
    $('status').textContent = '请检查输入';
    notice('请检查密钥和参数后重试');
  }
}

async function update() {
  const state = active;
  if (!state) return;
  const version = generation;
  const now = Date.now() / 1000;
  const step = Math.floor(now / state.period);
  const remaining = state.period - (now % state.period);
  $('progress').max = state.period;
  $('progress').value = remaining;
  $('progress').classList.toggle('urgent', remaining <= 5);
  $('countdown').textContent = `${Math.ceil(remaining)} 秒后刷新`;
  if (step === displayedStep) return;
  $('copy').disabled = true;
  try {
    const value = await generateCode(state.key, { ...state, timestamp: now });
    if (version !== generation || state !== active) return;
    // The clock may cross a boundary while the HMAC promise is pending.
    if (Math.floor(Date.now() / 1000 / state.period) !== step) return update();
    displayedStep = step;
    currentCode = value;
    code.textContent = `${value.slice(0, value.length / 2)} ${value.slice(value.length / 2)}`;
    code.className = `code ready${state.digits === 8 ? ' eight' : ''}`;
    $('copy').disabled = false;
    $('status').textContent = '实时更新';
    $('status').classList.add('active');
  } catch {
    if (version !== generation) return;
    resetOutput();
    error.textContent = '验证码计算失败，请检查浏览器是否支持 Web Crypto。';
    error.hidden = false;
  }
}

secret.addEventListener('input', () => configure(true));
for (const field of [algorithm, digits, period]) field.addEventListener('input', () => configure());
$('reveal').addEventListener('click', () => {
  const show = secret.type === 'password';
  secret.type = show ? 'text' : 'password';
  $('reveal').textContent = show ? '隐藏' : '显示';
  $('reveal').setAttribute('aria-label', show ? '隐藏密钥' : '显示密钥');
  $('reveal').setAttribute('aria-pressed', String(show));
});
$('clear').addEventListener('click', () => {
  secret.value = '';
  secret.type = 'password';
  $('reveal').textContent = '显示';
  $('reveal').setAttribute('aria-label', '显示密钥');
  $('reveal').setAttribute('aria-pressed', 'false');
  algorithm.value = 'SHA1'; digits.value = '6'; period.value = '30';
  configure();
  secret.focus();
});
$('demo').addEventListener('click', () => {
  secret.value = 'JBSWY3DPEHPK3PXP';
  algorithm.value = 'SHA1'; digits.value = '6'; period.value = '30';
  configure(true).then(() => notice('当前为公开演示密钥，请勿绑定真实账号。'));
});
$('copy').addEventListener('click', async () => {
  const version = generation;
  await update();
  if (!currentCode || version !== generation || $('copy').disabled) return;
  try {
    await navigator.clipboard.writeText(currentCode);
    if (version !== generation) return;
    $('copy-label').textContent = '已复制';
    notice('验证码已复制到剪贴板');
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => { $('copy-label').textContent = '复制验证码'; }, 1800);
    noticeTimer = setTimeout(() => { if (active) notice(`验证码每 ${active.period} 秒自动刷新`); }, 2500);
  } catch {
    if (version !== generation) return;
    notice('无法访问剪贴板，请选择上方验证码手动复制。');
  }
});

const timer = setInterval(update, 200);
document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
window.addEventListener('focus', update);
// Never restore a real secret from the back-forward cache.
window.addEventListener('pagehide', () => {
  generation++;
  secret.value = '';
  resetOutput();
  clearInterval(timer);
  clearTimeout(feedbackTimer);
  clearTimeout(noticeTimer);
});
window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
