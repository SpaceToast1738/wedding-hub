import { randomBytes } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

// Where physical bytes live. Production: bind-mounted Docker volume at
// /app/uploads. Local dev: `./uploads` next to the working tree.
export const UPLOADS_DIR =
  process.env.UPLOADS_DIR ??
  (process.env.NODE_ENV === "production"
    ? "/app/uploads"
    : path.join(process.cwd(), "uploads"));

// 25 MB — enough headroom for PDF contracts and decent-resolution photos
// without making it trivial to fill the volume.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Allowlist. Whatever's not on this map is rejected at the server action.
// Keep the extension hint in lockstep so the stored filename gets the
// expected suffix (some clients won't recognise the file otherwise).
const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/zip": "zip",
};

export const ALLOWED_MIME_TYPES = Object.keys(MIME_EXTENSIONS);

export function extensionFor(mime: string, originalName: string): string {
  const fromMap = MIME_EXTENSIONS[mime];
  if (fromMap) return fromMap;
  const trailing = originalName.split(".").pop();
  return trailing && /^[a-zA-Z0-9]{1,8}$/.test(trailing) ? trailing.toLowerCase() : "bin";
}

export type UploadValidation =
  | { ok: true; mime: string }
  | { ok: false; error: string };

export function validateUpload(file: File | null | undefined): UploadValidation {
  if (!file || !(file instanceof File)) return { ok: false, error: "No file received." };
  if (file.size === 0) return { ok: false, error: "File is empty." };
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0);
    return { ok: false, error: `File is too large (max ${mb} MB).` };
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    return { ok: false, error: `MIME type ${mime} is not allowed.` };
  }
  return { ok: true, mime };
}

// cuid-ish but cheaper: 16 random bytes hex-encoded → "abcd...". Suffixed with
// the original extension so the OS / mail clients recognise the file when
// downloaded.
export function generateStoredName(mime: string, originalName: string): string {
  const ext = extensionFor(mime, originalName);
  const id = randomBytes(16).toString("hex");
  return `${id}.${ext}`;
}

export async function ensureUploadsDir(): Promise<void> {
  try {
    const s = await stat(UPLOADS_DIR);
    if (!s.isDirectory()) {
      throw new Error(`UPLOADS_DIR is not a directory: ${UPLOADS_DIR}`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(UPLOADS_DIR, { recursive: true });
      return;
    }
    throw err;
  }
}

// Defence-in-depth: never let a stored path escape UPLOADS_DIR even if a
// malformed File row gets into the DB.
export function resolveStoredPath(storedPath: string): string {
  const resolved = path.resolve(UPLOADS_DIR, storedPath);
  const root = path.resolve(UPLOADS_DIR);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Invalid stored path");
  }
  return resolved;
}
