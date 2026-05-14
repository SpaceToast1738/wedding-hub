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

// v1.89.1: reverse-lookup map (extension → MIME) used by validateUpload
// when the browser sends an empty / generic `file.type`. Some sync
// clients (OneDrive, Outlook attachments) strip the MIME and the
// browser falls back to `application/octet-stream`, which would
// otherwise be rejected even though the file is a known-good type.
const EXTENSION_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_EXTENSIONS).map(([mime, ext]) => [ext, mime]),
);
// jpeg is the same as jpg — common in the wild, fold both to image/jpeg.
EXTENSION_TO_MIME.jpeg = "image/jpeg";
// Word/Excel/PowerPoint also have non-MS extensions occasionally.
EXTENSION_TO_MIME.htm = "text/plain"; // best-effort — viewable as plaintext

export function extensionFor(mime: string, originalName: string): string {
  const fromMap = MIME_EXTENSIONS[mime];
  if (fromMap) return fromMap;
  const trailing = originalName.split(".").pop();
  return trailing && /^[a-zA-Z0-9]{1,8}$/.test(trailing) ? trailing.toLowerCase() : "bin";
}

// v1.89.1: best-effort MIME inference from a filename. Returns null
// when the extension isn't on the allowlist (so the caller's "rejected"
// error message is still accurate). Used only when the browser-
// supplied `file.type` is missing or generic.
export function inferMimeFromName(name: string): string | null {
  const trailing = name.split(".").pop()?.toLowerCase();
  if (!trailing) return null;
  return EXTENSION_TO_MIME[trailing] ?? null;
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
  // v1.89.1: prefer the browser-supplied MIME, but when it's empty or
  // the generic octet-stream fallback (common for OneDrive-synced or
  // mail-attached files where the source dropped the Content-Type),
  // try to infer from the filename extension before giving up. This
  // un-breaks PDFs / images that previously failed at the validator
  // even though they were on the allowlist.
  let mime = file.type;
  if (!mime || mime === "application/octet-stream") {
    const inferred = inferMimeFromName(file.name);
    if (inferred) mime = inferred;
  }
  if (!mime) mime = "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    // Include the filename so the user can spot a wrong-extension typo
    // without diving into devtools.
    return {
      ok: false,
      error: `${file.name}: type "${mime}" isn't allowed. Try PDF, image (PNG/JPG/WEBP), Word, Excel, PowerPoint, or zip.`,
    };
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
