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

export async function descargar(doc: TDocumentDefinitions, nombre: string): Promise<void> {
  const pdfMake = await loadPdfMake();
  const pdf = pdfMake.createPdf(doc);
  const blob = await new Promise<Blob>((resolve) => pdf.getBlob(resolve));
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

export function hoyArchivo(): string {
  return new Date().toISOString().slice(0, 10);
}

export const COLOR_ESTADO = { bien: '#dcfce7', regular: '#fef3c7', mal: '#fee2e2', falta: '#f3e8ff' } as const;
