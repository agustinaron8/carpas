// Lee el .docx "Carpas 2026" y lo convierte en carpas + revisiones. Sin efectos: lo usa import-docx.ts.
import { DOMParser, type Element, type Node } from '@xmldom/xmldom';
import JSZip from 'jszip';
import {
  CAMPOS_TEXTO,
  COMPONENTES,
  revisionVacia,
  type Carpa,
  type Componente,
  type Estado,
  type EstadoGeneral,
  type Revision,
  type Tipo,
} from '../../shared/model.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- Lectura del .docx ----------

export interface TablaCarpa {
  /** Etiqueta original → valor, en orden. */
  filas: { label: string; value: string }[];
  imagen: string | null;
  /** Párrafos "ÚLTIMA REVISIÓN…" que siguen a la tabla (o que están dentro de una celda). */
  ultimas: string[];
}

const RE_ULTIMA = /^[uú]ltima revisi[oó]n/i;

function texto(el: Element): string {
  const ts = el.getElementsByTagNameNS(W, 't');
  let s = '';
  for (let i = 0; i < ts.length; i++) s += ts[i].textContent ?? '';
  return s.replace(/\s+/g, ' ').trim();
}

function hijos(el: Node, ns: string, name: string): Element[] {
  const out: Element[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as Element).namespaceURI === ns && (n as Element).localName === name) out.push(n as Element);
  }
  return out;
}

function imagenes(el: Element, rels: Map<string, string>): string[] {
  const out: string[] = [];
  const all = el.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const id = all[i].getAttributeNS(R, 'embed');
    if (id && rels.has(id)) out.push(rels.get(id)!);
  }
  return out;
}

/** Recorre el documento en orden y devuelve tablas (no anidadas) y párrafos sueltos. */
function bloques(node: Node, out: Element[] = []): Element[] {
  for (let n = node.firstChild; n; n = n.nextSibling) {
    if (n.nodeType !== 1) continue;
    const el = n as Element;
    if (el.namespaceURI === W && (el.localName === 'tbl' || el.localName === 'p')) out.push(el);
    else bloques(el, out);
  }
  return out;
}

