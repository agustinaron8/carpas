// Inventario: una carpa por bloque, con estado actual y revisiones anteriores.
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  CAMPOS_TEXTO,
  COMPONENTES,
  componentesConObservaciones,
  estadoActual,
  ESTADO_GENERAL_LABEL,
  ESTADO_LABEL,
  TIPO_LABEL,
  TRIBUS,
  type Carpa,
  type EstadoComponentes,
  type Revision,
} from '../../shared/model';
import { db, type LocalFoto } from '../db/dexie';
import { compararCodigo, fotosPorRevision, revisionesDe } from '../db/queries';
import { fechaCorta, plural } from '../lib/format';
import { blobToDataUrl, COLOR_ESTADO, descargar, hoyArchivo } from './common';

export interface InventarioOpts {
  /** Cuántas revisiones anteriores a la actual incluir (0 = ninguna, Infinity = todas). */
  revisiones: number;
  fotos: boolean;
}

async function fotoDataUrl(carpa: Carpa): Promise<string | null> {
  if (!carpa.fotoPrincipalId) return null;
  const foto = await db.fotos.get(carpa.fotoPrincipalId);
  return foto && !foto.deletedAt ? dataUrlDe(foto) : null;
}

async function dataUrlDe(foto: LocalFoto): Promise<string | null> {
  try {
    let blob = foto.thumbBlob ?? foto.blob;
    if (!blob && foto.thumbUrl) {
      const res = await fetch(foto.thumbUrl, { mode: 'cors' });
      if (res.ok) blob = await res.blob();
    }
    if (!blob) return null;
    // pdfmake solo entiende JPEG y PNG.
    if (!/^image\/(jpeg|png)$/.test(blob.type)) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/** Componentes del estado actual (`e`) y textos de la última revisión (`r`), si hay. */
function tablaEstado(e: EstadoComponentes, r: Revision | undefined): Content {
  const body: TableCell[][] = [
    [
      { text: 'Componente', bold: true, fillColor: '#f1f5f9' },
      { text: 'Estado', bold: true, fillColor: '#f1f5f9' },
      { text: 'Nota', bold: true, fillColor: '#f1f5f9' },
    ],
  ];
  for (const c of COMPONENTES) {
    const est = e[`${c.key}Estado`];
    const cant = c.key === 'estacas' && e.estacasCantidad !== null ? `${e.estacasCantidad}${est ? ' · ' : ''}` : '';
    body.push([
      c.label,
      { text: cant + (est ? ESTADO_LABEL[est] : cant ? '' : '—'), fillColor: est && est !== 'bien' ? COLOR_ESTADO[est] : undefined, bold: Boolean(est && est !== 'bien') },
      e[`${c.key}Nota`] ?? '',
    ]);
  }
  if (r) {
    for (const t of CAMPOS_TEXTO) {
      if (r[t.key]) body.push([t.label, { text: r[t.key]!, colSpan: 2 }, '']);
    }
    if (r.campa) body.push(['Campamento', { text: r.campa, colSpan: 2 }, '']);
  }
  return { table: { widths: [130, 80, '*'], body }, layout: 'lightHorizontalLines', fontSize: 9 };
}

function tablaHistorial(revs: Revision[]): Content {
  const body: TableCell[][] = [
    ['Fecha', 'Tribu / campa', 'Problemas y faltantes', 'Observaciones'].map((t) => ({ text: t, bold: true, fillColor: '#f1f5f9' })),
  ];
  for (const r of revs) {
    const problemas = componentesConObservaciones(r)
      .map((k) => {
        const c = COMPONENTES.find((x) => x.key === k)!;
        return `${c.label.split(' ')[0]}: ${ESTADO_LABEL[r[`${k}Estado`]!].toLowerCase()}`;
      })
      .join(', ');
    body.push([fechaCorta(r.fecha), [r.tribu, r.campa].filter(Boolean).join(' · '), problemas || '—', r.observaciones ?? '']);
  }
  return { table: { widths: [52, 90, 130, '*'], body, headerRows: 1 }, layout: 'lightHorizontalLines', fontSize: 8.5 };
}

export async function inventarioDoc(carpaIds: string[], opts: InventarioOpts): Promise<TDocumentDefinitions> {
  const carpas = (await db.carpas.bulkGet(carpaIds)).filter((c): c is Carpa => Boolean(c && !c.deletedAt)).sort(compararCodigo);
  const content: Content[] = [
    { text: 'Inventario de carpas', fontSize: 18, bold: true },
    { text: `${plural(carpas.length, 'carpa', 'carpas')} · ${fechaCorta(hoyArchivo())}`, color: '#64748b', margin: [0, 2, 0, 12] },
  ];
  for (const [i, c] of carpas.entries()) {
    const revs = await revisionesDe(c.id);
    const ultima = revs[0];
    const actual = estadoActual(c, ultima);
    const anteriores = opts.revisiones > 0 ? revs.slice(1, 1 + opts.revisiones) : [];
    const img = opts.fotos ? await fotoDataUrl(c) : null;
    const datos: Content = {
      stack: [
        { text: [{ text: `${c.codigo}  `, bold: true }, { text: c.nombre, bold: true }], fontSize: 14 },
        {
          text: [
            `${TIPO_LABEL[c.tipo]}`,
            c.capacidad ? ` · ${c.capacidad} personas` : '',
            ` · Estado general: `,
            { text: ESTADO_GENERAL_LABEL[c.estadoGeneral], bold: true, color: c.estadoGeneral === 'lista' ? '#166534' : c.estadoGeneral === 'baja' ? '#64748b' : '#b91c1c' },
          ],
          margin: [0, 3, 0, 0],
        },
        TRIBUS.some((t) => c.sugeridoPorTribu?.[t.key] != null)
          ? {
              text: [
                { text: 'Sugerido por tribu: ', bold: true },
                TRIBUS.filter((t) => c.sugeridoPorTribu?.[t.key] != null)
                  .map((t) => `${c.sugeridoPorTribu![t.key]} ${t.label}`)
                  .join(' · '),
              ],
              fontSize: 9,
              margin: [0, 3, 0, 0],
            }
          : { text: '' },
        c.notas ? { text: c.notas, italics: true, color: '#92400e', margin: [0, 4, 0, 0] } : { text: '' },
        {
          text: [
            ultima ? `Última revisión: ${fechaCorta(ultima.fecha)}` : 'Sin revisiones',
            actual?.fuente === 'manual' ? ` · Estado actualizado el ${fechaCorta(actual.fecha)}` : '',
          ],
          color: '#64748b',
          margin: [0, 4, 0, 0],
        },
      ],
    };
    const bloque: Content[] = [
      {
        columns: img ? [{ image: img, fit: [90, 90], width: 90 }, { ...datos, width: '*' }] : [datos],
        columnGap: 12,
        margin: [0, 0, 0, 6],
      },
    ];
    if (actual) bloque.push({ text: 'Estado actual', bold: true, margin: [0, 4, 0, 2] }, tablaEstado(actual.estado, ultima));
    if (ultima && opts.fotos) {
      const fotosRev = ((await fotosPorRevision(c.id)).get(ultima.id) ?? []).slice(0, 4);
      const imgs = (await Promise.all(fotosRev.map(dataUrlDe))).filter((x): x is string => Boolean(x));
      if (imgs.length)
        bloque.push({
          columns: imgs.map((image) => ({ image, fit: [110, 110] as [number, number], width: 110 })),
          columnGap: 8,
          margin: [0, 6, 0, 0],
        });
    }
    if (anteriores.length) bloque.push({ text: 'Revisiones anteriores', bold: true, margin: [0, 8, 0, 2] }, tablaHistorial(anteriores));
    content.push({
      stack: bloque,
      margin: [0, i === 0 ? 0 : 18, 0, 0],
      // Que una carpa no quede partida entre dos hojas, salvo que su historial sea largo.
      unbreakable: anteriores.length <= 6,
    });
  }
  return {
    pageSize: 'A4',
    pageMargins: [36, 36, 36, 40],
    defaultStyle: { fontSize: 10 },
    info: { title: 'Inventario de carpas' },
    footer: (page, pages) => ({ text: `${page} / ${pages}`, alignment: 'center', fontSize: 8, color: '#94a3b8' }),
    content,
  };
}

export async function generarInventario(carpaIds: string[], opts: InventarioOpts): Promise<void> {
  const doc = await inventarioDoc(carpaIds, opts);
  let nombre = `inventario-carpas-${hoyArchivo()}.pdf`;
  if (carpaIds.length === 1) {
    const c = await db.carpas.get(carpaIds[0]);
    if (c) nombre = `carpa-${c.codigo}-${hoyArchivo()}.pdf`;
  }
  await descargar(doc, nombre);
}
