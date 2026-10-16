---
name: web-to-video
description: Convierte cualquier página web pública en un video explicativo de 20 a 30 s con voz, usando solo HyperFrames. Hace web scraping de la página (texto, colores, imágenes y videos incrustados), graba un recorrido con scroll, escribe un guion de 4 líneas, genera la narración con voz local y renderiza un MP4 16:9. Úsalo cuando el usuario pida "haz un video de esta página", "video de mi sitio", "promo de esta URL", "convierte este link en video" o "web to video".
---

# web-to-video · versión comunitaria

Una URL entra y sale un MP4 de 20 a 30 s con voz. Todo corre local con [HyperFrames](https://hyperframes.heygen.com)
(captura, voz Kokoro y render). No necesita cuentas ni llaves de API.

> Versión comunitaria y limitada: una plantilla, 16:9, 4 escenas, una voz y sin revisión de storyboard.
> El README explica qué incluye la versión completa.

## Requisitos (revísalos primero)

```bash
node -v            # 20 o superior
ffmpeg -version    # ffmpeg en el PATH
npx -y hyperframes@0.8.155 browser ensure   # descarga el Chrome de HyperFrames si falta
```

Una sola vez: la dependencia del grabador y la voz local (Kokoro). La voz necesita Python 3.10 o superior
(macOS trae 3.9: usa `brew install python@3.12` o `uv`).

```bash
cd ~/.claude/skills/web-to-video && npm install --omit=dev
python3.12 -m venv ~/.w2v-venv && ~/.w2v-venv/bin/pip install kokoro-onnx soundfile
export HYPERFRAMES_PYTHON=~/.w2v-venv/bin/python     # agrégalo a tu ~/.zshrc o ~/.bashrc
```

Deja el venv en una ruta corta como `~/.w2v-venv`. Con rutas muy largas, la voz en español falla con
`Error processing file '.../espeak-ng-data/phontab'` (límite de espeak-ng). Si `HYPERFRAMES_PYTHON` no está
definido, `tts` responde que falta `kokoro-onnx`.

Define esta función y esta variable en la terminal antes de empezar. Trabaja en `w2v-<slug>/`, donde el slug sale del
dominio, por ejemplo `w2v-ejemplo-com`.

```bash
hf() { npx -y hyperframes@0.8.155 "$@"; }   # funciona en bash y zsh
SKILL=~/.claude/skills/web-to-video
```

## Flujo

### 1 · Scraping de la página

```bash
hf capture <url> -o w2v-<slug>/capture --skip-vision --max-screenshots 8 --json
```

Lee estos archivos: `capture/extracted/visible-text.txt` (texto), `capture/extracted/tokens.json` (título,
descripción y colores) y `capture/extracted/video-manifest.json` (videos incrustados en la página).

**Videos de la página.** Si el manifiesto trae videos, `capture` ya los descargó en
`capture/assets/videos/`. Para listar o bajar uno en concreto:

```bash
hf capture --video w2v-<slug>/capture --list
hf capture --video w2v-<slug>/capture --index 0
```

`build.mjs` usa el primero que exista como b-roll en la escena 3. Usa solo videos que el usuario tenga
derecho a reutilizar; si la página es de un tercero, pregúntale antes. Para no usar b-roll, agrega
`--no-broll` al paso 5.

### 2 · Grabar el recorrido

```bash
node "$SKILL/scripts/record.mjs" <url> w2v-<slug>/media
```

Genera `media/scroll.mp4` (scroll suave a 1920×1080, con el tiempo corregido), `media/shot-1.jpg` a `shot-3.jpg`
y `media/record.json`. Si la página pide login, cookies o un captcha, detente y avísale al usuario:
este skill no inicia sesión ni resuelve captchas.

### 3 · Guion (lo escribes tú)

Escribe `w2v-<slug>/script.txt` con **exactamente 4 líneas**, en el idioma que pida el usuario (español por defecto):

1. Gancho: 12 palabras o menos.
2. Qué es: 18 palabras o menos.
3. El valor principal: 18 palabras o menos.
4. Cierre con llamado a la acción: 12 palabras o menos.

Usa solo hechos que aparezcan en `visible-text.txt`. No inventes cifras, clientes ni precios.
Muéstrale el guion al usuario antes de seguir; es el único punto de revisión de esta versión.

### 4 · Voz

```bash
hf tts w2v-<slug>/script.txt --voice em_alex --speed 1.0 -o w2v-<slug>/media/vo.wav
```

Voces: español `em_alex` (hombre) o `ef_dora` (mujer); inglés `am_michael` (hombre) o `af_heart` (mujer).
Si el usuario pidió otra voz, usa la que pidió.

### 5 · Armar el proyecto HyperFrames

```bash
node "$SKILL/scripts/build.mjs" w2v-<slug>
```

Crea `w2v-<slug>/video/` a partir de `$SKILL/template/`, con los tiempos de cada escena ya calculados según la
duración de la voz. Opcional: `--accent "#ff5a36"` para forzar el color; si no lo pasas, se toma de la página.

### 6 · Revisar y renderizar

```bash
cd w2v-<slug>/video
hf lint
hf snapshot . --at 2,8,16,24      # mira la hoja de contactos antes de renderizar
hf render --quality high --output ../video.mp4
```

Si `lint` marca errores, corrígelos en `video/index.html` y vuelve a correrlo. Entrega la ruta del MP4,
su duración y la hoja de contactos.

## Reglas

- No inventes contenido: todo dato en pantalla o en la voz sale de la página capturada.
- Respeta los términos del sitio y los derechos de las imágenes y los videos. Úsalo en páginas propias o públicas.
- No inicies sesión, no aceptes cookies por el usuario y no resuelvas captchas.
- Si algo falla, muestra el error y detente. No encadenes reintentos.
