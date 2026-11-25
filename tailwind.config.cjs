/**
 * Paleta oficial GeoAlerta.
 *  navy  #17364D  Azul profundo  — navegación, encabezados, confianza institucional
 *  teal  #087F8C  Turquesa       — tecnología, agua, elementos interactivos
 *  gold  #D5A329  Oro            — actividad aurífera, prioridades, acentos
 *  coral #C94C4C  Coral          — alertas y riesgos
 *  ivory #F5F1E8  Marfil         — fondo y legibilidad
 * Las escalas son tintes/sombras de esos 5 colores; `ink` es un neutro derivado del azul.
 * Los nombres de color por defecto de Tailwind se redirigen a la paleta para que ningún
 * componente heredado pueda introducir colores fuera de la identidad.
 */
const navy = { 950: '#0C1E2B', 900: '#17364D', 800: '#1F4763', 700: '#2B5878', 600: '#3F6E93', 500: '#5A87A8', 400: '#7FA2BD', 300: '#A9C0D1', 200: '#CFDCE6', 100: '#E6EDF2', 50: '#F2F6F9' };
const teal = { 950: '#032F34', 900: '#04464E', 800: '#066570', 700: '#087F8C', 600: '#0A93A1', 500: '#23A9B6', 400: '#5CC0C9', 300: '#8FD3DA', 200: '#BEE6EA', 100: '#DDF2F4', 50: '#EEF8F9' };
const gold = { 950: '#3D2D07', 900: '#5C440B', 800: '#7A5A0E', 700: '#9C7414', 600: '#C9951C', 500: '#D5A329', 400: '#E0BA5A', 300: '#EACD86', 200: '#F0DDA6', 100: '#F7EDD0', 50: '#FBF6E7' };
const coral = { 950: '#3F1414', 900: '#621F1F', 800: '#8A2C2C', 700: '#A83B3B', 600: '#C94C4C', 500: '#D46A6A', 400: '#DF8E8E', 300: '#E8AFAF', 200: '#EFC4C4', 100: '#F7E1E1', 50: '#FBF0F0' };
const ivory = { 50: '#FBF9F4', 100: '#F5F1E8', 200: '#EAE4D6', 300: '#DDD5C3', 400: '#C9BFA8' };
const ink = { 950: '#101C26', 900: '#1B2B38', 800: '#2A3B48', 700: '#3A4B59', 600: '#50606D', 500: '#687784', 400: '#8C9BA8', 300: '#BAC4CC', 200: '#DCE2E6', 100: '#EDF0F2', 50: '#F7F8F9' };

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy, teal, gold, coral, ivory, ink,
        // Alias heredados de TERRAMINA → paleta GeoAlerta
        forest: navy, ochre: gold, earth: ink,
        sky: teal, cyan: teal, emerald: teal, green: teal,
        indigo: navy, blue: navy, slate: ink, gray: ink,
        amber: gold, orange: gold, yellow: gold,
        red: coral, rose: coral
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,54,77,0.06), 0 1px 1px rgba(23,54,77,0.04)',
        pop: '0 12px 32px -8px rgba(23,54,77,0.28)'
      }
    }
  },
  plugins: []
};