export async function leerDocx(buf: Buffer): Promise<{ tablas: TablaCarpa[]; media: Map<string, Uint8Array>; sueltos: string[] }> {
  const zip = await JSZip.loadAsync(buf);
  const relsXml = new DOMParser().parseFromString(await zip.file('word/_rels/document.xml.rels')!.async('string'), 'text/xml');
  const rels = new Map<string, string>();
  const relEls = relsXml.getElementsByTagName('Relationship');
  for (let i = 0; i < relEls.length; i++) rels.set(relEls[i].getAttribute('Id')!, relEls[i].getAttribute('Target')!);

  const doc = new DOMParser().parseFromString(await zip.file('word/document.xml')!.async('string'), 'text/xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  const tablas: TablaCarpa[] = [];
  const sueltos: string[] = [];
  for (const el of bloques(body)) {
    if (el.localName === 'p') {
      const t = texto(el);
      if (!t) continue;
      if (RE_ULTIMA.test(t) && tablas.length) tablas[tablas.length - 1].ultimas.push(t);
      else sueltos.push(t);
      continue;
    }
    const tabla: TablaCarpa = { filas: [], imagen: null, ultimas: [] };
    for (const tr of hijos(el, W, 'tr')) {
      const tcs = hijos(tr, W, 'tc');
      if (tcs.length < 2) continue;
      const label = texto(tcs[0]);
      // Una celda puede traer el valor y además un párrafo "ÚLTIMA REVISIÓN…".
      const partes: string[] = [];
      for (const p of hijos(tcs[1], W, 'p')) {
        const t = texto(p);
        if (!t) continue;
        if (RE_ULTIMA.test(t)) tabla.ultimas.push(t);
        else partes.push(t);
      }
      const imgs = imagenes(tr, rels);
      if (imgs.length && !tabla.imagen) tabla.imagen = imgs[0];
      tabla.filas.push({ label, value: partes.join(' ').replace(/^,\s*/, '').trim() });
    }
    if (tabla.filas.some((f) => normalizar(f.label) === 'nombre')) tablas.push(tabla);
    else if (tabla.filas.length) sueltos.push(tabla.filas.map((f) => `${f.label}: ${f.value}`).join(' | '));
  }
  const media = new Map<string, Uint8Array>();
  for (const path of Object.keys(zip.files)) {
    if (path.startsWith('word/media/')) media.set(path.slice('word/'.length), await zip.file(path)!.async('uint8array'));
  }
  return { tablas, media, sueltos };
}

// ---------- Interpretación ----------

type Campo = Componente | 'nombre' | 'tipo' | 'chequeada' | 'fecha' | 'cantidadPersonas' | 'campa' | 'tribu' | 'dirigente' | 'foto';

/** Etiquetas del Docs (normalizadas) → campo. Gana el prefijo más largo. */
const ETIQUETAS: [string, Campo][] = [
  ['foto', 'foto'],
  ['nombre', 'nombre'],
  ['tipo', 'tipo'],
  ['chequeada', 'chequeada'],
  ['fecha de revision', 'fecha'],
  ['bolsa', 'bolsa'],
  ['cuerpo', 'cuerpo'],
  ['cierres', 'cierres'],
  ['parantes', 'parantes'],
  ['estacas', 'estacas'],
  ['vientos', 'vientos'],
  ['sobretecho', 'sobretecho'],
  ['cantidad de personas', 'cantidadPersonas'],
  ['campa', 'campa'],
  ['tribu que la', 'tribu'],
  ['tribu quela', 'tribu'],
  ['dirigente a cargo', 'dirigente'],
];

export function campoDe(label: string): Campo | null {
  const n = normalizar(label);
  let best: [string, Campo] | null = null;
  for (const e of ETIQUETAS) if (n.startsWith(e[0]) && (!best || e[0].length > best[0].length)) best = e;
  return best?.[1] ?? null;
}

const DITTO = /^[”"“'’]{2}\s*/;

export interface Clasificacion {
  estado: Estado | null;
  nota: string | null;
  /** Solo para estacas. */
  cantidad?: number | null;
}

const SOLO_BIEN = /^(bien|bien ambos|todo perfecto|perfecto|perfectos|ok|en perfecto estado ambas|buen estado|en buen estado|funcionan perfecto|arreglado|impecable)$/;
const MAL = /\b(roto|rota|rotos|rotas|roturas|quebrado|quebrada|mal estado|no cierra|hay un tajo|todas dobladas)\b/;
const FALTA = /\b(falta|faltan|faltaron|no tiene|sin vientos|necesita)\b|\b\d+ de \d+\b/;
const REGULAR =
  /\b(revisar|se traban|poner jabon|cocer|coser|reforzar|agregar|cambiar|arrugado|olor a humedad|viejo|viejos|algunas dobladas|sueltos|ver de hacer|tratar de hacer|tiene un agujero|se abrio|se la esta haciendo)\b/;
const BIEN = /\b(bien|perfect[oa]s?|buen estado|impecable|arreglad[oa]s?|se arreglo|se arreglaron|se parcharon|se cambiaron|nuevas?)\b/;

/** Interpreta el texto libre de un componente: estado + nota tal cual estaba escrita. */
export function clasificar(valor: string, componente: Componente): Clasificacion {
  const raw = valor.trim();
  if (!raw) return { estado: null, nota: null, cantidad: componente === 'estacas' ? null : undefined };
  const n = normalizar(raw);
  let estado: Estado | null;
  if (MAL.test(n)) estado = 'mal';
  else if (FALTA.test(n)) estado = 'falta';
  else if (REGULAR.test(n)) estado = 'regular';
  else if (BIEN.test(n) || SOLO_BIEN.test(n) || (componente === 'estacas' && /^\d+ (en buen estado|nuevas)/.test(n))) estado = 'bien';
  else estado = null;
  const nota = SOLO_BIEN.test(n) ? null : raw;
  const out: Clasificacion = { estado, nota };
  if (componente === 'estacas') out.cantidad = cantidadEstacas(n);
  return out;
}

export function cantidadEstacas(n: string): number | null {
  const deM = n.match(/\b(\d+) de (\d+)\b/);
  if (deM) return Number(deM[1]);
  // "necesita 18", "faltan 6", "falta 1", "sobro 1": el número no es lo que hay.
  const limpio = n.replace(/\b(necesita|faltan?|faltaron|sobr[oó]|sobraron)\s+\d+/g, '');
  const m = limpio.match(/\b(\d+)/) ?? limpio.match(/(\d+)\s*e?stacas/);
  return m ? Number(m[1]) : null;
}

export function tipoDe(valor: string): { tipo: Tipo; capacidad: number | null } | null {
  const n = normalizar(valor);
  const cap = n.match(/para (\d+)/);
  const capacidad = cap ? Number(cap[1]) : null;
  if (n.startsWith('canad')) return { tipo: 'canadiense', capacidad };
  if (n.startsWith('iglu')) return { tipo: 'iglu', capacidad };
  return null;
}

/** "17/8", "30/7/26", "4/10/ 2026" → YYYY-MM-DD. Sin año → 2026. */
export function fechaDe(s: string): string | null {
  const m = s.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/);
  if (!m) return null;
  const [d, mo] = [Number(m[1]), Number(m[2])];
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  let y = m[3] ? Number(m[3]) : 2026;
  if (y < 100) y += 2000;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "fati v. reviso vicky", "laucha, vicky revisó", "luna (observación: cande lopez)" → [tribu, comisión]. */
export function dirigentes(s: string): { tribu: string | null; comision: string | null } {
  const v = s.trim();
  if (!v) return { tribu: null, comision: null };
  let m = v.match(/^(.*?)[\s,.]*(?:y\s+)?revis[oó]\s+(.+)$/i);
  if (m) return { tribu: m[1].trim() || null, comision: m[2].trim() };
  m = v.match(/^(.*?)[\s,]+(\S+)\s+revis[oó]$/i);
  if (m) return { tribu: m[1].trim(), comision: m[2].trim() };
  m = v.match(/^(.*?)\s*\((?:observaci[oó]n:\s*)?([^)]+)\)$/i);
  if (m) return { tribu: m[1].trim(), comision: m[2].trim() };
  return { tribu: v, comision: null };
}

/** Texto después de la fecha en "ÚLTIMA REVISIÓN: 30/7/26 se arregló…". También detecta quién revisó. */
export function ultimaRevision(s: string): { fecha: string | null; texto: string | null; comision: string | null } {
  const sinTitulo = s.replace(/^[uú]ltima revisi[oó]n(?: de la comisi[oó]n)?\s*(\([^)]*\))?\s*:?\s*/i, '');
  const fecha = fechaDe(sinTitulo);
  let resto = sinTitulo.replace(/^\s*\d{1,2}\s*\/\s*\d{1,2}(?:\s*\/\s*\d{2,4})?\s*/, '').trim();
  let comision: string | null = null;
  const rev = resto.match(/^revis[oó]\s+(\S+)$/i) ?? resto.match(/^(\p{L}+)$/u);
  if (rev && !/^(impecable|perfecto)$/i.test(rev[1])) {
    comision = rev[1];
    resto = '';
  }
  return { fecha, texto: resto || null, comision };
}

