import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBase32, validateOptions, parseInput, importKey, generateCode } from '../totp.js';

const times = [59, 1111111109, 1111111111, 1234567890, 2000000000, 20000000000];
const vectors = {
  SHA1: ['94287082', '07081804', '14050471', '89005924', '69279037', '65353130'],
  SHA256: ['46119246', '68084774', '67062674', '91819424', '90698825', '77737706'],
  SHA512: ['90693936', '25091201', '99943326', '93441116', '38618901', '47863826'],
};
for (const [algorithm, length] of [['SHA1', 20], ['SHA256', 32], ['SHA512', 64]]) {
  test(`RFC 6238: ${algorithm} 的 6 个标准时间向量`, async () => {
    const bytes = new TextEncoder().encode('1234567890'.repeat(7).slice(0, length));
    const key = await importKey(bytes, algorithm);
    assert.equal(key.extractable, false);
    for (let i = 0; i < times.length; i++) {
      assert.equal(await generateCode(key, { timestamp: times[i], digits: 8 }), vectors[algorithm][i]);
    }
  });
}
test('6 位验证码、前导零与周期切换', async () => {
  const key = await importKey(new TextEncoder().encode('12345678901234567890'));
  assert.equal(await generateCode(key, { timestamp: 1111111109 }), '081804');
  assert.equal(await generateCode(key, { timestamp: 59 }), '287082');
  assert.equal(await generateCode(key, { timestamp: 29 }), await generateCode(key, { timestamp: 0 }));
  assert.notEqual(await generateCode(key, { timestamp: 30 }), await generateCode(key, { timestamp: 29 }));
  assert.equal(await generateCode(key, { timestamp: 59, period: 60 }), await generateCode(key, { timestamp: 29 }));
});
test('Base32 解码、空格、小写、分隔符和填充', () => {
  assert.equal(new TextDecoder().decode(decodeBase32('MZXW6YTBOI======')), 'foobar');
  assert.equal(new TextDecoder().decode(decodeBase32('mz xw-6ytboi')), 'foobar');
  assert.equal(new TextDecoder().decode(decodeBase32('MY======')), 'f');
  assert.equal(decodeBase32('JBSWY3DPEHPK3PXP').length, 10);
});
test('拒绝无效 Base32 字符、长度、填充和尾部位', () => {
  for (const value of ['', 'A', 'ABC', 'ABCDEF', 'MY=', 'MY=======', 'MZ======', 'M0======', '<script>', '=MY']) {
    assert.throws(() => decodeBase32(value), Error, value);
  }
});
test('导入 otpauth 链接和参数', () => {
  const parsed = parseInput('otpauth://totp/Example%3Auser%40mail.test?secret=JBSWY3DPEHPK3PXP&issuer=Example&algorithm=SHA256&digits=8&period=60');
  assert.equal(parsed.label, 'Example:user@mail.test');
  assert.equal(parsed.issuer, 'Example');
  assert.equal(parsed.algorithm, 'SHA256');
  assert.equal(parsed.digits, 8);
  assert.equal(parsed.period, 60);
  assert.equal(parsed.isUri, true);
  assert.equal(parseInput('otpauth://totp/a?secret=MY').period, 30);
  assert.equal(parseInput('MY', { period: 45 }).period, 45);
});
test('拒绝不支持和歧义的链接', () => {
  for (const value of [
    'otpauth://hotp/a?secret=MY&counter=0', 'otpauth://totp/a',
    'otpauth://totp/a?secret=MY&secret=MY', 'otpauth://totp/a?secret=MY&period=0',
    'otpauth://totp/a?secret=MY&digits=7', 'otpauth://totp/a?secret=MY&algorithm=MD5',
    'otpauth://totp/a?secret=MY#x', 'otpauth://user@totp/a?secret=MY',
    'otpauth://totp/%ZZ?secret=MY', 'https://example.test/?secret=MY',
  ]) assert.throws(() => parseInput(value), Error);
});
test('周期与位数严格校验', () => {
  for (const period of [0, -1, 1.5, 301, NaN, '']) assert.throws(() => validateOptions({ period }));
  assert.equal(validateOptions({ algorithm: 'SHA-512', digits: '8', period: '45' }).period, 45);
});
