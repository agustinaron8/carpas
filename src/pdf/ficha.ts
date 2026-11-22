// Ficha de revisión para imprimir: etiquetas + 2 columnas para escribir a mano.
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  CAMPOS_TEXTO,
  COMPONENTES,
  ESTADO_LABEL,
  estadoActual,
  TIPO_LABEL,
  type Carpa,
  type EstadoActual,
  type EstadoComponentes,
  type Revision,
} from '../../shared/model';
import { db } from '../db/dexie';
import { compararCodigo, ultimaRevision } from '../db/queries';
import { fechaCorta } from '../lib/format';
import { ajustarTexto } from './ajustar';
import { descargar, hoyArchivo } from './common';

export interface FichaOpts {
  precargar: boolean;
  dosPorHoja: boolean;
}

function valorComponente(r: EstadoComponentes, key: (typeof COMPONENTES)[number]['key']): string {
  const partes: string[] = [];
  if (key === 'estacas' && r.estacasCantidad !== null) partes.push(String(r.estacasCantidad));
  const e = r[`${key}Estado`];
  if (e) partes.push(ESTADO_LABEL[e]);
  const n = r[`${key}Nota`];
  if (n) partes.push(n);
  return partes.join(' · ');
}

/** `anchoTotal`: ancho de la ficha en pt (sin márgenes de página). */
/**
 * `previo`: con qué se precarga la columna 1. Componentes y fecha del estado actual (puede ser una edición
 * a mano posterior a la revisión); tribu, dirigentes y observaciones de la última revisión.
 */
export function fichaContent(
  carpa: Carpa,
  previo: { actual: EstadoActual; ultima?: Revision } | undefined,
  origin: string,
  escala = 1,
  anchoTotal = 523,
): Content {
  const anterior = previo?.ultima;
  const fs = (n: number) => Math.round(n * escala * 10) / 10;
  // pdfmake suma el padding (4 + 4) y las líneas a estas alturas: son el espacio para el texto.
  const alto = { normal: 23 * escala, componente: 29 * escala, observaciones: 92 * escala };
  const anchoEtiqueta = 108 * escala;
  // Dos columnas de valores iguales, menos el padding horizontal (4 + 4) y las líneas.
  const anchoValor = (anchoTotal - anchoEtiqueta) / 2 - 10;
  const tamanos = [9, 8, 7].map(fs);
  const val = (text: string, h: number): TableCell => ({ ...ajustarTexto(text, anchoValor, h, tamanos), color: '#334155' });
  const label = (text: string): TableCell => ({ text, bold: true, fontSize: fs(9.5) });

  const fila = (etiqueta: string, h: number, col1: string, col2 = '') => ({ cells: [label(etiqueta), val(col1, h), col2 ? val(col2, h) : ''], h });
  const filas: { cells: TableCell[]; h: number }[] = [
    fila('Fecha de revisión', alto.normal, previo ? fechaCorta(previo.actual.fecha) : ''),
    fila('Nombre', alto.normal, carpa.nombre, carpa.nombre),
    fila('Tipo (canadiense o iglú)', alto.normal, TIPO_LABEL[carpa.tipo], TIPO_LABEL[carpa.tipo]),
    ...COMPONENTES.map((c) => fila(c.label, alto.componente, previo ? valorComponente(previo.actual.estado, c.key) : '')),
    ...CAMPOS_TEXTO.map((t) => fila(t.label, t.key === 'observaciones' ? alto.observaciones : alto.normal, anterior?.[t.key] ?? '')),
  ];

  const encabezado: TableCell[] = [
    { text: '', border: [false, false, false, false] },
    { text: previo ? 'Revisión anterior' : 'Revisión 1', bold: true, alignment: 'center', fontSize: fs(9), fillColor: '#f1f5f9' },
    { text: previo ? 'Revisión nueva' : 'Revisión 2', bold: true, alignment: 'center', fontSize: fs(9), fillColor: '#f1f5f9' },
  ];

  return {
    stack: [
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'FICHA DE REVISIÓN DE CARPA', fontSize: fs(9), color: '#64748b', bold: true },
              { text: carpa.codigo, fontSize: fs(30), bold: true, margin: [0, 2, 0, 0] },
              // El nombre en el encabezado ocupa como mucho dos líneas.
              ajustarTexto(carpa.nombre, anchoTotal - 100 * escala, 2 * fs(13) * 1.2, [13, 11, 9].map(fs)),
            ],
          },
          {
            width: 'auto',
            stack: [
              // Link corto (/r/:id) = QR con menos módulos, más fácil de leer impreso. Lo resuelve App.tsx.
              { qr: `${origin}/r/${carpa.id}`, fit: 96 * escala, alignment: 'right' },
              { text: 'Escaneá para cargarla', fontSize: fs(7), color: '#64748b', alignment: 'right', margin: [0, 2, 0, 0] },
            ],
          },
        ],
        margin: [0, 0, 0, 10 * escala],
      },
      {
        table: {
          widths: [anchoEtiqueta, '*', '*'],
          heights: (i: number) => (i === 0 ? 0 : filas[i - 1].h),
          body: [encabezado, ...filas.map((f) => f.cells)],
          dontBreakRows: true,
        },
        layout: {
          hLineColor: () => '#94a3b8',
          vLineColor: () => '#94a3b8',
          // En "2 por hoja" el espacio interno también se achica, si no la ficha no entra en media hoja.
          paddingTop: () => (escala < 1 ? 2 : 4),
          paddingBottom: () => (escala < 1 ? 2 : 4),
        },
      },
    ],
  };
}

