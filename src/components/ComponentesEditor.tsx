import { Copy } from 'lucide-react';
import { COMPONENTES, ESTADO_LABEL, ESTADOS, type Componente, type EstadoComponentes } from '../../shared/model';
import { ESTADO_COLOR } from './badges';

export function igualFila(a: EstadoComponentes, b: EstadoComponentes, k: Componente): boolean {
  return (
    a[`${k}Estado`] === b[`${k}Estado`] &&
    (a[`${k}Nota`] ?? '') === (b[`${k}Nota`] ?? '') &&
    (k !== 'estacas' || a.estacasCantidad === b.estacasCantidad)
  );
}

/** Los 7 componentes con chips Bien/Regular/Mal/Falta, nota y cantidad de estacas. */
export function ComponentesEditor({
  valor,
  onChange,
  previo,
  etiquetaPrevio = 'Igual que la anterior',
}: {
  valor: EstadoComponentes;
  onChange: (patch: Partial<EstadoComponentes>) => void;
  /** Para el botón "Igual que la anterior" de cada fila. */
  previo?: EstadoComponentes;
  etiquetaPrevio?: string;
}) {
  const txt = (v: string) => (v.trim() ? v : null);
  return (
    <div className="space-y-3">
      {COMPONENTES.map((c) => {
        const estado = valor[`${c.key}Estado`];
        return (
          <div key={c.key} className="card p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-medium">{c.label}</span>
              {previo && !igualFila(valor, previo, c.key) && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-green-800"
                  onClick={() =>
                    onChange({
                      [`${c.key}Estado`]: previo[`${c.key}Estado`],
                      [`${c.key}Nota`]: previo[`${c.key}Nota`],
                      ...(c.key === 'estacas' ? { estacasCantidad: previo.estacasCantidad } : {}),
                    })
                  }
                >
                  <Copy size={12} /> {etiquetaPrevio}
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
                  value={valor.estacasCantidad ?? ''}
                  onChange={(e) => onChange({ estacasCantidad: e.target.value === '' ? null : Math.round(Number(e.target.value)) })}
                />
              )}
              {ESTADOS.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => onChange({ [`${c.key}Estado`]: estado === s ? null : s })}
                  className={`rounded-full border px-3 py-1.5 text-sm ${estado === s ? ESTADO_COLOR[s] + ' font-semibold' : 'border-slate-300 bg-white text-slate-700'}`}
                >
                  {ESTADO_LABEL[s]}
                </button>
              ))}
            </div>
            <input
              className="input mt-2 py-1.5 text-sm"
              placeholder="Nota"
              aria-label={`Nota de ${c.label}`}
              value={valor[`${c.key}Nota`] ?? ''}
              onChange={(e) => onChange({ [`${c.key}Nota`]: txt(e.target.value) })}
            />
          </div>
        );
      })}
    </div>
  );
}
