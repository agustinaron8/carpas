// Lista de carpas de un evento para imprimir: las del grupo y las prestadas en tablas separadas, con
// una columna de observaciones con lugar para anotar a mano.
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { ESTADO_GENERAL_LABEL, type Carpa, type Evento, type EventoCarpa } from '../../shared/model';
import { db } from '../db/dexie';
import { carpasDeEvento } from '../db/queries';
import { cantidadTexto, capacidadDe, nombreDe, ordenar, rangoFechas, totales, type OrdenLista } from '../lib/eventos';
import { fechaCorta, plural } from '../lib/format';
import { descargar, hoyArchivo } from './common';

export interface ListaOpts {
  /** Carpas del inventario a incluir (ya filtradas por estado). */
  carpaIds: string[];
  prestadas: boolean;
  orden: OrdenLista;
}

const GRIS = '#f1f5f9';
const BANDA = '#f8fafc';
/** Alto mínimo de cada fila: deja lugar para escribir en observaciones. */
const ALTO_FILA = 26;

const th = (text: string, extra: { alignment?: 'center'; fontSize?: number } = {}): TableCell => ({ text, bold: true, fillColor: GRIS, fontSize: 9, ...extra });

function totalTexto(rows: EventoCarpa[], carpas: Map<string, Carpa>): string {
  const t = totales(rows, carpas);
  const partes = [plural(t.carpas, 'carpa', 'carpas')];
  if (t.lugares) partes.push(plural(t.lugares, 'lugar', 'lugares'));
  if (t.personas) partes.push(`${plural(t.personas, 'persona', 'personas')}${t.m || t.v ? ` (${t.m} M, ${t.v} V)` : ''}`);
  return `Total: ${partes.join(' · ')}`;
}

/** Con orden por tribu, sombrea en bandas alternas cada tribu para que se lean los grupos. */
function bandas(rows: EventoCarpa[], orden: OrdenLista): (string | undefined)[] {
  if (orden !== 'tribu') return rows.map(() => undefined);
  let par = false;
  let anterior: string | null | undefined;
  return rows.map((r, i) => {
    const t = r.tribu?.trim().toLocaleLowerCase('es') ?? '';
    if (i > 0 && t !== anterior) par = !par;
    anterior = t;
    return par ? BANDA : undefined;
  });
}

function tabla(header: TableCell[], body: TableCell[][], widths: (number | string)[], fills: (string | undefined)[]): Content {
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths,
      heights: (i: number) => (i === 0 ? 'auto' : ALTO_FILA),
      body: [header, ...body.map((row, i) => row.map((c) => (fills[i] && typeof c === 'object' ? { ...(c as object), fillColor: fills[i] } : c)) as TableCell[])],
    },
    layout: {
      hLineColor: () => '#94a3b8',
      vLineColor: () => '#94a3b8',
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      paddingTop: () => 4,
      paddingBottom: () => 3,
    },
  };
}