export interface Importada {
  carpa: Carpa;
  revision: Revision | null;
  imagen: string | null;
  avisos: string[];
}

export function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Notas que estaban dentro del nombre. */
export function limpiarNombre(nombre: string): { nombre: string; nota: string | null; estado?: EstadoGeneral } {
  let n = nombre.replace(/\s+/g, ' ').trim();
  let nota: string | null = null;
  let estado: EstadoGeneral | undefined;
  if (/\bLISTA+\b/.test(n)) {
    n = n.replace(/\s*\bLISTA+\b\s*/, ' ').trim();
    estado = 'lista';
  }
  const par = n.match(/^(.*?)\s*\(\s*([^)]*?)\s*\)$/);
  if (par) {
    const dentro = par[2];
    if (/no tenemos fotos/i.test(dentro)) n = par[1];
    else if (/^rota$/i.test(dentro)) {
      n = par[1];
      estado = 'reparar';
    } else if (/donaron|es la bolsa/i.test(dentro)) {
      n = par[1];
      nota = capitalizar(dentro.replace(/verano(\d)/i, 'verano $1').replace(/^donaron/i, 'Donada'));
    }
  }
  if (n === n.toUpperCase() && /[A-Z]{3}/.test(n)) n = n.charAt(0) + n.slice(1).toLowerCase();
  return { nombre: capitalizar(n), nota, estado };
}

const COMPONENTES_KEYS = COMPONENTES.map((c) => c.key);

