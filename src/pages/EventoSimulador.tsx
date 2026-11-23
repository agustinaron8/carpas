import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, CheckCircle2, Lock, Shuffle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GENERO_LABEL, TRIBU_LABEL, TRIBUS, tribuDe, type Carpa, type EventoCarpa, type IntegrantesPorTribu, type Tribu } from '../../shared/model';
import { useToast } from '../components/Toast';
import { db } from '../db/dexie';
import { carpasDeEvento } from '../db/queries';
import { saveEvento, saveEventoCarpas } from '../db/repo';
import { plural } from '../lib/format';
import { simular, type CarpaSim, type Resultado } from '../lib/simulador';

type Texto = Partial<Record<Tribu, { m: string; v: string }>>;

function aTexto(i: IntegrantesPorTribu | null | undefined): Texto {
  return Object.fromEntries(TRIBUS.map((t) => [t.key, { m: i?.[t.key]?.m ? String(i[t.key]!.m) : '', v: i?.[t.key]?.v ? String(i[t.key]!.v) : '' }]));
}

function deTexto(t: Texto): IntegrantesPorTribu | null {
  const out: IntegrantesPorTribu = {};
  const num = (s: string | undefined) => {
    const n = s?.trim() ? Math.round(Number(s)) : 0;
    return Number.isFinite(n) && n > 0 ? Math.min(n, 1000) : 0;
  };
  for (const x of TRIBUS) {
    const m = num(t[x.key]?.m);
    const v = num(t[x.key]?.v);
    if (m || v) out[x.key] = { m, v };
  }
  return Object.keys(out).length ? out : null;
}

/** Lugares de una carpa del evento para cada tribu: el sugerido, o la capacidad como estimación. */
function aSim(ec: EventoCarpa, c: Carpa | undefined, respetar: boolean): CarpaSim | null {
  const cap: CarpaSim['cap'] = {};
  const estimado: Tribu[] = [];
  const general = ec.carpaId ? c?.capacidad : ec.capacidad;
  for (const t of TRIBUS) {
    const s = c?.sugeridoPorTribu?.[t.key];
    if (s != null) cap[t.key] = s;
    else if (general) {
      cap[t.key] = general;
      estimado.push(t.key);
    }
  }
  if (Object.keys(cap).length === 0) return null;
  const tribu = tribuDe(ec.tribu);
  const fija = respetar && tribu && ec.genero && ec.cantidad ? { tribu, genero: ec.genero, cantidad: ec.cantidad } : undefined;
  return { id: ec.id, nombre: ec.carpaId ? `${c?.codigo ?? ''} · ${c?.nombre ?? ''}` : `${ec.nombre ?? 'Prestada'} (prestada)`, cap, estimado, fija };
}

