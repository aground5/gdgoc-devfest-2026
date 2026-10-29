// Demo Market rules shared by the editor (client) and the actions (server).
// The database and storage buckets enforce the same limits.

export const ASSET_RULES = {
  image: {
    bucket: "demo-images",
    max: 10,
    bytes: 5 * 1024 * 1024,
    accept: "image/png,image/jpeg,image/webp,image/gif",
    types: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  },
  file: {
    bucket: "demo-files",
    max: 5,
    bytes: 50 * 1024 * 1024,
    accept: ".pdf,.zip,.apk",
    types: ["application/pdf", "application/zip", "application/vnd.android.package-archive", "application/octet-stream"],
  },
} as const;

export type AssetKind = keyof typeof ASSET_RULES;

// Browsers often report .apk/.zip as octet-stream or nothing; trust the extension.
export function contentTypeOf(file: { name: string; type: string }, kind: AssetKind): string {
  if (kind === "image") return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "zip") return "application/zip";
  if (ext === "apk") return "application/vnd.android.package-archive";
  return file.type || "application/octet-stream";
}

// Storage keys must be ASCII; keep the original name in the database for display.
export function storagePath(teamId: string, entryId: string, fileName: string) {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = (dot > 0 ? fileName.slice(0, dot) : fileName).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  const name = `${base.slice(0, 60) || "file"}${ext ? `.${ext}` : ""}`;
  return `${teamId}/${entryId}/${crypto.randomUUID()}/${name}`;
}

// "" -> null (empty), adds https:// when missing, false when it is not a usable http(s) URL.
export function normalizeUrl(value: string): string | null | false {
  const v = value.trim();
  if (!v) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : false;
  } catch {
    return false;
  }
}

export const formatBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;