export function interpretar(
  tabla: TablaCarpa,
  opts: { id: (s: string) => string; codigo: string; now: number; fechaSinDato: string },
): Importada {
  const avisos: string[] = [];
  const v: Partial<Record<Campo, string>> = {};
  for (const f of tabla.filas) {
    const campo = campoDe(f.label);
    if (!campo) {
      if (f.label || f.value) avisos.push(`Fila sin mapear: "${f.label}" = "${f.value}"`);
      continue;
    }
    if (campo === 'foto') continue;
    if (v[campo] !== undefined && v[campo] !== '') avisos.push(`Fila repetida "${f.label}": se usa el primer valor`);
    else v[campo] = f.value;
  }

  // Campa y tribu invertidas (ej. Emilia Picunches).
  if (v.campa && v.tribu && !/\d{4}|verano|promesa/i.test(v.campa) && /\d{4}|verano|promesa/i.test(v.tribu)) {
    [v.campa, v.tribu] = [v.tribu, v.campa];
    avisos.push(`Campa y tribu estaban invertidas: campa "${v.campa}", tribu "${v.tribu}"`);
  }

  const limpio = limpiarNombre(v.nombre ?? '');
  if (limpio.nombre !== (v.nombre ?? '').trim()) avisos.push(`Nombre "${v.nombre}" → "${limpio.nombre}"${limpio.nota ? ` (nota: ${limpio.nota})` : ''}`);
  const tipo = tipoDe(v.tipo ?? '');
  if (!tipo) avisos.push(`Tipo "${v.tipo ?? ''}" desconocido: se cargó como "otro"`);

  const carpaId = opts.id(`carpa:${limpio.nombre}`);
  const rev = revisionVacia(carpaId, opts.id(`revision:${limpio.nombre}`), opts.now, opts.fechaSinDato);
  let anterior: Clasificacion | null = null;
  let hayDatos = false;
  for (const k of COMPONENTES_KEYS) {
    let raw = v[k] ?? '';
    // Comillas de "ídem": mismo estado que la fila de arriba.
    let c: Clasificacion;
    if (DITTO.test(raw) && anterior) {
      const extra = raw.replace(DITTO, '').trim();
      c = { estado: anterior.estado, nota: extra || null };
      if (k === 'estacas') c.cantidad = extra ? cantidadEstacas(normalizar(extra)) : null;
      raw = extra;
    } else c = clasificar(raw, k);
    rev[`${k}Estado`] = c.estado;
    rev[`${k}Nota`] = c.nota;
    if (k === 'estacas') rev.estacasCantidad = c.cantidad ?? null;
    if (raw || c.estado) hayDatos = true;
    if (raw && c.estado === null) avisos.push(`${k}: "${raw}" sin estado claro (queda como nota)`);
    anterior = c;
  }

  rev.cantidadPersonas = v.cantidadPersonas || null;
  rev.tribu = v.tribu || null;
  rev.campa = v.campa || null;
  const dir = dirigentes(v.dirigente ?? '');
  rev.dirigenteTribu = dir.tribu;
  rev.dirigenteComision = dir.comision;
  if (rev.cantidadPersonas || rev.tribu || rev.campa || rev.dirigenteTribu) hayDatos = true;

  let fecha = v.fecha ? fechaDe(v.fecha) : null;
  const obs: string[] = [];
  for (const u of tabla.ultimas) {
    const p = ultimaRevision(u);
    fecha ??= p.fecha;
    if (p.texto) obs.push(p.texto);
    if (p.comision && !rev.dirigenteComision) rev.dirigenteComision = p.comision;
    if (!p.fecha) avisos.push(`"${u}" no tiene fecha`);
  }
  rev.observaciones = obs.join('\n') || null;
  if (fecha) rev.fecha = fecha;
  else if (hayDatos) avisos.push(`Sin fecha de revisión: se usó ${opts.fechaSinDato}`);

  const chequeada = normalizar(v.chequeada ?? '');
  const hayMal = COMPONENTES_KEYS.some((k) => rev[`${k}Estado`] === 'mal');
  let estadoGeneral: EstadoGeneral;
  if (/revisar|donar/.test(chequeada)) estadoGeneral = /donar/.test(chequeada) ? 'baja' : 'revisar';
  else if (limpio.estado) estadoGeneral = limpio.estado;
  else if (hayMal) estadoGeneral = 'reparar';
  // Sin "chequeada" pero con fecha de revisión (ej. Emilia Picunches): se revisó.
  else if (!chequeada && !v.fecha) estadoGeneral = 'revisar';
  else estadoGeneral = 'lista';
  if (v.chequeada && !/^(bien|si|revisada)$/.test(chequeada))
    avisos.push(`Chequeada "${v.chequeada}" → estado general "${estadoGeneral}"`);
  if (!v.chequeada && !v.fecha) avisos.push(`Sin "chequeada" → estado general "${estadoGeneral}"`);

  const carpa: Carpa = {
    id: carpaId,
    codigo: opts.codigo,
    nombre: limpio.nombre,
    tipo: tipo?.tipo ?? 'otro',
    capacidad: tipo?.capacidad ?? null,
    estadoGeneral,
    notas: limpio.nota,
    fotoPrincipalId: null,
    createdAt: opts.now,
    updatedAt: opts.now,
    deletedAt: null,
  };
  if (!hayDatos) avisos.push('Sin datos de revisión: se creó solo la carpa');
  for (const t of CAMPOS_TEXTO) if (rev[t.key] === '') rev[t.key] = null;
  return { carpa, revision: hayDatos ? rev : null, imagen: tabla.imagen, avisos };
}
