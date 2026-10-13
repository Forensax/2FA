const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const algorithms = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' };

export function decodeBase32(input) {
  const secret = input.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z2-7]+=*$/.test(secret)) throw new Error('密钥应为 Base32 格式，只能包含 A–Z、2–7 和末尾的 =。');
  const raw = secret.replace(/=+$/, '');
  const remainder = raw.length % 8;
  if (![0, 2, 4, 5, 7].includes(remainder)) throw new Error('密钥长度不完整，请检查是否漏复制了字符。');
  const padding = secret.length - raw.length;
  if (padding && (secret.length % 8 !== 0 || padding !== (8 - remainder) % 8)) throw new Error('密钥末尾的 Base32 填充无效。');
  let value = 0, bits = 0;
  const bytes = [];
  for (const char of raw) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
      value &= (1 << bits) - 1;
    }
  }
  if (value !== 0) throw new Error('密钥的 Base32 编码无效，请重新复制完整密钥。');
  return new Uint8Array(bytes);
}

export function validateOptions({ algorithm = 'SHA1', digits = 6, period = 30 } = {}) {
  algorithm = String(algorithm).toUpperCase().replace(/-/g, '');
  if (!Object.hasOwn(algorithms, algorithm)) throw new Error('只支持 SHA-1、SHA-256 或 SHA-512。');
  digits = Number(digits);
  period = Number(period);
  if (![6, 8].includes(digits)) throw new Error('只支持 6 位或 8 位验证码。');
  if (!Number.isInteger(period) || period < 1 || period > 300) throw new Error('刷新周期必须是 1–300 秒的整数。');
  return { algorithm, digits, period };
}

export function parseInput(input, defaults = {}) {
  const text = input.trim();
  if (!text) throw new Error('请输入 2FA 密钥或 otpauth:// 链接。');
  if (text.length > 4096) throw new Error('输入内容过长，请检查是否为 2FA 密钥。');
  let secret = text, label = '', issuer = '', options = defaults;
  const isUri = /^otpauth:/i.test(text);
  if (isUri) {
    let url;
    try { url = new URL(text); } catch { throw new Error('otpauth 链接格式无效。'); }
    if (url.protocol !== 'otpauth:' || url.hostname !== 'totp' || url.username || url.password || url.port || url.hash) throw new Error('只支持 otpauth://totp/ 链接，不支持 HOTP 计数器令牌。');
    for (const name of ['secret', 'algorithm', 'digits', 'period', 'issuer']) {
      if (url.searchParams.getAll(name).length > 1) throw new Error('链接中存在重复参数，请检查令牌来源。');
    }
    secret = url.searchParams.get('secret') ?? '';
    if (!secret) throw new Error('otpauth 链接缺少 secret 密钥参数。');
    try { label = decodeURIComponent(url.pathname.slice(1)); } catch { throw new Error('链接中的账号名称编码无效。'); }
    issuer = url.searchParams.get('issuer') ?? '';
    options = {
      algorithm: url.searchParams.get('algorithm') ?? 'SHA1',
      digits: url.searchParams.get('digits') ?? 6,
      period: url.searchParams.get('period') ?? 30,
    };
  }
  return { bytes: decodeBase32(secret), label, issuer, isUri, ...validateOptions(options) };
}

export async function importKey(bytes, algorithm = 'SHA1') {
  if (!globalThis.crypto?.subtle) throw new Error('浏览器无法使用安全加密功能，请通过 HTTPS 访问并使用现代浏览器。');
  const options = validateOptions({ algorithm });
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: algorithms[options.algorithm] }, false, ['sign']);
}

export async function generateCode(key, { timestamp = Date.now() / 1000, digits = 6, period = 30 } = {}) {
  validateOptions({ digits, period });
  if (!Number.isFinite(timestamp) || timestamp < 0) throw new Error('设备时间无效，请检查系统时间。');
  const counter = BigInt(Math.floor(timestamp / period));
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigUint64(0, counter, false);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, buffer));
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % (10 ** digits)).padStart(digits, '0');
}
