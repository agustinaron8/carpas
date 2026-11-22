// Ficha de revisión para imprimir: etiquetas + 2 columnas para escribir a mano.
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { CAMPOS_TEXTO, COMPONENTES, ESTADO_LABEL, TIPO_LABEL, type Carpa, type Revision } from '../../shared/model';
import { db } from '../db/dexie';
import { compararCodigo, ultimaRevision } from '../db/queries';
import { fechaCorta } from '../lib/format';
import { descargar, hoyArchivo } from './common';

export interface FichaOpts {
  precargar: boolean;
  dosPorHoja: boolean;
}

function valorComponente(r: Revision, key: (typeof COMPONENTES)[number]['key']): string {
  const partes: string[] = [];
  if (key === 'estacas' && r.estacasCantidad !== null) partes.push(String(r.estacasCantidad));
  const e = r[`${key}Estado`];
  if (e) partes.push(ESTADO_LABEL[e]);
  const n = r[`${key}Nota`];
  if (n) partes.push(n);
  return partes.join(' · ');
}

export function fichaContent(carpa: Carpa, anterior: Revision | undefined, origin: string, escala = 1): Content {
  const fs = (n: number) => Math.round(n * escala * 10) / 10;
  // pdfmake suma el padding (4 + 4) y las líneas a estas alturas.
  const alto = { normal: 23 * escala, componente: 29 * escala, observaciones: 92 * escala };
  const val = (text: string): TableCell => ({ text, fontSize: fs(9), color: '#334155' });
  const label = (text: string): TableCell => ({ text, bold: true, fontSize: fs(9.5) });

  const filas: { cells: TableCell[]; h: number }[] = [
    { cells: [label('Fecha de revisión'), val(anterior ? fechaCorta(anterior.fecha) : ''), ''], h: alto.normal },
    { cells: [label('Nombre'), val(carpa.nombre), val(carpa.nombre)], h: alto.normal },
    { cells: [label('Tipo'), val(TIPO_LABEL[carpa.tipo]), val(TIPO_LABEL[carpa.tipo])], h: alto.normal },
    ...COMPONENTES.map((c) => ({
      cells: [label(c.label), val(anterior ? valorComponente(anterior, c.key) : ''), ''],
      h: alto.componente,
    })),
    ...CAMPOS_TEXTO.map((t) => ({
      cells: [label(t.label), val(anterior?.[t.key] ?? ''), ''],
      h: t.key === 'observaciones' ? alto.observaciones : alto.normal,
    })),
  ];

  const encabezado: TableCell[] = [
    { text: '', border: [false, false, false, false] },
    { text: anterior ? 'Revisión anterior' : 'Revisión 1', bold: true, alignment: 'center', fontSize: fs(9), fillColor: '#f1f5f9' },
    { text: anterior ? 'Revisión nueva' : 'Revisión 2', bold: true, alignment: 'center', fontSize: fs(9), fillColor: '#f1f5f9' },
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
              { text: carpa.nombre, fontSize: fs(13) },
            ],
          },
          {
            width: 'auto',
            stack: [
              { qr: `${origin}/carpas/${carpa.id}/revision/nueva`, fit: 76 * escala, alignment: 'right' },
              { text: 'Escaneá para cargarla', fontSize: fs(7), color: '#64748b', alignment: 'right', margin: [0, 2, 0, 0] },
            ],
          },
        ],
        margin: [0, 0, 0, 10 * escala],
      },
      {
        table: {
          widths: [108 * escala, '*', '*'],
          heights: (i: number) => (i === 0 ? 0 : filas[i - 1].h),
          body: [encabezado, ...filas.map((f) => f.cells)],
          dontBreakRows: true,
        },
        layout: {
          hLineColor: () => '#94a3b8',
          vLineColor: () => '#94a3b8',
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      },
    ],
  };
}

export async function fichaDoc(carpaIds: string[], opts: FichaOpts, origin = location.origin): Promise<TDocumentDefinitions> {
  const carpas = (await db.carpas.bulkGet(carpaIds)).filter((c): c is Carpa => Boolean(c && !c.deletedAt)).sort(compararCodigo);
  const fichas: Content[] = [];
  for (const c of carpas) {
    const anterior = opts.precargar ? await ultimaRevision(c.id) : undefined;
    fichas.push(fichaContent(c, anterior, origin, opts.dosPorHoja ? 0.74 : 1));
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
