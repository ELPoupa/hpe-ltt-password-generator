export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTUVWXY';
export const SUPPORT_FLAGS = 0x207;
const XOR = 0xdeadbeef;
const DAY = 86400000;
const EPOCHS = [Date.UTC(2000, 0, 1), Date.UTC(2022, 0, 1)];

export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError('Enter a date in YYYY-MM-DD format.');
  const [year, month, day] = value.split('-').map(Number);
  const time = Date.UTC(year, month - 1, day);
  if (new Date(time).toISOString().slice(0, 10) !== value) throw new RangeError('Enter a valid date.');
  return time;
}

export function addDays(value, days) {
  return new Date(parseDate(value) + days * DAY).toISOString().slice(0, 10);
}

function integer(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer from ${min} to ${max}.`);
  }
}

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte << 24;
    for (let bit = 0; bit < 8; bit++) {
      crc = ((crc << 1) ^ (crc & 0x80000000 ? 0x04c11db7 : 0)) >>> 0;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function checksum(flags, day, duration, epoch, extra) {
  const fields = [(epoch << 5) | (day >>> 8), day & 255,
    (flags >>> 16) & 255, (flags >>> 8) & 255, flags & 255, duration];
  if (extra !== null) fields.push(extra);
  const bytes = new Uint8Array(fields.length * 100);
  for (let i = 0; i < 100; i++) bytes.set(fields, i * fields.length);
  return crc32(bytes);
}

function encodeWord(word) {
  word = (word ^ XOR) >>> 0;
  let result = '';
  for (let shift = 30; shift >= 0; shift -= 5) result += ALPHABET[(word >>> shift) & 31];
  return result;
}

function decodeWord(text) {
  let value = 0;
  for (const char of text) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) throw new RangeError(`Invalid code character: ${char}`);
    value = ((value << 5) | digit) >>> 0;
  }
  return (value ^ XOR) >>> 0;
}

export function generate(start, duration = 20, flags = SUPPORT_FLAGS, epoch = null, extra = null) {
  const time = parseDate(start);
  epoch ??= time >= EPOCHS[1] ? 1 : 0;
  integer(epoch, 0, 1, 'Epoch');
  integer(duration, 0, 255, 'Duration');
  integer(flags, 0, 0xffffff, 'Permissions');
  if (extra !== null) integer(extra, 0, 255, 'Extra field');
  const day = (time - EPOCHS[epoch]) / DAY;
  integer(day, 0, 0x1fff, 'Day offset');
  const crc = checksum(flags, day, duration, epoch, extra);
  const first = (epoch << 29) | (day << 16) | ((crc >>> 16) & 0xff00) | (crc & 255);
  const last = (flags << 8) | duration;
  const middle = extra === null ? '' : encodeWord(((crc & 0xffff00) << 8) | extra);
  return encodeWord(first) + middle + encodeWord(last);
}

export function decode(input, on = localToday()) {
  const code = input.trim().toUpperCase();
  if (![14, 21].includes(code.length)) throw new RangeError('A code must contain 14 or 21 characters.');
  const first = decodeWord(code.slice(0, 7));
  const last = decodeWord(code.slice(-7));
  const epoch = first >>> 29;
  integer(epoch, 0, 1, 'Epoch');
  const day = (first >>> 16) & 0x1fff;
  const flags = last >>> 8;
  const duration = last & 255;
  let extra = null;
  let stored = first & 0xffff;
  if (code.length === 21) {
    const middle = decodeWord(code.slice(7, 14));
    extra = middle & 255;
    stored = (((first & 0xff00) << 16) | ((middle >>> 8) & 0xffff00) | (first & 255)) >>> 0;
  }
  let calculated = checksum(flags, day, duration, epoch, extra);
  if (code.length === 14) calculated = ((calculated >>> 16) & 0xff00) | (calculated & 255);
  const start = EPOCHS[epoch] + day * DAY;
  const end = duration ? start + duration * DAY : null;
  const today = parseDate(on);
  const checksumValid = calculated === stored;
  return {
    code, epoch, day, flags, duration, extra,
    start_date: new Date(start).toISOString().slice(0, 10),
    last_valid_date: end === null ? null : new Date(end).toISOString().slice(0, 10),
    checksum_valid: checksumValid,
    valid_on_date: checksumValid && today >= start && (end === null || today <= end),
  };
}

export const LAST_START_DATE = new Date(EPOCHS[1] + 0x1fff * DAY).toISOString().slice(0, 10);
