// AUSPEX content-ideation Briefing: fetches the 10 fraud/fintech/crypto/AI
// categories and delegates clustering + ranking to auspex-briefing-rank.ts
// (kept separate so that pure logic stays unit-testable under `tsx --test`
// without pulling in Vite-only module-scope reads). Generates a suggested
// content angle for the top-ranked clusters by reusing generateSummary()
// rather than adding new AI plumbing — see src/briefing-window.ts for the
// view that renders this.
import type { NewsItem } from '@/types';
import { FEEDS } from '@/config/feeds';
import { AUSPEX_BRIEFING_CATEGORIES, AUSPEX_BRIEFING_ANGLE_LIMIT, type AuspexBriefingCategory } from '@/config/auspex-briefing';
import { fetchCategoryFeeds } from '@/services/rss';
import { generateSummary } from '@/services/summarization';
import { getCurrentLanguage } from '@/services/i18n';
import {
  buildClusters,
  rankClusters,
  buildHeadlinesForCluster,
  type BriefingCluster,
} from '@/services/auspex-briefing-rank';

export type { BriefingCluster } from '@/services/auspex-briefing-rank';

async function fetchBriefingItems(): Promise<Array<{ item: NewsItem; category: AuspexBriefingCategory }>> {
  const results = await Promise.all(
    AUSPEX_BRIEFING_CATEGORIES.map(async (category) => {
      const feeds = FEEDS[category] ?? [];
      if (feeds.length === 0) return [];
      try {
        const items = await fetchCategoryFeeds(feeds);
        return items.map((item) => ({ item, category }));
      } catch (err) {
        console.warn(`[Briefing] Failed to fetch category "${category}":`, err);
        return [];
      }
    })
  );
  return results.flat();
}

const CONTENT_ANGLE_INSTRUCTION =
  'Ignore the instruction above to just summarize the facts. All headlines above describe ' +
  'the same underlying story (already deduplicated by an upstream clustering step) for a ' +
  'fraud, cybersecurity, and fintech intelligence newsletter. Instead of a summary, write ONE ' +
  'to TWO sentences aimed at a content strategist: why this story matters right now, and a ' +
  'concrete angle or hook for a blog post, LinkedIn post, or short analysis piece about it. ' +
  'Be specific, not generic, and do not just restate the headline.';

export async function generateAngleForCluster(cluster: BriefingCluster): Promise<string | null> {
  const headlines = buildHeadlinesForCluster(cluster.items);
  if (headlines.length < 2) return null;
  try {
    const result = await generateSummary(headlines, undefined, CONTENT_ANGLE_INSTRUCTION, getCurrentLanguage());
    return result?.summary?.trim() || null;
  } catch (err) {
    console.warn('[Briefing] Angle generation failed:', err);
    return null;
  }
}

export interface BuildBriefingResult {
  clusters: BriefingCluster[];
  angleLimit: number;
}

// Fetches, clusters, and ranks the briefing's clusters. Angle generation is
// intentionally left to the caller (generateAngleForCluster) so the view
// can render the ranked list immediately and stream in angles as they
// complete, instead of blocking first paint on N sequential LLM calls.
export async function buildBriefing(): Promise<BuildBriefingResult> {
  const tagged = await fetchBriefingItems();
  const clusters = rankClusters(buildClusters(tagged));
  return { clusters, angleLimit: AUSPEX_BRIEFING_ANGLE_LIMIT };
}
