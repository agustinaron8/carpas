// Simulador de distribución: reparte los integrantes de cada tribu (mujeres y varones aparte, porque no
// duermen juntos) entre las carpas del evento, según cuántos de esa tribu se sugiere por carpa.
import { GENEROS, TRIBUS, type Genero, type IntegrantesPorTribu, type Tribu } from '../../shared/model';

/** Una carpa del evento, con cuántos entran de cada tribu. */
export interface CarpaSim {
  /** Id de la fila del evento (`EventoCarpa`). */
  id: string;
  nombre: string;
  /** Lugares por tribu. Sin dato para una tribu: esa tribu no la usa. */
  cap: Partial<Record<Tribu, number>>;
  /** Tribus cuyo lugar se estimó con la capacidad general (no hay sugerido cargado). */
  estimado: Tribu[];
  /** Ya asignada a mano y respetada: no se toca. */
  fija?: { tribu: Tribu; genero: Genero; cantidad: number };
}

export interface Grupo {
  tribu: Tribu;
  genero: Genero;
  n: number;
}

export interface Ubicacion {
  carpaId: string;
  cantidad: number;
  /** Lugares de esa carpa para esa tribu. */
  cap: number;
  fija: boolean;
}

export interface ResultadoGrupo extends Grupo {
  carpas: Ubicacion[];
  /** Personas que no entran en ninguna carpa. */
  faltan: number;
}

export interface Resultado {
  grupos: ResultadoGrupo[];
  /** Carpas que no hacen falta. */
  sobran: string[];
  faltanTotal: number;
  lugaresLibres: number;
}

export const claveGrupo = (g: Pick<Grupo, 'tribu' | 'genero'>) => `${g.tribu}:${g.genero}`;

export function gruposDe(integrantes: IntegrantesPorTribu | null | undefined): Grupo[] {
  const out: Grupo[] = [];
  for (const t of TRIBUS)
    for (const g of GENEROS) {
      const n = integrantes?.[t.key]?.[g] ?? 0;
      if (n > 0) out.push({ tribu: t.key, genero: g, n });
    }
  return out;
}

/** Reparte `n` entre carpas con estos lugares, parejo (por proporción de ocupación), sin pasar el lugar. */
export function repartir(n: number, caps: number[]): number[] {
  const cant = caps.map(() => 0);
  for (let k = 0; k < n; k++) {
    let mejor = -1;
    for (let i = 0; i < caps.length; i++) {
      if (cant[i] >= caps[i]) continue;
      if (mejor < 0 || cant[i] / caps[i] < cant[mejor] / caps[mejor] || (cant[i] / caps[i] === cant[mejor] / caps[mejor] && caps[i] > caps[mejor]))
        mejor = i;
    }
    if (mejor < 0) break;
    cant[mejor]++;
  }
  return cant;
}

/** Elige carpas para cada grupo en el orden dado: la más chica donde entra todo lo que falta, o si no la más grande. */
function asignar(grupos: Grupo[], carpas: CarpaSim[]) {
  const libres = new Set(carpas.map((c) => c.id));
  const porId = new Map(carpas.map((c) => [c.id, c]));
  const elegidas = new Map<string, string[]>();
  for (const g of grupos) {
    let resta = g.n;
    const mias: string[] = [];
    while (resta > 0) {
      let mejorEntra: CarpaSim | undefined;
      let mayor: CarpaSim | undefined;
      for (const id of libres) {
        const c = porId.get(id)!;
        const cap = c.cap[g.tribu] ?? 0;
        if (cap <= 0) continue;
        if (cap >= resta && (!mejorEntra || cap < (mejorEntra.cap[g.tribu] ?? 0))) mejorEntra = c;
        if (!mayor || cap > (mayor.cap[g.tribu] ?? 0)) mayor = c;
      }
      const c = mejorEntra ?? mayor;
      if (!c) break;
      libres.delete(c.id);
      mias.push(c.id);
      resta -= c.cap[g.tribu] ?? 0;
    }
    elegidas.set(claveGrupo(g), mias);
  }
  return elegidas;
}

