// Tipos y constantes compartidos entre el cliente y el servidor.
// Las fechas de auditoría (createdAt, updatedAt, deletedAt) son milisegundos epoch.

export const TIPOS = ['canadiense', 'iglu', 'otro'] as const;
export type Tipo = (typeof TIPOS)[number];
export const TIPO_LABEL: Record<Tipo, string> = { canadiense: 'Canadiense', iglu: 'Iglú', otro: 'Otro' };

export const ESTADOS_GENERALES = ['lista', 'revisar', 'reparar', 'baja'] as const;
export type EstadoGeneral = (typeof ESTADOS_GENERALES)[number];
export const ESTADO_GENERAL_LABEL: Record<EstadoGeneral, string> = {
  lista: 'Lista',
  revisar: 'Revisar',
  reparar: 'Reparar',
  baja: 'Baja',
};

export const ESTADOS = ['bien', 'regular', 'mal', 'falta'] as const;
export type Estado = (typeof ESTADOS)[number];
export const ESTADO_LABEL: Record<Estado, string> = { bien: 'Bien', regular: 'Regular', mal: 'Mal', falta: 'Falta' };
/** "Con problemas": algo está roto o gastado. Lo que falta (ej. la bolsa de estacas) se cuenta aparte. */
export const ESTADOS_CON_PROBLEMA: readonly Estado[] = ['regular', 'mal'];

/** Componentes revisados, en el orden de la ficha en papel. */
export const COMPONENTES = [
  { key: 'bolsa', label: 'Bolsa de estacas y de carpa' },
  { key: 'cuerpo', label: 'Cuerpo' },
  { key: 'cierres', label: 'Cierres' },
  { key: 'parantes', label: 'Parantes' },
  { key: 'estacas', label: 'Estacas (cantidad y estado)' },
  { key: 'vientos', label: 'Vientos y ojales' },
  { key: 'sobretecho', label: 'Sobretecho' },
] as const;
export type Componente = (typeof COMPONENTES)[number]['key'];

/** Campos de texto libre al final de la ficha, en orden. */
export const CAMPOS_TEXTO = [
  { key: 'cantidadPersonas', label: 'Cantidad de personas' },
  { key: 'tribu', label: 'Tribu que la usó' },
  { key: 'dirigenteTribu', label: 'Dirigente de la tribu a cargo' },
  { key: 'dirigenteComision', label: 'Dirigente de la comisión (revisión)' },
  { key: 'observaciones', label: 'Observaciones de la comisión' },
] as const;
export type CampoTexto = (typeof CAMPOS_TEXTO)[number]['key'];

/** Ramas del grupo, en el orden en que se muestran. */
export const TRIBUS = [
  { key: 'picunches', label: 'Picunches', raiz: 'picun' },
  { key: 'sanavirones', label: 'Sanavirones', raiz: 'sanav' },
  { key: 'caminos', label: 'Caminos', raiz: 'camin' },
  { key: 'comechingones', label: 'Comechingones', raiz: 'comech' },
  { key: 'huellas', label: 'Huellas', raiz: 'huell' },
  { key: 'dirigentes', label: 'Dirigentes', raiz: 'diri' },
] as const;
export type Tribu = (typeof TRIBUS)[number]['key'];
export const TRIBU_LABEL = Object.fromEntries(TRIBUS.map((t) => [t.key, t.label])) as Record<Tribu, string>;
/** Cuántas personas de cada tribu se sugiere que duerman en la carpa. Lo que falta, sin cargar. */
export type SugeridoPorTribu = Partial<Record<Tribu, number>>;

/**
 * Tribu de un texto libre ("picunche", "Sanavirón", "diris huellas" → dirigentes). Null si no se reconoce.
 */
export function tribuDe(texto: string | null | undefined): Tribu | null {
  const t = (texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!t.trim()) return null;
  if (/\bdiri|\bdirs\b/.test(t)) return 'dirigentes';
  return TRIBUS.find((x) => x.key !== 'dirigentes' && t.includes(x.raiz))?.key ?? null;
}