export function listaContent(evento: Evento, propias: EventoCarpa[], prestadas: EventoCarpa[] | null, carpas: Map<string, Carpa>, orden: OrdenLista): Content[] {
  const sub = [rangoFechas(evento), evento.lugar].filter(Boolean).join(' · ');
  const content: Content[] = [
    { text: `Carpas · ${evento.nombre}`, fontSize: 16, bold: true },
    ...(sub ? [{ text: sub, color: '#334155', margin: [0, 2, 0, 0] } as Content] : []),
    { text: `Lista generada el ${fechaCorta(hoyArchivo())}`, fontSize: 8, color: '#64748b', margin: [0, 2, 0, 10] },
  ];

  const ps = ordenar(propias, carpas, orden);
  content.push({ text: `Carpas del grupo (${ps.length})`, fontSize: 12, bold: true, margin: [0, 0, 0, 4] });
  if (ps.length === 0) {
    content.push({ text: 'Ninguna.', color: '#64748b', margin: [0, 0, 0, 10] });
  } else {
    const body = ps.map((ec): TableCell[] => {
      const c = ec.carpaId ? carpas.get(ec.carpaId) : undefined;
      const cap = capacidadDe(ec, carpas);
      return [
        {
          stack: [
            { text: [{ text: `${c?.codigo ?? ''}  `, bold: true, fontSize: 8, color: '#475569' }, { text: nombreDe(ec, carpas) }] },
            ...(cap || (c && c.estadoGeneral !== 'lista')
              ? [
                  {
                    text: [
                      cap ? `${cap} pers.` : '',
                      c && c.estadoGeneral !== 'lista' ? { text: `${cap ? ' · ' : ''}${ESTADO_GENERAL_LABEL[c.estadoGeneral]}`, color: '#b91c1c', bold: true } : '',
                    ],
                    fontSize: 7,
                    color: '#64748b',
                  },
                ]
              : []),
          ],
        },
        { text: ec.tribu ?? '' },
        { text: cantidadTexto(ec), alignment: 'center' },
        { text: ec.dirigente ?? '' },
        { text: ec.observaciones ?? '', fontSize: 8 },
      ];
    });
    content.push(
      tabla([th('Carpa'), th('Tribu'), th('Cant.', { alignment: 'center' }), th('Dirigente a cargo'), th('Observaciones')], body, [118, 80, 34, 96, '*'], bandas(ps, orden)),
      { text: totalTexto(ps, carpas), fontSize: 8, color: '#334155', alignment: 'right', margin: [0, 3, 0, 12] },
    );
  }

  if (prestadas) {
    const pr = ordenar(prestadas, carpas, orden);
    content.push({ text: `Carpas prestadas (${pr.length})`, fontSize: 12, bold: true, margin: [0, 4, 0, 4] });
    if (pr.length === 0) {
      content.push({ text: 'Ninguna.', color: '#64748b' });
    } else {
      const body = pr.map((ec): TableCell[] => [
        {
          stack: [{ text: nombreDe(ec, carpas) }, ...(ec.capacidad ? [{ text: `${ec.capacidad} pers.`, fontSize: 7, color: '#64748b' }] : [])],
        },
        { text: ec.tribu ?? '' },
        { text: cantidadTexto(ec), alignment: 'center' },
        { text: ec.dirigente ?? '' },
        { text: ec.observaciones ?? '', fontSize: 8 },
      ]);
      content.push(
        tabla(
          [
            th('Carpa'),
            th('Tribu'),
            th('Cant.', { alignment: 'center' }),
            th('Dirigente a cargo'),
            th('Observaciones'),
          ],
          body,
          [118, 80, 34, 96, '*'],
          bandas(pr, orden),
        ),
        { text: totalTexto(pr, carpas), fontSize: 8, color: '#334155', alignment: 'right', margin: [0, 3, 0, 0] },
      );
    }
  }
  return content;
}

export async function listaDoc(eventoId: string, opts: ListaOpts): Promise<{ doc: TDocumentDefinitions; evento: Evento }> {
  const evento = await db.eventos.get(eventoId);
  if (!evento) throw new Error('No existe el evento');
  const ecs = await carpasDeEvento(eventoId);
  const carpas = new Map((await db.carpas.toArray()).map((c) => [c.id, c]));
  const elegidas = new Set(opts.carpaIds);
  const propias = ecs.filter((e) => e.carpaId && elegidas.has(e.carpaId));
  const prestadas = opts.prestadas ? ecs.filter((e) => !e.carpaId) : null;
  return {
    evento,
    doc: {
      pageSize: 'A4',
      pageMargins: [36, 32, 36, 36],
      defaultStyle: { fontSize: 10 },
      info: { title: `Carpas · ${evento.nombre}` },
      content: listaContent(evento, propias, prestadas, carpas, opts.orden),
      footer: (page, pages) =>
        pages > 1 ? { text: `${evento.nombre} · ${page}/${pages}`, alignment: 'center', fontSize: 8, color: '#64748b', margin: [0, 12, 0, 0] } : null,
    },
  };
}

function slug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'evento'
  );
}

export async function generarListaEvento(eventoId: string, opts: ListaOpts): Promise<void> {
  const { doc, evento } = await listaDoc(eventoId, opts);
  await descargar(doc, `carpas-${slug(evento.nombre)}-${hoyArchivo()}.pdf`);
}
