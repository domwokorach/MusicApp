import { ACCENT_PALETTE } from '@/constants/colors';

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Multiply each channel by `factor` (<1 darkens). */
export function shade(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex).map((c) => Math.max(0, Math.min(255, Math.round(c * factor))));
  return `rgb(${r}, ${g}, ${b})`;
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Stable accent colour for a string id (used for artwork placeholders and the player gradient). */
export function colorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
