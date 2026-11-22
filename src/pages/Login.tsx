import { Tent } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login, puedeEntrarSinSenal } from '../lib/api';
import { startSync, syncNow } from '../sync/syncService';

export function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const [params] = useSearchParams();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(password);
      startSync();
      void syncNow();
      const next = params.get('next');
      nav(next && next.startsWith('/') ? next : '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center gap-2 text-green-800">
          <Tent size={48} />
          <h1 className="text-2xl font-semibold">Carpas del grupo</h1>
        </div>
        <div>
          <label className="label" htmlFor="pw">
            Contraseña del grupo
          </label>
          <input
            id="pw"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy || !password}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="text-center text-xs text-slate-500">
          {puedeEntrarSinSenal()
            ? 'Este celular ya entró antes: se puede entrar aunque no haya señal.'
            : 'La primera vez hace falta señal. Después, la app funciona sin señal.'}
        </p>
      </form>
    </div>
  );
}
