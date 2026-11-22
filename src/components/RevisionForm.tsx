import { Copy } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  CAMPOS_TEXTO,
  COMPONENTES,
  ESTADO_GENERAL_LABEL,
  ESTADO_LABEL,
  ESTADOS,
  ESTADOS_GENERALES,
  revisionVacia,
  TIPO_LABEL,
  type Carpa,
  type Componente,
  type EstadoGeneral,
  type Revision,
} from '../../shared/model';
import { saveCarpa, saveRevision, uuid } from '../db/repo';
import { fechaCorta, hoyISO } from '../lib/format';
import { ESTADO_COLOR } from './badges';

function copiarComponentes(destino: Revision, origen: Revision): Revision {
  const r = { ...destino };
  for (const c of COMPONENTES) {
    r[`${c.key}Estado`] = origen[`${c.key}Estado`];
    r[`${c.key}Nota`] = origen[`${c.key}Nota`];
  }
  r.estacasCantidad = origen.estacasCantidad;
  return r;
}

function igualFila(a: Revision, b: Revision, k: Componente): boolean {
  return (
    a[`${k}Estado`] === b[`${k}Estado`] &&
    (a[`${k}Nota`] ?? '') === (b[`${k}Nota`] ?? '') &&
    (k !== 'estacas' || a.estacasCantidad === b.estacasCantidad)
  );
}

interface Props {
  carpa: Carpa;
  /** Revisión a editar. Sin ella, se crea una nueva. */
  revision?: Revision;
  /** Revisión anterior, para precargar y para "Igual que la anterior". */
  anterior?: Revision;
  submitLabel: string;
  onSaved: (r: Revision) => void;
  extraActions?: ReactNode;
  /** Valores que se repiten en la carga en lote (fecha, campa, dirigente de la comisión). */
  defaults?: Partial<Pick<Revision, 'fecha' | 'campa' | 'dirigenteComision'>>;
}

export function RevisionForm({ carpa, revision, anterior, submitLabel, onSaved, extraActions, defaults }: Props) {
  const [precargar, setPrecargar] = useState(!revision && Boolean(anterior));
  const [r, setR] = useState<Revision>(() => {
    if (revision) return revision;
    const base = { ...revisionVacia(carpa.id, uuid(), Date.now(), defaults?.fecha ?? hoyISO()), campa: defaults?.campa ?? null, dirigenteComision: defaults?.dirigenteComision ?? null };
    return anterior ? copiarComponentes(base, anterior) : base;
  });
  const [estadoGeneral, setEstadoGeneral] = useState<EstadoGeneral>(carpa.estadoGeneral);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<Revision>) => setR((x) => ({ ...x, ...p }));
  const txt = (v: string) => (v.trim() ? v : null);

  function togglePrecarga(on: boolean) {
    setPrecargar(on);
    if (!anterior) return;
    const vacia = revisionVacia(carpa.id, r.id, r.createdAt, r.fecha);
    setR(on ? copiarComponentes(r, anterior) : copiarComponentes(r, vacia));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await saveRevision(r);
      if (estadoGeneral !== carpa.estadoGeneral) await saveCarpa({ ...carpa, estadoGeneral });
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
        <span>
          <span className="text-slate-500">Nombre:</span> <b>{carpa.nombre}</b>
        </span>
        <span>
          <span className="text-slate-500">Tipo:</span> {TIPO_LABEL[carpa.tipo]}
        </span>
        <label className="ml-auto flex items-center gap-2">
          <span className="text-slate-500">Fecha</span>
          <input type="date" required className="input w-auto py-1" value={r.fecha} onChange={(e) => patch({ fecha: e.target.value })} />
        </label>
      </div>

      {anterior && !revision && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={precargar} onChange={(e) => togglePrecarga(e.target.checked)} />
          Precargar con la revisión del {fechaCorta(anterior.fecha)}
        </label>
      )}

      <div className="space-y-3">
        {COMPONENTES.map((c) => {
          const estado = r[`${c.key}Estado`];
          return (
            <div key={c.key} className="card p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium">{c.label}</span>
                {anterior && !igualFila(r, anterior, c.key) && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-green-800"
                    onClick={() =>
                      patch({
                        [`${c.key}Estado`]: anterior[`${c.key}Estado`],
                        [`${c.key}Nota`]: anterior[`${c.key}Nota`],
                        ...(c.key === 'estacas' ? { estacasCantidad: anterior.estacasCantidad } : {}),
                      })
                    }
                  >
                    <Copy size={12} /> Igual que la anterior
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {c.key === 'estacas' && (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={500}
                    placeholder="Cant."
                    aria-label="Cantidad de estacas"
                    className="input w-20 py-1.5"
                    value={r.estacasCantidad ?? ''}
                    onChange={(e) => patch({ estacasCantidad: e.target.value === '' ? null : Math.round(Number(e.target.value)) })}
                  />
                )}
                {ESTADOS.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => patch({ [`${c.key}Estado`]: estado === s ? null : s })}
                    className={`rounded-full border px-3 py-1.5 text-sm ${estado === s ? ESTADO_COLOR[s] + ' font-semibold' : 'border-slate-300 bg-white text-slate-700'}`}
                  >
                    {ESTADO_LABEL[s]}
                  </button>
                ))}
              </div>
              <input
                className="input mt-2 py-1.5 text-sm"
                placeholder="Nota (como está en la ficha)"
                value={r[`${c.key}Nota`] ?? ''}
                onChange={(e) => patch({ [`${c.key}Nota`]: txt(e.target.value) })}
              />
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        {CAMPOS_TEXTO.map((t) => (
          <div key={t.key}>
            <label className="label" htmlFor={t.key}>
              {t.label}
            </label>
            {t.key === 'observaciones' ? (
              <textarea id={t.key} className="input min-h-24" value={r[t.key] ?? ''} onChange={(e) => patch({ [t.key]: txt(e.target.value) })} />
            ) : (
              <input id={t.key} className="input" value={r[t.key] ?? ''} onChange={(e) => patch({ [t.key]: txt(e.target.value) })} />
            )}
          </div>
        ))}
        <div>
          <label className="label" htmlFor="campa">
            Campamento <span className="font-normal text-slate-500">(opcional)</span>
          </label>
          <input id="campa" className="input" placeholder="Ej.: verano 2026" value={r.campa ?? ''} onChange={(e) => patch({ campa: txt(e.target.value) })} />
        </div>
        <div>
          <span className="label">Estado general de la carpa</span>
          <div className="flex flex-wrap gap-2">
            {ESTADOS_GENERALES.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setEstadoGeneral(s)}
                className={`rounded-full border px-3 py-1.5 text-sm ${estadoGeneral === s ? 'border-green-700 bg-green-700 text-white' : 'border-slate-300 bg-white'}`}
              >
                {ESTADO_GENERAL_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        {extraActions}
        <button className="btn-primary flex-1" disabled={saving}>
          {saving ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
