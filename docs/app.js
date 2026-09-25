import { generate, decode, localToday, LAST_START_DATE } from './ltt.js';

const form = document.querySelector('#options');
const start = document.querySelector('#start-date');
const code = document.querySelector('#code');
const validity = document.querySelector('#validity');
const copy = document.querySelector('#copy');
const status = document.querySelector('#copy-status');
const error = document.querySelector('#error');
const formatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
let current = null;
let followToday = true;
let resetCopy;

function showCode() {
  clearTimeout(resetCopy);
  current = null;
  copy.disabled = true;
  copy.querySelector('span').textContent = 'Copy';
  status.textContent = '';
  error.hidden = true;
  try {
    if (!start.value || !start.validity.valid) throw new RangeError(`Choose a date between 1 Jan 2000 and ${LAST_START_DATE}.`);
    const duration = Number(new FormData(form).get('duration'));
    const value = generate(start.value, duration);
    current = decode(value, start.value);
    code.textContent = value;
    const from = formatter.format(new Date(`${current.start_date}T12:00:00Z`));
    const through = formatter.format(new Date(`${current.last_valid_date}T12:00:00Z`));
    validity.textContent = `${from} – ${through}, inclusive`;
    copy.disabled = false;
  } catch (err) {
    code.textContent = 'No code';
    validity.textContent = 'Check the start date.';
    error.textContent = err.message;
    error.hidden = false;
  }
}

start.max = LAST_START_DATE;
start.value = localToday();
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  if (event.target === start) followToday = false;
  showCode();
});
document.querySelector('#today').addEventListener('click', () => {
  followToday = true;
  start.value = localToday();
  showCode();
});
copy.addEventListener('click', async () => {
  if (!current) return;
  try {
    await navigator.clipboard.writeText(current.code);
    copy.querySelector('span').textContent = 'Copied';
    status.textContent = '';
    resetCopy = setTimeout(() => {
      copy.querySelector('span').textContent = 'Copy';
      status.textContent = '';
    }, 3000);
  } catch {
    const range = document.createRange();
    range.selectNodeContents(code);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    status.textContent = 'Code selected. Copy it manually.';
  }
});

function refreshDate() {
  if (followToday && start.value !== localToday()) {
    start.value = localToday();
    showCode();
  }
}
document.addEventListener('visibilitychange', refreshDate);
window.addEventListener('focus', refreshDate);
setInterval(refreshDate, 60000);
showCode();

// Optional browser API; normal controls work without it.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const tool = {
    name: 'get_ltt_support_code',
    description: 'Show an L&TT 6.7 support code for today or a chosen date and validity period.',
    inputSchema: { type: 'object', properties: {
      date: { type: 'string', description: 'YYYY-MM-DD; defaults to today.' },
      days: { type: 'integer', enum: [2, 20], description: 'Defaults to 20.' },
    }, additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['date', 'days'].includes(key))) throw new TypeError('Invalid options.');
      const date = input.date ?? localToday();
      const days = input.days ?? 20;
      if (typeof date !== 'string' || ![2, 20].includes(days)) throw new RangeError('Use a YYYY-MM-DD date and either 2 or 20 days.');
      const result = decode(generate(date, days), date);
      start.value = date;
      form.querySelector(`input[value="${days}"]`).checked = true;
      followToday = input.date === undefined;
      showCode();
      return result;
    },
  };
  try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Unsupported draft API. */ }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
