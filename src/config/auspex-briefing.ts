// Config for the AUSPEX content-ideation Briefing view (replaces the globe
// dashboard as the auspex variant's default landing route — see
// src/briefing-window.ts). Isolated from feeds.ts/panels.ts so it can be
// tuned without touching the panel/feed registries those files own.

// The 10 categories the Briefing view clusters across: the 5 icounter
// fraud/fintech additions plus the 5 carried-over TECH_FEEDS categories that
// stayed relevant to a fraud/fintech GTM audience. Keep in sync with
// AUSPEX_FEEDS in src/config/feeds.ts if that ever changes.
export const AUSPEX_BRIEFING_CATEGORIES = [
  'fraud',
  'fraudVectors',
  'cryptoFraud',
  'aiFraud',
  'tprm',
  'security',
  'crypto',
  'stablecoins',
  'finance',
  'ai',
] as const;

export type AuspexBriefingCategory = typeof AUSPEX_BRIEFING_CATEGORIES[number];

const DEFAULT_ANGLE_LIMIT = 8;

// How many top-ranked clusters get an AI-generated content angle. Kept small
// (8-10, not 15-20) since each one is an LLM call; tunable via env var since
// the right number depends on how the local LLM provider performs in
// practice. Falls back to DEFAULT_ANGLE_LIMIT for anything non-numeric,
// non-finite, or <= 0.
function resolveAngleLimit(): number {
  try {
    const raw = import.meta.env.VITE_AUSPEX_BRIEFING_ANGLE_LIMIT;
    const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ANGLE_LIMIT;
  } catch {
    return DEFAULT_ANGLE_LIMIT;
  }
}

export const AUSPEX_BRIEFING_ANGLE_LIMIT = resolveAngleLimit();
