import "server-only";
import sharp from "sharp";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** 512×512 PNG: initials on a soft colour, as a stock-free stand-in for a portrait. */
export async function placeholderPhoto(name: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <defs><radialGradient id="g" cx="40%" cy="35%" r="80%"><stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
    <rect width="512" height="512" fill="${color}"/><rect width="512" height="512" fill="url(#g)"/>
    <text x="256" y="300" font-size="190" font-family="Helvetica, Arial, sans-serif" font-weight="700" fill="#fff" text-anchor="middle">${esc(initials(name))}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/** 960×640 PNG "photo" for a memory: a soft scene colour with the title. */
export async function placeholderScene(title: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640">
    <rect width="960" height="640" fill="${color}"/>
    <circle cx="760" cy="150" r="90" fill="#fff" fill-opacity="0.35"/>
    <path d="M0 470 Q240 380 480 460 T960 440 V640 H0 Z" fill="#000" fill-opacity="0.12"/>
    <text x="480" y="560" font-size="54" font-family="Helvetica, Arial, sans-serif" font-weight="700" fill="#fff" text-anchor="middle">${esc(title)}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
