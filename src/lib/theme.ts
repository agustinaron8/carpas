// Tema claro/oscuro. "sistema" sigue al celular; la elección se guarda en este dispositivo.
export type Tema = 'sistema' | 'claro' | 'oscuro';

const KEY = 'carpas.tema';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getTema(): Tema {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'claro' || v === 'oscuro') return v;
  } catch {
    // sin almacenamiento: sigue al sistema
  }
  return 'sistema';
}

export function esOscuro(tema = getTema()): boolean {
  return tema === 'oscuro' || (tema === 'sistema' && media().matches);
}

export function aplicarTema(tema = getTema()): void {
  const oscuro = esOscuro(tema);
  document.documentElement.classList.toggle('dark', oscuro);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0f172a' : '#166534');
  for (const fn of subs) fn();
}

export function setTema(tema: Tema): void {
  try {
    if (tema === 'sistema') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, tema);
  } catch {
    // se aplica igual en esta sesión
  }
  aplicarTema(tema);
}

const subs = new Set<() => void>();
export function onTema(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** Si sigue al sistema, cambia cuando el celular cambia de modo. */
export function seguirSistema(): void {
  media().addEventListener('change', () => {
    if (getTema() === 'sistema') aplicarTema('sistema');
  });
}
