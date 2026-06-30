import { chromium } from 'playwright-core';
const BASE = 'http://localhost:4287';
const OUT = '/tmp/claude-1000/-home-dani-projects-lepu-volt/866d3704-0ea1-42ce-985d-b1a855fd24e9/scratchpad';
const errors = [];
function iso(dayOffset, h, m) {
  const d = new Date(); const day = d.getDay();
  const monday = new Date(d); monday.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); monday.setHours(0,0,0,0);
  const t = new Date(monday); t.setDate(monday.getDate() + dayOffset); t.setHours(h, m, 0, 0); return t.toISOString();
}
// 6h + 6h over two days -> avg 6h, daysWorked 2
const marcajes = [
  { id: 1, fecha: iso(0, 8, 0), sentido: 'ENTRADA' }, { id: 2, fecha: iso(0, 14, 0), sentido: 'SALIDA' },
  { id: 3, fecha: iso(1, 8, 0), sentido: 'ENTRADA' }, { id: 4, fecha: iso(1, 14, 0), sentido: 'SALIDA' },
].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push('C: ' + m.text()); });
page.on('pageerror', (e) => errors.push('P: ' + e.message));
await ctx.route('**/api/marcajes**', (r) => r.request().method() === 'GET' ? r.fulfill({ json: marcajes }) : r.fulfill({ json: { id: 9 } }));
await ctx.route('**/api/account', (r) => r.fulfill({ json: { id: 1 } }));
await ctx.route('**/api/usuarios/**', (r) => r.fulfill({ json: { personalId: 42 } }));

async function setup(prefs) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((p) => {
    localStorage.setItem('volt-session', JSON.stringify({ accessToken: 'mock', userId: 1, personalId: 42 }));
    localStorage.setItem('volt-theme', 'dark');
    localStorage.setItem('volt-randomness', JSON.stringify({ min: 0, max: 0 }));
    localStorage.setItem('volt-prefs', JSON.stringify(p));
    // schedule whose last SALIDA is 23:59 (future) and another at 06:00 (past)
    localStorage.setItem('volt-schedules', JSON.stringify([
      { key: 'future', label: 'Futuro', short: 'FUT', teletrabajo: false, marcajes: [
        { sentido: 'ENTRADA', hour: 0, minute: 1 }, { sentido: 'SALIDA', hour: 23, minute: 59 }]},
      { key: 'past', label: 'Pasado', short: 'PAS', teletrabajo: false, marcajes: [
        { sentido: 'ENTRADA', hour: 0, minute: 1 }, { sentido: 'SALIDA', hour: 6, minute: 0 }]},
    ]));
  }, prefs);
}

// status = fichado (last marcaje ENTRADA? our last is SALIDA -> fuera -> next ENTRADA)
// We need to test SALIDA target. Append an open ENTRADA today so working()=true.
marcajes.unshift({ id: 50, fecha: iso((new Date().getDay()===0?6:new Date().getDay()-1), 9, 0), sentido: 'ENTRADA' });
marcajes.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

// CASE 1: schedule "future" (salida 23:59 -> future) => button hidden
await setup({ quickScheduleKey: 'future', quickTeletrabajo: false });
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const futureVisible = await page.locator('.forgotbtn').count();
console.log('CASE future (23:59): forgotbtn count =', futureVisible, '(expect 0)');
const kpi = await page.locator('.stats .stat').nth(3).innerText();
console.log('KPI:', JSON.stringify(kpi.replace(/\n/g, ' | ')));

// CASE 2: schedule "past" (salida 06:00 -> past) => button visible
await setup({ quickScheduleKey: 'past', quickTeletrabajo: false });
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const pastVisible = await page.locator('.forgotbtn').count();
const sub = pastVisible ? await page.locator('.forgotbtn .fg-sub').textContent() : '(hidden)';
console.log('CASE past (06:00): forgotbtn count =', pastVisible, '(expect 1) sub:', sub.trim());
await page.screenshot({ path: `${OUT}/q-kpi.png` });

console.log('ERRORS', errors.length, errors.join(' | '));
await browser.close();
