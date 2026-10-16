#!/usr/bin/env node
// Arma el proyecto HyperFrames (video/) desde la captura, la grabación, el guion y la voz.
// Uso: node build.mjs <w2v-carpeta> [--accent "#hex"] [--lang es] [--no-broll]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, '..', 'template');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const dir = resolve(args[0] || '.');
const media = join(dir, 'media');
const out = join(dir, 'video');

const need = (p, why) => { if (!existsSync(p)) { console.error(`Falta ${p} (${why})`); process.exit(1); } };
need(join(dir, 'script.txt'), 'escribe el guion de 4 líneas');
need(join(media, 'vo.wav'), 'genera la voz con hyperframes tts');
need(join(media, 'scroll.mp4'), 'corre record.mjs');
need(join(media, 'record.json'), 'corre record.mjs');

const lines = readFileSync(join(dir, 'script.txt'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
if (lines.length !== 4) { console.error(`script.txt debe tener 4 líneas; tiene ${lines.length}`); process.exit(1); }
const probe = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim());
const rec = JSON.parse(readFileSync(join(media, 'record.json'), 'utf8'));
const tokensPath = join(dir, 'capture', 'extracted', 'tokens.json');
const tokens = existsSync(tokensPath) ? JSON.parse(readFileSync(tokensPath, 'utf8')) : {};
const domain = new URL(rec.url).hostname.replace(/^www\./, '');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Color de acento: el que pidas, o el más saturado de la página, o violeta
const hexes = JSON.stringify(tokens).match(/#[0-9a-fA-F]{6}\b/g) || [];
const sat = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2; return mx === mn || l < 0.25 || l > 0.8 ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)); };
const accent = opt('accent') || hexes.sort((a, b) => sat(b) - sat(a)).find((h) => sat(h) > 0.45) || '#7c5cff';

// Tiempos: cada escena dura según las palabras de su línea dentro de la voz
const vo = probe(join(media, 'vo.wav'));
const START = 0.5;
const weights = lines.map((l) => l.split(/\s+/).length + 2);
const sum = weights.reduce((a, b) => a + b, 0);
let acc = 0;
const beats = weights.map((w) => { const s = START + (acc / sum) * vo; acc += w; return { s, d: (w / sum) * vo }; });
beats[0].s = 0; beats[0].d += START;
const DUR = +(START + vo + 2.2).toFixed(2);
beats[3].d = DUR - beats[3].s;
const r2 = (n) => +n.toFixed(2);

const words = (line, b) => {
  const ws = line.split(/\s+/);
  const longest = ws.reduce((m, w, i) => (w.replace(/\W/g, '').length > ws[m].replace(/\W/g, '').length ? i : m), 0);
  const from = b.s + 0.1, to = b.s + Math.max(0.6, b.d * 0.8);
  return ws.map((w, i) => `<span class="w${i === longest ? ' k' : ''}" data-t="${r2(from + (to - from) * (i / Math.max(1, ws.length)))}">${esc(w)}</span>`).join('');
};

// Video de scroll ajustado a la escena 2
const scrollDur = probe(join(media, 'scroll.mp4'));
const rate = Math.min(3, Math.max(0.6, scrollDur / beats[1].d));
const s2Video = `<video id="vs" class="clip" src="assets/scroll.mp4" muted playsinline data-start="${r2(beats[1].s)}" data-duration="${r2(beats[1].d)}" data-media-start="0" data-playback-rate="${r2(rate)}" data-track-index="5"></video>`;

// B-roll: el primer video incrustado en la página que capture haya descargado
let broll = null;
const vidDir = join(dir, 'capture', 'assets', 'videos');
if (existsSync(vidDir) && !args.includes('--no-broll')) broll = readdirSync(vidDir).find((f) => ['.mp4', '.webm', '.mov'].includes(extname(f).toLowerCase()));
const s3Media = broll
  ? `<video id="vb" class="clip" src="assets/broll${extname(broll)}" muted playsinline data-start="${r2(beats[2].s)}" data-duration="${r2(beats[2].d)}" data-media-start="0" data-track-index="6"></video>`
  : '<img src="assets/shot-2.jpg" alt="">';

mkdirSync(join(out, 'assets', 'fonts'), { recursive: true });
for (const f of readdirSync(join(TEMPLATE, 'assets', 'fonts'))) copyFileSync(join(TEMPLATE, 'assets', 'fonts', f), join(out, 'assets', 'fonts', f));
for (const f of ['vo.wav', 'scroll.mp4', ...rec.shots]) copyFileSync(join(media, f), join(out, 'assets', f));
if (broll) copyFileSync(join(vidDir, broll), join(out, 'assets', `broll${extname(broll)}`));

const vals = {
  LANG: opt('lang', 'es'), TITLE: esc(tokens.title || rec.title || domain), DOMAIN: esc(domain), ACCENT: accent,
  DUR: DUR, VODUR: r2(vo), BEATS: JSON.stringify(beats.map((b) => ({ s: r2(b.s), d: r2(b.d) }))),
  L1: words(lines[0], beats[0]), L2: words(lines[1], beats[1]), L3: words(lines[2], beats[2]), L4: words(lines[3], beats[3]),
  S1END: r2(beats[1].s), S2START: r2(beats[1].s), S2DUR: r2(beats[1].d), S3START: r2(beats[2].s), S3DUR: r2(beats[2].d),
  S4START: r2(beats[3].s), S4DUR: r2(beats[3].d), S2_VIDEO: s2Video, S3_MEDIA: s3Media,
  SHOT1: rec.shots[0], SHOT3: rec.shots[2] || rec.shots[0],
};
const html = readFileSync(join(TEMPLATE, 'index.html'), 'utf8').replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vals ? String(vals[k]) : m));
writeFileSync(join(out, 'index.html'), html);
writeFileSync(join(out, 'hyperframes.json'), JSON.stringify({ $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json', paths: { assets: 'assets' }, media: { autoProxy: true } }, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, project: out, duration: DUR, accent, broll: broll || null, beats: vals.BEATS }));