/** Generador pseudoaleatorio con semilla: el mismo pedido da siempre el mismo resultado. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simular(integrantes: IntegrantesPorTribu | null | undefined, todas: CarpaSim[]): Resultado {
  const fijas = todas.filter((c) => c.fija);
  const carpas = todas.filter((c) => !c.fija);
  // Lo ya asignado a mano descuenta del grupo.
  const grupos = gruposDe(integrantes).map((g) => {
    const ya = fijas.filter((c) => c.fija!.tribu === g.tribu && c.fija!.genero === g.genero).reduce((s, c) => s + c.fija!.cantidad, 0);
    return { ...g, n: Math.max(0, g.n - ya) };
  });

  // Prueba varios órdenes de grupos y se queda con el que deja menos gente afuera, usa menos carpas y
  // desperdicia menos lugar.
  const ordenes: Grupo[][] = [[...grupos].sort((a, b) => b.n - a.n), grupos, [...grupos].sort((a, b) => a.n - b.n)];
  const rnd = mulberry32(grupos.reduce((s, g) => s * 31 + g.n, 7) | 0);
  for (let i = 0; i < 300 && grupos.length > 1; i++) {
    const o = [...grupos];
    for (let j = o.length - 1; j > 0; j--) {
      const k = Math.floor(rnd() * (j + 1));
      [o[j], o[k]] = [o[k], o[j]];
    }
    ordenes.push(o);
  }
  const porId = new Map(carpas.map((c) => [c.id, c]));
  let mejor: { puntaje: number; elegidas: Map<string, string[]> } | undefined;
  for (const o of ordenes) {
    const elegidas = asignar(o, carpas);
    let faltan = 0;
    let usadas = 0;
    let sobra = 0;
    for (const g of grupos) {
      const ids = elegidas.get(claveGrupo(g)) ?? [];
      const lugares = ids.reduce((s, id) => s + (porId.get(id)!.cap[g.tribu] ?? 0), 0);
      faltan += Math.max(0, g.n - lugares);
      sobra += Math.max(0, lugares - g.n);
      usadas += ids.length;
    }
    const puntaje = faltan * 1e6 + usadas * 1e3 + sobra;
    if (!mejor || puntaje < mejor.puntaje) mejor = { puntaje, elegidas };
  }

  const usadas = new Set<string>();
  const resultado: ResultadoGrupo[] = gruposDe(integrantes).map((g, i) => {
    const ids = mejor?.elegidas.get(claveGrupo(g)) ?? [];
    ids.forEach((id) => usadas.add(id));
    const caps = ids.map((id) => porId.get(id)!.cap[g.tribu] ?? 0);
    const cant = repartir(grupos[i].n, caps);
    const ubic: Ubicacion[] = [
      ...fijas
        .filter((c) => c.fija!.tribu === g.tribu && c.fija!.genero === g.genero)
        .map((c) => ({ carpaId: c.id, cantidad: c.fija!.cantidad, cap: c.cap[g.tribu] ?? c.fija!.cantidad, fija: true })),
      ...ids.map((id, k) => ({ carpaId: id, cantidad: cant[k], cap: caps[k], fija: false })),
    ];
    const asignados = ubic.reduce((s, u) => s + u.cantidad, 0);
    return { ...g, carpas: ubic, faltan: Math.max(0, g.n - asignados) };
  });
  const sobran = carpas.filter((c) => !usadas.has(c.id)).map((c) => c.id);
  return {
    grupos: resultado,
    sobran,
    faltanTotal: resultado.reduce((s, g) => s + g.faltan, 0),
    lugaresLibres: resultado.reduce((s, g) => s + g.carpas.filter((u) => !u.fija).reduce((x, u) => x + u.cap - u.cantidad, 0), 0),
  };
}
