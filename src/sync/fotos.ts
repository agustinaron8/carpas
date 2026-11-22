// Compresión en el celular y cola de subida a Vercel Blob.
import { db } from '../db/dexie';
import { markFotoUploaded } from '../db/repo';
import { AuthError, getToken, NetworkError } from '../lib/api';

export async function comprimir(file: File): Promise<{ blob: Blob; thumbBlob: Blob }> {
  const { default: imageCompression } = await import('browser-image-compression');
  const opts = { useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.8 };
  const blob = await imageCompression(file, { ...opts, maxWidthOrHeight: 1600, maxSizeMB: 0.25 });
  const thumbBlob = await imageCompression(file, { ...opts, maxWidthOrHeight: 400, maxSizeMB: 0.04 });
  return { blob, thumbBlob };
}

let subiendo = false;

export async function uploadPendingFotos(): Promise<void> {
  if (subiendo) return;
  subiendo = true;
  try {
    const pendientes = (await db.fotos.where('url').equals('').toArray()).filter((f) => !f.deletedAt && f.blob);
    if (pendientes.length === 0) return;
    const upload = await uploader();
    for (const foto of pendientes) {
      try {
        const full = await upload(`fotos/${foto.carpaId}/${foto.id}.jpg`, foto.blob!);
        const thumb = await upload(`fotos/${foto.carpaId}/${foto.id}-thumb.jpg`, foto.thumbBlob ?? foto.blob!);
        await markFotoUploaded(foto.id, full, thumb);
      } catch (err) {
        if (!navigator.onLine) throw new NetworkError('Sin conexión');
        const msg = err instanceof Error ? err.message : String(err);
        if (/401|Sesión vencida/i.test(msg)) throw new AuthError();
        await db.fotos.update(foto.id, { uploadError: motivo(msg) });
      }
    }
  } finally {
    subiendo = false;
  }
}

type Upload = (pathname: string, blob: Blob) => Promise<string>;

async function uploader(): Promise<Upload> {
  const headers = { authorization: `Bearer ${getToken()}` };
  // En desarrollo, sin cuenta de Vercel, la API local guarda las fotos en disco (scripts/dev-api.ts).
  if (import.meta.env.DEV && !import.meta.env.VITE_REAL_BLOB) {
    return async (pathname, blob) => {
      const res = await fetch(`/api/dev-blob/${pathname}`, { method: 'PUT', body: blob, headers });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return new URL((await res.json()).url, location.origin).href;
    };
  }
  const { uploadPresigned } = await import('@vercel/blob/client');
  return async (pathname, blob) =>
    (await uploadPresigned(pathname, blob, { access: 'public', handleUploadUrl: '/api/blob/upload', contentType: 'image/jpeg', headers })).url;
}

function motivo(msg: string): string {
  if (/no configurado|503/i.test(msg)) return 'El almacenamiento de fotos no está configurado';
  if (/size|grande|too large/i.test(msg)) return 'Foto demasiado grande';
  if (/fetch|network|Failed/i.test(msg)) return 'Se cortó la conexión';
  return msg.slice(0, 120);
}

/** Baja las miniaturas de fotos cargadas en otros celulares, para verlas sin señal. */
export async function prefetchThumbs(): Promise<void> {
  const faltan = (await db.fotos.toArray()).filter((f) => !f.deletedAt && f.thumbUrl && !f.thumbBlob);
  for (const foto of faltan.slice(0, 50)) {
    try {
      const res = await fetch(foto.thumbUrl, { mode: 'cors' });
      if (!res.ok) continue;
      await db.fotos.update(foto.id, { thumbBlob: await res.blob() });
    } catch {
      return;
    }
  }
}
