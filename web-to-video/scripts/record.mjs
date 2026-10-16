#!/usr/bin/env node
// Graba un recorrido con scroll de una página y toma 3 capturas.
// Uso: node record.mjs <url> <carpeta-salida> [--seconds 12] [--width 1920] [--height 1080]
import { execSync, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const url = args[0];
const out = resolve(args[1] || 'media');
const SECONDS = Number(opt('seconds', 12));
const W = Number(opt('width', 1920));
const H = Number(opt('height', 1080));
if (!url || !/^https?:\/\//.test(url)) { console.error('Uso: node record.mjs <url> <carpeta-salida>'); process.exit(1); }
mkdirSync(out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = process.env.CHROME || execSync('npx -y hyperframes@0.8.155 browser path', { encoding: 'utf8' }).trim().split('\n').pop();

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb'] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
// "load" y una espera acotada: las páginas con video nunca dejan la red en silencio
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 800, timeout: 8000 }).catch(() => {});
const title = await page.title();

// Precarga contenido diferido y mide el alto útil
const total = await page.evaluate(async () => {
  for (let i = 0; i < 12; i++) { window.scrollBy(0, window.innerHeight * 0.9); await new Promise((r) => setTimeout(r, 250)); }
  window.scrollTo(0, 0);
  return document.documentElement.scrollHeight;
});
await sleep(800);
const travel = Math.max(0, Math.min(total - H, H * 3.2));

// 3 capturas: arriba, a la mitad y al final del recorrido
const shots = [];
for (const [i, f] of [[1, 0], [2, 0.5], [3, 1]]) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(travel * f));
  await sleep(700);
  const file = join(out, `shot-${i}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
  shots.push(`shot-${i}.jpg`);
}
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(600);

// Recorrido con scroll suave (pausas cortas en tres paradas)
const webm = join(out, 'scroll.webm');
const rec = await page.screencast({ path: webm });
const t0 = Date.now();
await sleep(1200);
await page.evaluate(async (travel, ms) => {
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const leg = (from, to, dur) => new Promise((res) => {
    const s = performance.now();
    const f = (now) => { const t = Math.min(1, (now - s) / dur); window.scrollTo(0, from + (to - from) * ease(t)); t < 1 ? requestAnimationFrame(f) : res(); };
    requestAnimationFrame(f);
  });
  const stops = [0, travel * 0.34, travel * 0.68, travel];
  for (let i = 1; i < stops.length; i++) { await leg(stops[i - 1], stops[i], ms / 4); await new Promise((r) => setTimeout(r, ms / 12)); }
}, travel, SECONDS * 1000 * 0.82);
await sleep(1000);
const wall = (Date.now() - t0) / 1000;
await rec.stop();
await browser.close();

// El screencast etiqueta mal la cadencia: se reajusta al tiempo real y se normaliza a 30 fps
const frames = Number(execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', webm], { encoding: 'utf8' }).trim());
const rate = Number(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', webm], { encoding: 'utf8' }).trim().split('/').reduce((a, b) => a / b));
const factor = wall / (frames / rate);
const mp4 = join(out, 'scroll.mp4');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', webm, '-vf', `setpts=PTS*${factor},fps=30,scale=${W}:-2,format=yuv420p`, '-c:v', 'libx264', '-crf', '20', '-an', '-movflags', '+faststart', mp4]);
rmSync(webm);
const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' }).trim());

writeFileSync(join(out, 'record.json'), JSON.stringify({ url, title, scrollDuration: duration, shots, viewport: [W, H] }, null, 2));
console.log(JSON.stringify({ ok: true, title, scroll: 'scroll.mp4', duration: Number(duration.toFixed(2)), shots }));
