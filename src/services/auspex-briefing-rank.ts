// Pure clustering + ranking logic for the AUSPEX Briefing (see
// src/services/auspex-briefing.ts for the fetch/AI-angle orchestration that
// wraps this). Deliberately kept free of feeds.ts/rss.ts/summarization.ts —
// those pull in Vite-only module-scope reads (import.meta.env, the ml.worker
// Vite import) that crash under plain Node — so this module stays importable
// from `tsx --test` for direct unit coverage of the scoring/padding logic.
import type { NewsItem } from '@/types';
import { getSourceTier } from '../../server/_shared/source-tiers';
import { effectivePubDateMs } from '@/services/feed-date';
import { clusterTexts } from '../../shared/story-identity.js';
import type { AuspexBriefingCategory } from '@/config/auspex-briefing';

export interface BriefingCluster {
  id: string;
  items: NewsItem[];
  categories: AuspexBriefingCategory[];
  score: number;
  angle: string | null;
  angleStatus: 'pending' | 'generating' | 'ready' | 'unavailable';
}

const RECENCY_HALF_LIFE_HOURS = 18;

// Terms that tend to mark a fraud/fintech/crypto story as an enforcement,
// litigation, or incident story — exactly the kind of single-source
// regulatory/enforcement item that's often worth writing about even
// without corroboration from other outlets.
const WORTH_WRITING_ABOUT_PATTERN = /\b(fine[ds]?|penalt(?:y|ies)|settl(?:e|ed|ement)|indict(?:ed|ment)|charge[ds]?|lawsuit|sue[ds]?|sec|cftc|fincen|doj|ftc|enforc\w*|sanction\w*|breach\w*|hack(?:ed|er)?|exploit\w*|vulnerab\w*|cve-\d|ransomware|phishing|scam\w*|fraud\w*|launder\w*|seiz\w*|arrest\w*|guilty|convict\w*|ban(?:ned)?|warn\w*|regulat\w*|complian\w*|whistleblow\w*)\b/i;

export function scoreCluster(items: NewsItem[]): number {
  const newestMs = Math.max(...items.map((i) => effectivePubDateMs(i)));
  const ageHours = newestMs > 0 ? Math.max(0, (Date.now() - newestMs) / (1000 * 60 * 60)) : Infinity;
  const recencyScore = Number.isFinite(ageHours) ? Math.exp(-ageHours / RECENCY_HALF_LIFE_HOURS) : 0;

  const distinctSources = new Set(items.map((i) => i.source)).size;
  const corroborationScore = Math.min(1, (distinctSources - 1) / 4);

  const bestTier = Math.min(...items.map((i) => getSourceTier(i.source)));
  const sourceTierScore = Math.max(0, 5 - bestTier) / 4;

  const keywordScore = items.some((i) => WORTH_WRITING_ABOUT_PATTERN.test(i.title)) ? 1 : 0;

  return recencyScore * 0.35 + corroborationScore * 0.25 + sourceTierScore * 0.2 + keywordScore * 0.2;
}

export function buildClusters(tagged: Array<{ item: NewsItem; category: AuspexBriefingCategory }>): BriefingCluster[] {
  const titles = tagged.map((t) => t.item.title);
  const groups = clusterTexts(titles);

  return groups.map((memberIndexes, i) => {
    const members = memberIndexes.map((idx) => tagged[idx]!);
    const items = members.map((m) => m.item);
    const categories = Array.from(new Set(members.map((m) => m.category)));
    return {
      id: `cluster-${i}`,
      items,
      categories,
      score: scoreCluster(items),
      angle: null,
      angleStatus: 'pending',
    };
  });
}

export function rankClusters(clusters: BriefingCluster[]): BriefingCluster[] {
  return [...clusters].sort((a, b) => b.score - a.score);
}

// generateSummary() requires >= 2 headlines. Singleton (single-source)
// clusters are deliberately NOT skipped for angle generation — a
// single-source regulatory/enforcement story is often exactly what's
// worth writing about in this space — so pad the array with the item's
// snippet (if it adds real information) or, failing that, a duplicate of
// the title. This satisfies generateSummary()'s length check without
// changing that function's contract for its other callers.
export function buildHeadlinesForCluster(items: NewsItem[]): string[] {
  const titles = Array.from(new Set(items.map((i) => i.title.trim()).filter(Boolean)));
  if (titles.length >= 2) return titles;

  const only = items[0];
  if (!only) return titles;
  const snippet = only.snippet?.trim();
  if (snippet && snippet !== only.title.trim()) {
    return [only.title, snippet];
  }
  return [only.title, only.title];
}
