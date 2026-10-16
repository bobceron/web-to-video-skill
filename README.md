# web-to-video

**De una página web a un video con voz, en minutos y sin salir de tu terminal.**
Un skill de [Claude Code](https://claude.com/claude-code) que hace web scraping de cualquier página pública,
graba un recorrido, escribe el guion, genera la narración y renderiza un MP4. Todo corre local con
[HyperFrames](https://hyperframes.heygen.com): no necesita cuentas ni llaves de API.

> Esta es la **versión comunitaria**: hace una sola cosa y la hace bien. Más abajo está lo que incluye la
> versión completa que uso en proyectos con clientes.

## Qué hace

1. **Scraping** con `hyperframes capture`: texto visible, título, colores de la marca y los videos incrustados
   en la página, que también descarga.
2. **Recorrido** con scroll suave a 1920×1080, más tres capturas: arriba, a la mitad y al final.
3. **Guion** de 4 líneas que escribe Claude solo con hechos de la página.
4. **Voz** local con Kokoro (español o inglés, voz de hombre o de mujer).
5. **Video** de 20 a 30 s en 16:9: la página en un navegador 3D, el recorrido grabado, tarjetas en capas
   con el b-roll de la propia página y un cierre con tu dominio. Texto cinético sincronizado con la voz.

## Instalación

Requisitos: Node 20+, `ffmpeg` y Python 3.10+ (macOS trae 3.9; usa `brew install python@3.12`).

```bash
git clone https://github.com/bobceron/web-to-video-skill.git
cp -r web-to-video-skill/web-to-video ~/.claude/skills/
cd ~/.claude/skills/web-to-video && npm install --omit=dev
python3.12 -m venv ~/.w2v-venv && ~/.w2v-venv/bin/pip install kokoro-onnx soundfile
echo 'export HYPERFRAMES_PYTHON=~/.w2v-venv/bin/python' >> ~/.zshrc
npx -y hyperframes@0.8.155 browser ensure
```

## Uso

Abre Claude Code y pídelo con tus palabras:

```text
Haz un video de https://tu-sitio.com con voz de hombre en español
```

Claude sigue el flujo del skill, te muestra el guion para que lo apruebes y entrega `w2v-<sitio>/video.mp4`.
También puedes correr cada paso a mano; los comandos están en [`web-to-video/SKILL.md`](web-to-video/SKILL.md).

```text
URL ─▶ hyperframes capture ─▶ record.mjs ─▶ guion (Claude) ─▶ hyperframes tts ─▶ build.mjs ─▶ hyperframes render ─▶ MP4
```

## Límites de esta versión

- Una plantilla, solo 16:9 y 4 escenas.
- Una voz y sin subtítulos.
- Sin revisión de storyboard, sin avatar y sin escenas personalizadas.
- Páginas públicas: no inicia sesión ni resuelve captchas.

## ¿Quieres la versión completa?

La versión que uso en proyectos reales agrega:

- **Storyboard visual** con panel de aprobación y notas por escena, antes de construir.
- **Avatar animado**, diagramas animados (arquitecturas, flujos de agentes) y escenas 3D por capas.
- **Comparativos antes/después** lado a lado, con cronómetros y slider de comparación.
- **Versión móvil**: graba la app en el simulador de iOS e incluye el video vertical.
- Subtítulos sincronizados por palabra, varias voces y guiones largos de 1 a 3 minutos.
- Publicación del sitio y los videos en la nube para compartirlos con un link.

Si quieres usarlo en tu equipo, adaptarlo a tu marca o ver la versión completa, abre un
[issue](https://github.com/bobceron/web-to-video-skill/issues) o escríbeme por GitHub
([@bobceron](https://github.com/bobceron)).

## Créditos y licencia

- Código de este repo: [MIT](LICENSE) © 2026 Roberto Cerón.
- Construido sobre [HyperFrames](https://github.com/heygen-com/hyperframes) (se usa con `npx`, no se redistribuye).
- Voz: [Kokoro](https://github.com/thewh1teagle/kokoro-onnx). Tipografía: Inter (SIL OFL 1.1, incluida en `template/assets/fonts`).
- Respeta los términos de cada sitio y los derechos de sus imágenes y videos.

---

**English:** a Claude Code skill that turns any public web page into a 20–30 s narrated video. It scrapes the
page with HyperFrames, records a smooth scroll, writes a 4-line script, generates a local voice with Kokoro, and
renders an MP4. Everything runs locally; no accounts or API keys needed. Install steps are above.
