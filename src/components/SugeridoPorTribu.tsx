import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TRIBUS, type SugeridoPorTribu, type Tribu } from '../../shared/model';

export function cargadas(s: SugeridoPorTribu | null | undefined): number {
  return TRIBUS.filter((t) => s?.[t.key] != null).length;
}

/** Desplegable debajo del nombre de la carpa. */
export function SugeridoDesplegable({ carpaId, sugerido }: { carpaId: string; sugerido: SugeridoPorTribu | null | undefined }) {
  const [abierto, setAbierto] = useState(false);
  const n = cargadas(sugerido);
  return (
    <div className="rounded-lg border border-slate-200">
      <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <Users size={16} className="text-green-700" />
        <span className="flex-1 font-medium">Personas sugeridas por tribu</span>
        <span className="text-xs text-slate-500">{n === 0 ? 'Sin cargar' : `${n} de ${TRIBUS.length}`}</span>
        {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {abierto && (
        <div className="border-t border-slate-200 px-3 py-2">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            {TRIBUS.map((t) => (
              <li key={t.key} className="flex items-baseline justify-between gap-2">
                <span className="text-slate-600">{t.label}</span>
                {sugerido?.[t.key] != null ? <span className="font-semibold">{sugerido[t.key]}</span> : <span className="text-slate-400">—</span>}
              </li>
            ))}
          </ul>
          <Link to={`/carpas/${carpaId}/editar#sugerido`} className="mt-2 inline-block text-sm font-medium text-green-800">
            {n === 0 ? 'Cargar' : 'Editar'}
          </Link>
        </div>
      )}
    </div>
  );
}

/** Para "Editar carpa": un número por tribu, vacío = sin cargar. */
export function SugeridoEditor({ valor, onChange }: { valor: Partial<Record<Tribu, string>>; onChange: (v: Partial<Record<Tribu, string>>) => void }) {
  return (
    <div id="sugerido" className="scroll-mt-20">
      <span className="label">Personas sugeridas por tribu</span>
      <p className="mb-2 text-xs text-slate-500">Cuántos de cada tribu entran bien en esta carpa. Se ve al armar un evento. Lo que no sepas, dejalo vacío.</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {TRIBUS.map((t) => (
          <label key={t.key} className="block">
            <span className="mb-1 block truncate text-center text-xs text-slate-600">{t.label}</span>
            <input
              className="input py-1.5 text-center"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              aria-label={`Personas sugeridas: ${t.label}`}
              value={valor[t.key] ?? ''}
              onChange={(e) => onChange({ ...valor, [t.key]: e.target.value })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export function aTexto(s: SugeridoPorTribu | null | undefined): Partial<Record<Tribu, string>> {
  return Object.fromEntries(TRIBUS.map((t) => [t.key, s?.[t.key]?.toString() ?? '']));
}

export function deTexto(v: Partial<Record<Tribu, string>>): SugeridoPorTribu | null {
  const out: SugeridoPorTribu = {};
  for (const t of TRIBUS) {
    const s = v[t.key]?.trim();
    const n = s ? Math.round(Number(s)) : NaN;
    if (Number.isFinite(n) && n >= 0) out[t.key] = Math.min(n, 100);
  }
  return Object.keys(out).length ? out : null;
}
