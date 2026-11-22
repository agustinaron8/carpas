import colors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

/*
 * Modo oscuro sin tocar cada pantalla: cada color usado es una variable CSS. En `.dark` se invierte la
 * escala (50 ↔ 950, 100 ↔ 900…) y `white` pasa a ser el fondo de las tarjetas. Así `bg-green-100
 * text-green-800` queda como etiqueta oscura con texto claro. `brand` y `on-brand` no cambian.
 */
const FAMILIAS = ['slate', 'green', 'red', 'amber', 'purple', 'yellow', 'sky'];
const TONOS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const ref = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

const paleta = { white: ref('white'), black: colors.black, transparent: 'transparent', current: 'currentColor' };
const claro = { '--c-white': rgb('#ffffff') };
const oscuro = { '--c-white': rgb(colors.slate[900]) };
for (const f of FAMILIAS) {
  paleta[f] = {};
  TONOS.forEach((t, i) => {
    paleta[f][t] = ref(`${f}-${t}`);
    claro[`--c-${f}-${t}`] = rgb(colors[f][t]);
    oscuro[`--c-${f}-${t}`] = rgb(colors[f][TONOS[TONOS.length - 1 - i]]);
  });
}
// Fondo de la página en oscuro: un poco más oscuro que las tarjetas.
oscuro['--c-slate-50'] = rgb('#020617');

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    colors: {
      ...paleta,
      brand: { DEFAULT: colors.green[700], hover: colors.green[800] },
      'on-brand': '#ffffff',
    },
    extend: {},
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({ ':root': { ...claro, 'color-scheme': 'light' }, '.dark': { ...oscuro, 'color-scheme': 'dark' } });
    }),
  ],
};