export default function EventoSimulador() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const data = useLiveQuery(async () => {
    const [evento, ecs, carpas] = await Promise.all([db.eventos.get(id), carpasDeEvento(id), db.carpas.toArray()]);
    const porId = new Map(carpas.map((c) => [c.id, c]));
    // Las carpas borradas del inventario no cuentan.
    return { evento, ecs: ecs.filter((e) => !e.carpaId || (porId.get(e.carpaId) && !porId.get(e.carpaId)!.deletedAt)), carpas: porId };
  }, [id]);
  const [texto, setTexto] = useState<Texto | null>(null);
  const [respetar, setRespetar] = useState(false);
  const [resultado, setResultado] = useState<{ r: Resultado; sims: Map<string, CarpaSim>; respetar: boolean } | null>(null);

  useEffect(() => {
    if (data?.evento && !texto) setTexto(aTexto(data.evento.integrantes));
  }, [data, texto]);

  const yaAsignadas = useMemo(() => (data ? data.ecs.filter((e) => tribuDe(e.tribu) && e.genero && e.cantidad).length : 0), [data]);
  if (!data || !texto) return null;
  const { evento, ecs, carpas } = data;
  if (!evento || evento.deletedAt) return <p className="py-8 text-center text-slate-500">Este evento no existe o fue borrado.</p>;

  const integrantes = deTexto(texto);
  const total = TRIBUS.reduce((s, t) => s + (integrantes?.[t.key]?.m ?? 0) + (integrantes?.[t.key]?.v ?? 0), 0);
  const sinDatos = ecs.filter((e) => !aSim(e, e.carpaId ? carpas.get(e.carpaId) : undefined, false));
  const set = (t: Tribu, g: 'm' | 'v', v: string) => {
    setTexto({ ...texto, [t]: { ...(texto[t] ?? { m: '', v: '' }), [g]: v } });
    setResultado(null);
  };

  async function correr() {
    await saveEvento({ ...evento!, integrantes });
    const sims = ecs.map((e) => aSim(e, e.carpaId ? carpas.get(e.carpaId) : undefined, respetar)).filter((s): s is CarpaSim => Boolean(s));
    setResultado({ r: simular(integrantes, sims), sims: new Map(sims.map((s) => [s.id, s])), respetar });
    requestAnimationFrame(() => document.getElementById('resultado')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function aplicar() {
    if (!resultado) return;
    const msg = resultado.respetar
      ? 'Las carpas del evento van a quedar con la tribu, M/V y cantidad de la simulación (las que ya estaban asignadas no se tocan). ¿Aplicar?'
      : 'Todas las carpas del evento van a quedar con la tribu, M/V y cantidad de la simulación; las que sobran quedan sin tribu. El dirigente y las observaciones no se tocan. ¿Aplicar?';
    if (!confirm(msg)) return;
    const nuevo = new Map<string, Pick<EventoCarpa, 'tribu' | 'genero' | 'cantidad'>>();
    for (const g of resultado.r.grupos)
      for (const u of g.carpas) if (!u.fija) nuevo.set(u.carpaId, { tribu: TRIBU_LABEL[g.tribu], genero: g.genero, cantidad: u.cantidad });
    const fijas = new Set([...resultado.sims.values()].filter((s) => s.fija).map((s) => s.id));
    const cambios: EventoCarpa[] = [];
    for (const ec of ecs) {
      if (fijas.has(ec.id)) continue;
      const n = nuevo.get(ec.id) ?? { tribu: null, genero: null, cantidad: null };
      if (ec.tribu !== n.tribu || ec.genero !== n.genero || ec.cantidad !== n.cantidad) cambios.push({ ...ec, ...n });
    }
    await saveEventoCarpas(cambios);
    toast(`Distribución aplicada (${plural(cambios.length, 'carpa', 'carpas')})`);
    nav(`/eventos/${evento!.id}`, { replace: true });
  }

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h1 className="text-xl font-semibold">Simular distribución</h1>
        <p className="text-sm text-slate-600">{evento.nombre}</p>
      </div>
      <p className="text-sm text-slate-600">
        Cargá cuántos van de cada tribu. El simulador reparte a cada grupo (mujeres y varones aparte) en las carpas del evento, propias y prestadas, según las
        personas sugeridas de cada carpa. Después decidís si la aplicás.
      </p>

      <section className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Tribu</th>
              <th className="w-24 px-1 py-2 font-medium">Mujeres</th>
              <th className="w-24 px-1 py-2 font-medium">Varones</th>
              <th className="w-12 px-2 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {TRIBUS.map((t) => (
              <tr key={t.key}>
                <td className="px-3 py-1.5">{t.label}</td>
                {(['m', 'v'] as const).map((g) => (
                  <td key={g} className="px-1 py-1.5">
                    <input
                      className="input py-1.5 text-center"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={1000}
                      aria-label={`${t.label} ${GENERO_LABEL[g]}`}
                      value={texto[t.key]?.[g] ?? ''}
                      onChange={(e) => set(t.key, g, e.target.value)}
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right text-slate-600">{(integrantes?.[t.key]?.m ?? 0) + (integrantes?.[t.key]?.v ?? 0) || ''}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-medium">
              <td className="px-3 py-2">Total</td>
              <td className="px-1 py-2 text-center">{TRIBUS.reduce((s, t) => s + (integrantes?.[t.key]?.m ?? 0), 0)}</td>
              <td className="px-1 py-2 text-center">{TRIBUS.reduce((s, t) => s + (integrantes?.[t.key]?.v ?? 0), 0)}</td>
              <td className="px-2 py-2 text-right">{total}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="space-y-2 text-sm">
        <p className="text-slate-600">
          {plural(ecs.length, 'carpa en el evento', 'carpas en el evento')} ({ecs.filter((e) => e.carpaId).length} del grupo, {ecs.filter((e) => !e.carpaId).length}{' '}
          prestadas).
        </p>
        {sinDatos.length > 0 && (
          <p className="rounded-lg bg-amber-50 p-2 text-amber-900">
            No se usan porque no tienen sugerido ni capacidad: {sinDatos.map((e) => (e.carpaId ? carpas.get(e.carpaId)?.nombre : e.nombre)).join(', ')}.
          </p>
        )}
        {yaAsignadas > 0 && (
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 size-4" checked={respetar} onChange={(e) => (setRespetar(e.target.checked), setResultado(null))} />
            <span>
              <span className="font-medium">Respetar las que ya están asignadas ({yaAsignadas})</span>
              <span className="block text-slate-500">Las que ya tienen tribu, M/V y cantidad quedan como están; el resto se reparte.</span>
            </span>
          </label>
        )}
      </div>

      <button className="btn-primary w-full" disabled={total === 0 || ecs.length === 0} onClick={() => void correr()}>
        <Shuffle size={18} /> {total === 0 ? 'Cargá los integrantes' : ecs.length === 0 ? 'El evento no tiene carpas' : 'Simular'}
      </button>

      {resultado && <ResultadoVista res={resultado} onAplicar={() => void aplicar()} />}
    </div>
  );
}

function ResultadoVista({ res, onAplicar }: { res: { r: Resultado; sims: Map<string, CarpaSim> }; onAplicar: () => void }) {
  const { r, sims } = res;
  return (
    <section id="resultado" className="scroll-mt-20 space-y-3">
      <h2 className="border-b border-slate-200 pb-1 text-base font-semibold text-green-800">Distribución sugerida</h2>
      {r.faltanTotal > 0 ? (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          Faltan lugares para {plural(r.faltanTotal, 'persona', 'personas')}. Sumá carpas al evento (propias o prestadas) o revisá los sugeridos.
        </p>
      ) : (
        <p className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          Entran todos. {r.lugaresLibres > 0 && `Quedan ${plural(r.lugaresLibres, 'lugar libre', 'lugares libres')} en las carpas usadas.`}
        </p>
      )}
      {r.grupos.map((g) => (
        <div key={`${g.tribu}:${g.genero}`} className="card p-3">
          <p className="flex items-center justify-between gap-2 font-medium">
            <span>
              {TRIBU_LABEL[g.tribu]} · {GENERO_LABEL[g.genero]}
            </span>
            <span className="text-sm text-slate-600">{plural(g.n, 'persona', 'personas')}</span>
          </p>
          <ul className="mt-1 divide-y divide-slate-100 text-sm">
            {g.carpas.map((u) => {
              const s = sims.get(u.carpaId);
              return (
                <li key={u.carpaId} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate">{s?.nombre}</span>
                  {u.fija && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                      <Lock size={12} /> ya asignada
                    </span>
                  )}
                  {s?.estimado.includes(g.tribu) && !u.fija && <span className="shrink-0 text-xs text-amber-700">por capacidad</span>}
                  <span className="shrink-0 font-semibold">
                    {u.cantidad}
                    <span className="font-normal text-slate-500"> / {u.cap}</span>
                  </span>
                </li>
              );
            })}
            {g.carpas.length === 0 && <li className="py-1.5 text-slate-500">Ninguna carpa.</li>}
          </ul>
          {g.faltan > 0 && <p className="mt-1 text-sm font-medium text-red-700">No entran {g.faltan}.</p>}
        </div>
      ))}
      {r.sobran.length > 0 && (
        <div className="text-sm text-slate-600">
          <p className="font-medium">Quedan libres ({r.sobran.length})</p>
          <p>{r.sobran.map((id) => sims.get(id)?.nombre).join(', ')}</p>
        </div>
      )}
      <p className="text-xs text-slate-500">"Por capacidad": esa carpa no tiene cargado el sugerido para la tribu y se usó su capacidad general.</p>
      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <button className="btn-primary w-full" onClick={onAplicar}>
          Aplicar esta distribución
        </button>
        <p className="mt-1 text-center text-xs text-slate-500">Después la podés modificar carpa por carpa.</p>
      </div>
    </section>
  );
}
