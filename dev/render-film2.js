// Render "Life of a Launch II" to MP4: soundtrack (OfflineAudioContext in the page),
// poster PNG, then every frame at 30 fps piped from headless Chromium into ffmpeg.
// Usage (from dev/):  node render-film2.js            (~15 min, needs ffmpeg on PATH)
// Output: ../mlsys/media/life-of-a-launch-2.mp4 (gitignored) and -poster.png
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'mlsys/film-2-life-of-a-launch.html') + '?export=1';
const MEDIA = path.join(ROOT, 'mlsys/media');
const FPS = 30;

(async () => {
  fs.mkdirSync(MEDIA, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(PAGE);
  await page.evaluate(() => document.fonts.ready);
  const total = await page.evaluate(() => Film2.total);

  console.log('rendering soundtrack…');
  const wav = path.join(MEDIA, '.soundtrack.wav');
  fs.writeFileSync(wav, Buffer.from(await page.evaluate(() => Film2.renderAudio(32000)), 'base64'));

  const stage = page.locator('#f2-stage');
  await page.evaluate(() => Film2.setTime(10.9));
  await page.waitForTimeout(100);
  await stage.screenshot({ path: path.join(MEDIA, 'life-of-a-launch-2-poster.png') });

  const out = path.join(MEDIA, 'life-of-a-launch-2.mp4');
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', wav, '-af', 'loudnorm=I=-18:TP=-2',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-tune', 'animation',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.ceil(total * FPS), t0 = Date.now();
  for (let f = 0; f < N; f++) {
    await page.evaluate(t => Film2.setTime(t), f / FPS);
    const buf = await stage.screenshot({ type: 'jpeg', quality: 90 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 600 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  fs.unlinkSync(wav);
  console.log('wrote', out, 'in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  await browser.close();
})();
