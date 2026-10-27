/** One language preference shared by menus, mission copy, canvas labels and voices.
 * Memory remains authoritative when browser storage is unavailable. */
export type Language = 'es' | 'en' | 'fr';
export const LANGUAGE_STORAGE_KEY = 'mm.language';
const supported = (value: unknown): value is Language => value === 'es' || value === 'en' || value === 'fr';
let currentLanguage: Language = 'es';
try {
  const saved = globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY);
  if (supported(saved)) currentLanguage = saved;
} catch { /* Private browsing can deny storage without disabling the selector. */ }

function announce(): void {
  if (typeof document !== 'undefined') document.documentElement.lang = currentLanguage;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('languagechange', { detail: currentLanguage }));
}
if (typeof document !== 'undefined') document.documentElement.lang = currentLanguage;

export function getLanguage(): Language { return currentLanguage; }
export function setLanguage(language: Language): void {
  if (!supported(language) || language === currentLanguage) return;
  currentLanguage = language;
  try { globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* Keep the in-memory preference. */ }
  announce();
}

if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key !== LANGUAGE_STORAGE_KEY && event.key !== null) return;
  const language = supported(event.newValue) ? event.newValue : 'es';
  if (language !== currentLanguage) { currentLanguage = language; announce(); }
});
