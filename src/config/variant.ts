const buildVariant = (() => {
  try {
    return import.meta.env.VITE_VARIANT || 'full';
  } catch {
    return 'full';
  }
})();

function loadStoredVariant(): string | null {
  try {
    return localStorage.getItem('worldmonitor-variant');
  } catch {
    return null;
  }
}

export const SITE_VARIANT: string = (() => {
  if (typeof window === 'undefined') return buildVariant;

  const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  if (isTauri) {
    const stored = loadStoredVariant();
    if (stored === 'tech' || stored === 'full' || stored === 'finance' || stored === 'happy' || stored === 'commodity' || stored === 'energy' || stored === 'auspex') return stored;
    return buildVariant;
  }

  const h = location.hostname;
  if (h.startsWith('tech.')) return 'tech';
  if (h.startsWith('finance.')) return 'finance';
  if (h.startsWith('happy.')) return 'happy';
  if (h.startsWith('commodity.')) return 'commodity';
  if (h.startsWith('energy.')) return 'energy';
  if (h.startsWith('auspex.')) return 'auspex';

  if (h === 'localhost' || h === '127.0.0.1') {
    const stored = loadStoredVariant();
    if (stored === 'tech' || stored === 'full' || stored === 'finance' || stored === 'happy' || stored === 'commodity' || stored === 'energy' || stored === 'auspex') return stored;
    return buildVariant;
  }

  // No recognized multi-tenant subdomain matched. The shared worldmonitor.app
  // build (VITE_VARIANT unset/'full') relies entirely on the hostname checks
  // above to differentiate tech./finance./etc — buildVariant is 'full' there
  // regardless, so this is a no-op for that deployment. But a standalone,
  // single-variant build deployed to an arbitrary hostname (e.g. AUSPEX on
  // its own Vercel project's *.vercel.app URL, or any future custom domain
  // that isn't a recognized subdomain) has no ambiguity to resolve at
  // runtime — its own build-time VITE_VARIANT is authoritative. Hardcoding
  // 'full' here previously ignored that value for any such hostname.
  return buildVariant;
})();
