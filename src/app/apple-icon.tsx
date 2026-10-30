// iOS home-screen icon: the official GDG icon on white (iOS fills transparent areas with black).
// Source: src/assets/gdg-icon-512.png, the favicon GDG uses on gdg.community.dev.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const png = await readFile(join(process.cwd(), "src/assets/gdg-icon-512.png"));
  const src = `data:image/png;base64,${png.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        <img src={src} width={148} height={148} alt="" />
      </div>
    ),
    size,
  );
}
