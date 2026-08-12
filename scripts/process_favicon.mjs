import sharp from 'sharp';
import fs from 'fs';

const inputPath = 'C:\\Users\\jo.lo\\Downloads\\Gemini_Generated_Image_hxygdmhxygdmhxyg.png';
const appIconPng = 'c:\\Users\\jo.lo\\Desktop\\appscript\\health-tracker-v2\\app\\icon.png';
const appAppleIconPng = 'c:\\Users\\jo.lo\\Desktop\\appscript\\health-tracker-v2\\app\\apple-icon.png';
const publicIconPng = 'c:\\Users\\jo.lo\\Desktop\\appscript\\health-tracker-v2\\public\\icon.png';
const faviconIco = 'c:\\Users\\jo.lo\\Desktop\\appscript\\health-tracker-v2\\public\\favicon.ico';
const appIconSvg = 'c:\\Users\\jo.lo\\Desktop\\appscript\\health-tracker-v2\\app\\icon.svg';
const appAppleIconTsx = 'c:\\Users\\jo.lo\\Desktop\\appscript\\health-tracker-v2\\app\\apple-icon.tsx';

async function processFavicon() {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const newBuffer = Buffer.from(data);

  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = newBuffer[idx];
      const g = newBuffer[idx + 1];
      const b = newBuffer[idx + 2];

      const isWhiteBg = (r > 215 && g > 215 && b > 215) || (r > 200 && g > 200 && b > 200 && Math.abs(r - g) < 15 && Math.abs(g - b) < 15);

      if (isWhiteBg) {
        newBuffer[idx + 3] = 0;
      } else {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;

  const cropped = await sharp(newBuffer, {
    raw: { width, height, channels }
  })
    .extract({
      left: Math.max(0, minX - 10),
      top: Math.max(0, minY - 10),
      width: Math.min(width - minX, boxWidth + 20),
      height: Math.min(height - minY, boxHeight + 20)
    })
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  fs.writeFileSync(appIconPng, cropped);
  fs.writeFileSync(appAppleIconPng, cropped);
  fs.writeFileSync(publicIconPng, cropped);
  fs.writeFileSync(faviconIco, cropped);

  if (fs.existsSync(appIconSvg)) fs.unlinkSync(appIconSvg);
  if (fs.existsSync(appAppleIconTsx)) fs.unlinkSync(appAppleIconTsx);

  console.log(`Favicon generated & old files cleaned up! Box: [${minX}, ${minY}, ${maxX}, ${maxY}]`);
}

processFavicon().catch(err => {
  console.error(err);
  process.exit(1);
});