export async function fichaDoc(carpaIds: string[], opts: FichaOpts, origin = location.origin): Promise<TDocumentDefinitions> {
  const carpas = (await db.carpas.bulkGet(carpaIds)).filter((c): c is Carpa => Boolean(c && !c.deletedAt)).sort(compararCodigo);
  const fichas: Content[] = [];
  for (const c of carpas) {
    const ultima = opts.precargar ? await ultimaRevision(c.id) : undefined;
    const actual = opts.precargar ? estadoActual(c, ultima) : undefined;
    const anterior = actual ? { actual, ultima } : undefined;
    // Ancho útil: A4 vertical 595 − 2×36 de margen; apaisada (842 − 2×24 − 28 entre fichas) / 2.
    fichas.push(opts.dosPorHoja ? fichaContent(c, anterior, origin, 0.74, 383) : fichaContent(c, anterior, origin, 1, 523));
  }
  const content: Content[] = [];
  if (opts.dosPorHoja) {
    for (let i = 0; i < fichas.length; i += 2) {
      content.push({
        columns: [fichas[i], fichas[i + 1] ?? { text: '' }],
        columnGap: 28,
        ...(i > 0 ? { pageBreak: 'before' as const } : {}),
      });
    }
  } else {
    fichas.forEach((f, i) => content.push(i === 0 ? f : { stack: [f], pageBreak: 'before' }));
  }
  return {
    pageSize: 'A4',
    pageOrientation: opts.dosPorHoja ? 'landscape' : 'portrait',
    pageMargins: opts.dosPorHoja ? [24, 24, 24, 24] : [36, 32, 36, 32],
    defaultStyle: { fontSize: 10 },
    info: { title: 'Fichas de revisión' },
    content,
  };
}

export async function generarFichas(carpaIds: string[], opts: FichaOpts): Promise<void> {
  const doc = await fichaDoc(carpaIds, opts);
  let nombre = `fichas-${hoyArchivo()}.pdf`;
  if (carpaIds.length === 1) {
    const c = await db.carpas.get(carpaIds[0]);
    if (c) nombre = `ficha-${c.codigo}.pdf`;
  }
  await descargar(doc, nombre);
}
