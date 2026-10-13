import test from 'node:test';
import assert from 'node:assert/strict';

test('页面交互：输入、复制、周期刷新、参数导入、清空和异步过期结果', async () => {
  class Element {
    constructor(value = '') { this.value = value; this.textContent = ''; this.hidden = false; this.disabled = false; this.attributes = new Map(); this.listeners = new Map(); this.type = 'password'; this.className = ''; }
    classList = { add: () => {}, remove: () => {}, toggle: () => {} };
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    focus() {}
    dispatch(name) { return this.listeners.get(name)?.(); }
  }
  const ids = ['secret', 'code', 'error', 'algorithm', 'digits', 'period', 'notice', 'copy', 'copy-label', 'progress', 'countdown', 'status', 'account', 'clear', 'reveal', 'demo'];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  elements.algorithm.value = 'SHA1'; elements.digits.value = '6'; elements.period.value = '30';
  const documentEvents = new Map(), windowEvents = new Map();
  globalThis.document = { getElementById: (id) => elements[id], addEventListener: (name, fn) => documentEvents.set(name, fn), hidden: false };
  globalThis.window = { addEventListener: (name, fn) => windowEvents.set(name, fn), location: { reload() {} } };
  let clipboard = '', tick, now = 59000;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async (value) => { clipboard = value; } } } });
  const realInterval = globalThis.setInterval, realClearInterval = globalThis.clearInterval, realNow = Date.now;
  globalThis.setInterval = (fn) => { tick = fn; return 1; };
  globalThis.clearInterval = () => {};
  Date.now = () => now;
  const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
  try {
    await import('../app.js');
    elements.secret.value = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    elements.secret.dispatch('input'); await settle();
    assert.equal(elements.code.textContent, '287 082');
    assert.equal(elements.copy.disabled, false);
    await elements.copy.dispatch('click');
    assert.equal(clipboard, '287082');
    now = 60000;
    await tick();
    assert.notEqual(elements.code.textContent, '287 082');
    assert.equal(elements.countdown.textContent, '30 秒后刷新');
    now = 59000;
    elements.secret.value = 'otpauth://totp/Example%3Auser?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&digits=8&period=30';
    elements.secret.dispatch('input'); await settle();
    assert.equal(elements.digits.value, '8');
    assert.equal(elements.code.textContent, '9428 7082');
    assert.equal(elements.account.textContent, 'Example:user');
    elements.reveal.dispatch('click');
    assert.equal(elements.secret.type, 'text');
    elements.clear.dispatch('click');
    assert.equal(elements.secret.value, '');
    assert.equal(elements.secret.type, 'password');
    assert.equal(elements.copy.disabled, true);
    assert.equal(elements.code.textContent, '••• •••');
    // A pending import must not put an old valid code back after invalid input.
    elements.secret.value = 'JBSWY3DPEHPK3PXP'; elements.secret.dispatch('input');
    elements.secret.value = 'INVALID!'; elements.secret.dispatch('input'); await settle();
    assert.equal(elements.error.hidden, false);
    assert.equal(elements.copy.disabled, true);
    assert.equal(elements.code.textContent, '••• •••');
    elements.secret.value = 'otpauth://hotp/a?secret=MY'; elements.secret.dispatch('input'); await settle();
    assert.match(elements.error.textContent, /HOTP/);
    elements.demo.dispatch('click'); await settle();
    assert.equal(elements.error.hidden, true);
    assert.equal(elements.copy.disabled, false);
    assert.match(elements.notice.textContent, /公开演示密钥/);
    windowEvents.get('pagehide')();
    assert.equal(elements.secret.value, '');
    assert.equal(elements.copy.disabled, true);
  } finally {
    Date.now = realNow; globalThis.setInterval = realInterval; globalThis.clearInterval = realClearInterval;
    delete globalThis.document; delete globalThis.window;
  }
});