interface Auditable {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Carpa extends Auditable {
  codigo: string;
  nombre: string;
  tipo: Tipo;
  capacidad: number | null;
  estadoGeneral: EstadoGeneral;
  notas: string | null;
  fotoPrincipalId: string | null;
  /**
   * Estado actual editado a mano, sin cargar una revisión (ej. se arregló un cierre). Null: el estado
   * actual es el de la última revisión. Ver `estadoActual()`.
   */
  estadoActual?: EstadoComponentes | null;
  /** Cuándo se editó a mano (ms). Una revisión creada después vuelve a mandar. */
  estadoActualEn?: number | null;
  /** Dato fijo de la carpa (no cambia con las revisiones). Ver `TRIBUS`. */
  sugeridoPorTribu?: SugeridoPorTribu | null;
}

export interface Foto extends Auditable {
  carpaId: string;
  /** Si es una foto de una revisión (ej. del daño). Null: foto de la carpa. */
  revisionId: string | null;
  url: string;
  thumbUrl: string;
  orden: number;
}

type EstadosComponentes = { [K in Componente as `${K}Estado`]: Estado | null } & {
  [K in Componente as `${K}Nota`]: string | null;
};
type Textos = { [K in CampoTexto]: string | null };

export interface Revision extends Auditable, EstadosComponentes, Textos {
  carpaId: string;
  /** Fecha de la revisión, `YYYY-MM-DD`. */
  fecha: string;
  estacasCantidad: number | null;
  campa: string | null;
}

/** Los campos de los 7 componentes: lo que es "el estado" de una carpa. */
export type EstadoComponentes = EstadosComponentes & { estacasCantidad: number | null };

export const CAMPOS_ESTADO: readonly (keyof EstadoComponentes)[] = [
  ...COMPONENTES.flatMap((c) => [`${c.key}Estado` as const, `${c.key}Nota` as const]),
  'estacasCantidad',
];

export function estadoDe(r: EstadoComponentes): EstadoComponentes {
  return Object.fromEntries(CAMPOS_ESTADO.map((k) => [k, r[k] ?? null])) as EstadoComponentes;
}

export interface EstadoActual {
  estado: EstadoComponentes;
  /** De dónde sale: la última revisión, o una edición a mano posterior. */
  fuente: 'revision' | 'manual';
  /** Fecha YYYY-MM-DD de ese estado. */
  fecha: string;
}

function fechaLocal(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Estado actual de la carpa: lo más nuevo entre la edición a mano y la última revisión. */
export function estadoActual(carpa: Pick<Carpa, 'estadoActual' | 'estadoActualEn'>, ultima: Revision | undefined): EstadoActual | undefined {
  const manual = carpa.estadoActual && carpa.estadoActualEn ? carpa.estadoActual : null;
  if (manual && (!ultima || carpa.estadoActualEn! >= ultima.createdAt))
    return { estado: estadoDe(manual), fuente: 'manual', fecha: fechaLocal(carpa.estadoActualEn!) };
  if (ultima) return { estado: estadoDe(ultima), fuente: 'revision', fecha: ultima.fecha };
  return undefined;
}

export const GENEROS = ['m', 'v'] as const;
export type Genero = (typeof GENEROS)[number];
export const GENERO_LABEL: Record<Genero, string> = { m: 'Mujeres', v: 'Varones' };

/** Un campamento u otra salida en la que se usan carpas. */
export interface Evento extends Auditable {
  nombre: string;
  /** `YYYY-MM-DD`. */
  fechaInicio: string | null;
  fechaFin: string | null;
  lugar: string | null;
  notas: string | null;
}

/**
 * Una carpa que se usa en un evento. Con `carpaId` es del inventario; sin él es prestada solo para
 * ese evento y se describe con `nombre`, `prestadaPor` y `capacidad`.
 */
export interface EventoCarpa extends Auditable {
  eventoId: string;
  carpaId: string | null;
  nombre: string | null;
  /** Prestadas: nombre y tribu de quien la presta. Solo en la app, no en la lista impresa. */
  prestadaPor: string | null;
  prestadaPorTribu: string | null;
  capacidad: number | null;
  /** Prestadas: si ya se devolvió. Solo en la app. */
  devuelta: boolean;
  /** Tribu (o grupo) que la usa. */
  tribu: string | null;
  cantidad: number | null;
  genero: Genero | null;
  dirigente: string | null;
  observaciones: string | null;
}

export type Entidad = 'carpas' | 'fotos' | 'revisiones' | 'eventos' | 'eventoCarpas';
export const ENTIDADES: readonly Entidad[] = ['carpas', 'fotos', 'revisiones', 'eventos', 'eventoCarpas'];

export interface EntityMap {
  carpas: Carpa;
  fotos: Foto;
  revisiones: Revision;
  eventos: Evento;
  eventoCarpas: EventoCarpa;
}

export interface PushItem<E extends Entidad = Entidad> {
  entidad: E;
  row: EntityMap[E];
}

export type PushResult =
  | { entidad: Entidad; id: string; ok: true; /** Fila del servidor si era más nueva que la enviada. */ current?: EntityMap[Entidad] }
  | { entidad: Entidad; id: string; ok: false; error: string };

export interface PullResponse {
  cursor: number;
  carpas: Carpa[];
  fotos: Foto[];
  revisiones: Revision[];
  eventos: Evento[];
  eventoCarpas: EventoCarpa[];
}

export function componentesConProblema(r: EstadoComponentes | undefined): Componente[] {
  if (!r) return [];
  return COMPONENTES.filter((c) => {
    const e = r[`${c.key}Estado`];
    return e !== null && ESTADOS_CON_PROBLEMA.includes(e);
  }).map((c) => c.key);
}

export function componentesConFaltante(r: EstadoComponentes | undefined): Componente[] {
  if (!r) return [];
  return COMPONENTES.filter((c) => r[`${c.key}Estado`] === 'falta').map((c) => c.key);
}

/** Todo lo que no está "bien": problemas y faltantes. Para resaltar en los PDFs. */
export function componentesConObservaciones(r: EstadoComponentes | undefined): Componente[] {
  if (!r) return [];
  return COMPONENTES.filter((c) => {
    const e = r[`${c.key}Estado`];
    return e !== null && e !== 'bien';
  }).map((c) => c.key);
}

export function revisionVacia(carpaId: string, id: string, now: number, fecha: string): Revision {
  const r = {
    id,
    carpaId,
    fecha,
    estacasCantidad: null,
    campa: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  } as Revision;
  for (const c of COMPONENTES) {
    r[`${c.key}Estado`] = null;
    r[`${c.key}Nota`] = null;
  }
  for (const t of CAMPOS_TEXTO) r[t.key] = null;
  return r;
}
