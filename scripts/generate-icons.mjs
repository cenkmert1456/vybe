/**
 * VYBE icon generator — renders the brand SVG into every native icon slot:
 *
 *   - Android launcher (legacy + adaptive foreground) at all densities
 *   - iOS AppIcon set (all sizes from the asset catalog)
 *   - iOS launch splash (2732x2732, brand-dark with centered mark)
 *
 * Usage: bun run mobile:icons   (requires `sharp`, a dev dependency)
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const BRAND_SVG = path.join(ROOT, "src/assets/logo.svg");

/** Mark-only SVG (transparent background) used for splash + adaptive layers. */
const MARK_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="vybeV" x1="12" y1="12" x2="52" y2="54" gradientUnits="userSpaceOnUse">
      <stop stop-color="#8B5CF6"/>
      <stop offset="0.55" stop-color="#C026D3"/>
      <stop offset="1" stop-color="#FF5FA2"/>
    </linearGradient>
    <linearGradient id="vybeDot" x1="27" y1="45" x2="37" y2="57" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FF5FA2"/>
      <stop offset="1" stop-color="#38BDF8"/>
    </linearGradient>
  </defs>
  <g transform="translate(0,6) scale(8)">
    <path d="M13 14 C 25 19, 30.5 33, 32 46" stroke="url(#vybeV)" stroke-width="8.5" stroke-linecap="round" fill="none"/>
    <path d="M51 14 C 39 19, 33.5 33, 32 46" stroke="url(#vybeV)" stroke-width="8.5" stroke-linecap="round" fill="none"/>
    <circle cx="32" cy="51.5" r="3" fill="url(#vybeDot)"/>
  </g>
</svg>`;

async function pngFromSvg(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

async function main() {
  const brand = await readFile(BRAND_SVG, "utf8");

  // ---- Android -----------------------------------------------------------
  const ANDROID_DENSITIES = [
    { dpi: "mdpi", icon: 48, fg: 108 },
    { dpi: "hdpi", icon: 72, fg: 162 },
    { dpi: "xhdpi", icon: 96, fg: 216 },
    { dpi: "xxhdpi", icon: 144, fg: 324 },
    { dpi: "xxxhdpi", icon: 192, fg: 432 },
  ];
  for (const { dpi, icon, fg } of ANDROID_DENSITIES) {
    const dir = path.join(ROOT, `android/app/src/main/res/mipmap-${dpi}`);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "ic_launcher.png"), await pngFromSvg(brand, icon));
    await writeFile(path.join(dir, "ic_launcher_foreground.png"), await pngFromSvg(brand, fg));
    console.log(`android mipmap-${dpi}: ic_launcher ${icon}px, foreground ${fg}px`);
  }

  // ---- iOS AppIcon --------------------------------------------------------
  const iOS_ICONS = [
    ["AppIcon-20@1x.png", 20], ["AppIcon-20@2x.png", 40], ["AppIcon-20@3x.png", 60],
    ["AppIcon-29@1x.png", 29], ["AppIcon-29@2x.png", 58], ["AppIcon-29@3x.png", 87],
    ["AppIcon-40@1x.png", 40], ["AppIcon-40@2x.png", 80], ["AppIcon-40@3x.png", 120],
    ["AppIcon-60@2x.png", 120], ["AppIcon-60@3x.png", 180],
    ["AppIcon-76@1x.png", 76], ["AppIcon-76@2x.png", 152],
    ["AppIcon-83.5@2x.png", 167],
    ["AppIcon-512@2x.png", 1024],
  ];
  const iosDir = path.join(ROOT, "ios/App/App/Assets.xcassets/AppIcon.appiconset");
  await mkdir(iosDir, { recursive: true });
  for (const [name, size] of iOS_ICONS) {
    await writeFile(path.join(iosDir, name), await pngFromSvg(brand, size));
    console.log(`ios AppIcon: ${name} (${size}px)`);
  }

  // ---- iOS splash (2732x2732, brand dark + centered mark) -----------------
  const splashDir = path.join(ROOT, "ios/App/App/Assets.xcassets/Splash.imageset");
  await mkdir(splashDir, { recursive: true });
  const mark = await pngFromSvg(MARK_SVG, 820);
  const splash = await sharp({
    create: { width: 2732, height: 2732, channels: 3, background: { r: 11, g: 11, b: 18 } },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toBuffer();
  for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    await writeFile(path.join(splashDir, name), splash);
    console.log(`ios splash: ${name}`);
  }

  console.log("Done — all icons regenerated from the new VYBE mark.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
