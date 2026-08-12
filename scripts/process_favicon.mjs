import sharp from 'sharp';
import fs from 'fs';

const inputPath = 'C:\\Users\\jo.lo\\Downloads\\Gemini_Generated_Image_hxygdmhxygdmhxyg.png';
const appIconPng = 'c:\\Users\\jo.lo\\Desktop\\appscript\\health-tracker-v2\\app\\icon.png';
const appAppleIconPng = 'c:\\Users\\jo.lo\\Desktop\\appscript\\health-tracker-v2\\app\\apple-icon.png';
const publicIconPng = 'c:\\Users\\jo.lo\\Desktop\\appscript\\health-tracker-v2\\public\\icon.png';
const faviconIco = 'c:\\Users\\jo.lo\\Desktop\\appscript\\health-tracker-v2\\public\\favicon.ico';

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

  // Extract closely cropped heart PNG buffer
  const croppedPng = await sharp(newBuffer, {
    raw: { width, height, channels }
  })
    .extract({
      left: minX,
      top: minY,
      width: boxWidth,
      height: boxHeight
    })
    .png()
    .toBuffer();

  // Resize heart PNG buffer to 340x340 with transparent background padding
  const resizedHeart = await sharp(croppedPng)
    .resize(340, 340, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  // 1. Transparent PNG for browser favicons (512x512) with ~170px centered heart padding
  const transparentIcon = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: resizedHeart, gravity: 'center' }])
    .png()
    .toBuffer();

  // 2. White background PNG for Apple Touch Icon (iOS home screen icon)
  const appleIcon = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([{ input: resizedHeart, gravity: 'center' }])
    .png()
    .toBuffer();

  fs.writeFileSync(appIconPng, transparentIcon);
  fs.writeFileSync(publicIconPng, transparentIcon);
  fs.writeFileSync(faviconIco, transparentIcon);
  fs.writeFileSync(appAppleIconPng, appleIcon);

  console.log(`Favicon re-generated with clean white & transparent padding!`);
}

processFavicon().catch(err => {
  console.error(err);
  process.exit(1);
});
