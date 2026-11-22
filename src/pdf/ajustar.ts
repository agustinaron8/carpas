// Que cada texto entre en su celda de la ficha. Sin dependencias, para poder testearlo.
// Medidas aproximadas de Roboto: ancho medio de un carácter y alto de línea, en proporción al tamaño.
const ANCHO_CARACTER = 0.55;
const ALTO_LINEA = 1.2;

/** Cuántas líneas ocupa el texto con `porLinea` caracteres por línea, cortando en espacios. */
export function lineasDe(text: string, porLinea: number): number {
  let lineas = 0;
  for (const parrafo of text.split('\n')) {
    let actual = 0;
    lineas++;
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const largo = palabra.length;
      if (actual === 0) {
        lineas += Math.ceil(largo / porLinea) - 1;
        actual = largo % porLinea || porLinea;
      } else if (actual + 1 + largo <= porLinea) actual += 1 + largo;
      else {
        lineas += Math.ceil(largo / porLinea);
        actual = largo % porLinea || porLinea;
      }
    }
  }
  return lineas;
}

/**
 * Elige el tamaño de letra más grande con el que el texto entra en `ancho` × `alto` (pt). Si no entra ni
 * con el más chico, lo corta con "…". Así una ficha nunca pasa de una hoja: el texto completo está en la app.
 */
export function ajustarTexto(text: string, ancho: number, alto: number, tamanos: number[]): { text: string; fontSize: number } {
  const cabe = (t: string, fs: number) =>
    lineasDe(t, Math.max(1, Math.floor(ancho / (fs * ANCHO_CARACTER)))) <= Math.max(1, Math.floor(alto / (fs * ALTO_LINEA)));
  for (const fs of tamanos) if (cabe(text, fs)) return { text, fontSize: fs };
  const fs = tamanos[tamanos.length - 1];
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (cabe(text.slice(0, mid).trimEnd() + '…', fs)) lo = mid;
    else hi = mid - 1;
  }
  return { text: text.slice(0, lo).trimEnd() + '…', fontSize: fs };
}
