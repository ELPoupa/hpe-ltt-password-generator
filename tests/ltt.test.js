import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generate, decode, crc32, localToday, addDays, LAST_START_DATE } from '../docs/ltt.js';

const samples = JSON.parse(readFileSync(new URL('./public-samples.json', import.meta.url)));

test('reproduce seven published HP support codes', () => {
  for (const sample of samples) {
    const result = decode(sample.code, sample.start_date);
    assert.equal(result.checksum_valid, true);
    assert.equal(result.valid_on_date, true);
    assert.equal(result.start_date, sample.start_date);
    assert.equal(result.flags, 0x207);
    assert.equal(generate(sample.start_date, result.duration, result.flags, result.epoch), sample.code);
  }
});

test('current-epoch reference codes', () => {
  assert.equal(generate('2026-09-25', 2), '3V6UF7U3FAYEFD');
  assert.equal(generate('2026-09-25', 20), '3V6UUEX3FAYEFU');
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xfc891918);
});

test('expiry is inclusive, future and damaged codes are rejected', () => {
  const code = generate('2026-09-25', 20);
  assert.equal(decode(code, '2026-09-24').valid_on_date, false);
  assert.equal(decode(code, '2026-10-15').valid_on_date, true);
  assert.equal(decode(code, '2026-10-16').valid_on_date, false);
  assert.equal(decode(code.toLowerCase(), '2026-09-25').valid_on_date, true);
  assert.equal(decode('3V6UUE03FAYEFU', '2026-09-25').checksum_valid, false);
});

test('dates and field ranges fail explicitly', () => {
  for (const date of ['2026-02-30', '2026-2-1', '1999-12-31', addDays(LAST_START_DATE, 1)]) {
    assert.throws(() => generate(date));
  }
  for (const days of [-1, 256, 1.5, NaN]) assert.throws(() => generate('2026-09-25', days));
  assert.throws(() => decode('not a support code'));
  assert.equal(decode(generate(LAST_START_DATE), LAST_START_DATE).valid_on_date, true);
});

test('calendar handling uses the local day and preserves leap days', () => {
  const time = { getFullYear: () => 2026, getMonth: () => 0, getDate: () => 2 };
  assert.equal(localToday(time), '2026-01-02');
  assert.equal(addDays('2024-02-28', 2), '2024-03-01');
  assert.equal(addDays('2026-12-25', 20), '2027-01-14');
});

test('JavaScript matches Python across dates, masks, durations and the extended format', () => {
  const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const cases = JSON.parse(execFileSync(python, [new URL('./crosscheck.py', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '')], { encoding: 'utf8' }));
  for (const { date, duration, flags, epoch, extra, code, decoded } of cases) {
    assert.equal(generate(date, duration, flags, epoch, extra), code);
    assert.deepEqual(decode(code, date), decoded);
  }
  assert.ok(cases.length >= 100);
});
