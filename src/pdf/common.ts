// Carga perezosa de pdfmake y utilidades comunes a los PDFs.
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

export async function loadPdfMake() {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  (pdfMake as unknown as { vfs: unknown }).vfs = (vfs as { pdfMake?: { vfs: unknown } }).pdfMake?.vfs ?? vfs;
  return pdfMake;
}

/** iPhone/iPad (también iPad que se presenta como Mac). */
function esIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export async function descargar(doc: TDocumentDefinitions, nombre: string): Promise<void> {
  const pdfMake = await loadPdfMake();
  const pdf = pdfMake.createPdf(doc);
  const blob = await new Promise<Blob>((resolve) => pdf.getBlob(resolve));
  // En iPhone, sobre todo con la app instalada, un link de descarga a veces no hace nada. El menú de
  // compartir deja guardarlo en Archivos, imprimirlo o mandarlo. Si no está, se descarga como siempre.
  if (esIOS()) {
    const file = new File([blob], nombre, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: nombre });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Fecha de hoy en hora local (no UTC: de noche en Argentina, UTC ya es mañana). */
export { hoyISO as hoyArchivo } from '../lib/format';

export const COLOR_ESTADO = { bien: '#dcfce7', regular: '#fef3c7', mal: '#fee2e2', falta: '#f3e8ff' } as const;
