// AUSPEX content-ideation Briefing: fetches the 10 fraud/fintech/crypto/AI
// categories and delegates clustering + ranking to auspex-briefing-rank.ts
// (kept separate so that pure logic stays unit-testable under `tsx --test`
// without pulling in Vite-only module-scope reads). Generates a suggested
// content angle for the top-ranked clusters by reusing the same
// SummarizeArticle RPC + provider chain generateSummary() uses, rather than
// adding new AI plumbing — see src/briefing-window.ts for the view that
// renders this.
import type { NewsItem } from '@/types';
import { FEEDS } from '@/config/feeds';
import { SITE_VARIANT } from '@/config/variant';
import { AUSPEX_BRIEFING_CATEGORIES, AUSPEX_BRIEFING_ANGLE_LIMIT, type AuspexBriefingCategory } from '@/config/auspex-briefing';
import { fetchCategoryFeeds } from '@/services/rss';
import { generateSummary, newsClient, API_PROVIDERS } from '@/services/summarization';
import { isFeatureAvailable } from '@/services/runtime-config';
import { getCurrentLanguage } from '@/services/i18n';
import { getRpcErrorStatusCode } from '@/services/rpc-client';
import { mlWorker } from '@/services/ml-worker';
import {
  buildClusters,
  rankClusters,
  buildHeadlinesForCluster,
  type BriefingCluster,
} from '@/services/auspex-briefing-rank';

export type { BriefingCluster } from '@/services/auspex-briefing-rank';

// ============================================================================
// TEMP DEBUG — added to diagnose "No content angle available." showing for
// every cluster on the AUSPEX Briefing. Records the real outcome of each
// provider attempt (ollama/openrouter/groq, dispatched via the
// SummarizeArticle RPC) plus the final browser-T5 fallback, per cluster, so
// briefing-window.ts can render it instead of the generic unavailable text.
// STRIP THIS BLOCK (and its two capture sites in tryAngleProvider /
// generateAngleForCluster below) out once the angle-generation failure is
// root-caused — search "TEMP DEBUG" repo-wide for the rest of this
// instrumentation.
export interface AngleProviderAttemptDebug {
  provider: string;
  outcome: 'skipped' | 'success' | 'server_error' | 'exception';
  status?: string;
  statusDetail?: string;
  error?: string;
  errorType?: string;
  exceptionMessage?: string;
  httpStatus?: number;
}
export interface AngleBrowserT5Debug {
  mlWorkerAvailable: boolean;
  outcome: 'success' | 'null' | 'exception';
  exceptionMessage?: string;
}
export interface AngleClusterDebug {
  attempts: AngleProviderAttemptDebug[];
  browserT5: AngleBrowserT5Debug | null;
}
const angleDebugByCluster = new Map<string, AngleClusterDebug>();
export function getAngleDebugInfo(clusterId: string): AngleClusterDebug | null {
  return angleDebugByCluster.get(clusterId) ?? null;
}
export function resetAngleDebugInfo(): void {
  angleDebugByCluster.clear();
}
function angleDebugEntry(clusterId: string): AngleClusterDebug {
  let entry = angleDebugByCluster.get(clusterId);
  if (!entry) {
    entry = { attempts: [], browserT5: null };
    angleDebugByCluster.set(clusterId, entry);
  }
  return entry;
}
function recordAngleAttempt(clusterId: string, attempt: AngleProviderAttemptDebug): void {
  angleDebugEntry(clusterId).attempts.push(attempt);
}
function recordBrowserT5Debug(clusterId: string, info: AngleBrowserT5Debug): void {
  angleDebugEntry(clusterId).browserT5 = info;
}
// END TEMP DEBUG block header.
// ============================================================================

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

// generateSummary()'s API-provider dispatch is gated behind
// canAttemptServerSummarization() (hasPremiumAccess()) BEFORE any network
// call — see src/services/summarize-gate.ts. That gate exists to stop anon/
// free callers on the hosted worldmonitor.app deployment from fanning out
// doomed premium-gated RPCs; it isn't about AUSPEX at all. AUSPEX's
// server-side counterpart (summarize-article.ts's requiresPremium check) is
// scoped separately, to deployments with no Clerk/Convex configured (see
// that file), so this dispatches straight to the RPC via the same ungated
// `newsClient` translateText() uses, instead of going through
// tryApiProvider() and tripping the unrelated client-side gate.
async function tryAngleProvider(provider: (typeof API_PROVIDERS)[number]['provider'], headlines: string[], lang: string, clusterId: string): Promise<string | null> {
  try {
    const resp = await newsClient.summarizeArticle({
      provider,
      headlines,
      mode: 'brief',
      geoContext: CONTENT_ANGLE_INSTRUCTION,
      variant: SITE_VARIANT,
      lang,
      systemAppend: '',
      bodies: [],
    });
    if (resp.fallback || resp.status === 'SUMMARIZE_STATUS_SKIPPED') {
      // TEMP DEBUG — see block comment above for the strip-out plan. This is
      // the branch that previously discarded resp.error/errorType/statusDetail
      // for BOTH a deliberate skip (no credentials) and a genuine upstream
      // failure (summarize-article.ts's catch sets fallback:true either way).
      recordAngleAttempt(clusterId, {
        provider,
        outcome: resp.status === 'SUMMARIZE_STATUS_SKIPPED' ? 'skipped' : 'server_error',
        status: resp.status,
        statusDetail: resp.statusDetail,
        error: resp.error,
        errorType: resp.errorType,
      });
      return null;
    }
    const summary = typeof resp.summary === 'string' ? resp.summary.trim() : '';
    // TEMP DEBUG
    recordAngleAttempt(clusterId, {
      provider,
      outcome: summary ? 'success' : 'server_error',
      status: resp.status,
      statusDetail: resp.statusDetail,
      error: resp.error,
      errorType: resp.errorType,
    });
    return summary || null;
  } catch (err) {
    console.warn(`[Briefing] Angle provider "${provider}" failed:`, err);
    // TEMP DEBUG — covers a thrown RPC error (transport failure, non-2xx
    // response the client library rejects on, etc.) rather than an in-band
    // SummarizeArticleResponse. getRpcErrorStatusCode() surfaces the real
    // HTTP status when the client attached one.
    recordAngleAttempt(clusterId, {
      provider,
      outcome: 'exception',
      exceptionMessage: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      httpStatus: getRpcErrorStatusCode(err),
    });
    return null;
  }
}

export async function generateAngleForCluster(cluster: BriefingCluster): Promise<string | null> {
  const headlines = buildHeadlinesForCluster(cluster.items);
  if (headlines.length < 2) return null;
  const lang = getCurrentLanguage();

  for (const providerDef of API_PROVIDERS) {
    if (!isFeatureAvailable(providerDef.featureId)) continue;
    const angle = await tryAngleProvider(providerDef.provider, headlines, lang, cluster.id);
    if (angle) return angle;
  }

  // No configured server provider produced an angle (none configured, or the
  // deployment's requiresPremium check didn't bypass) — fall back to the
  // shared browser-T5 path so the feature still returns something instead of
  // nothing. skipCloudProviders avoids redundantly re-trying the providers
  // just attempted above through the (differently-gated) generateSummary().
  const mlWorkerAvailable = mlWorker.isAvailable; // TEMP DEBUG
  try {
    const result = await generateSummary(headlines, undefined, CONTENT_ANGLE_INSTRUCTION, lang, { skipCloudProviders: true });
    // TEMP DEBUG
    recordBrowserT5Debug(cluster.id, { mlWorkerAvailable, outcome: result?.summary ? 'success' : 'null' });
    return result?.summary?.trim() || null;
  } catch (err) {
    console.warn('[Briefing] Browser-T5 angle fallback failed:', err);
    // TEMP DEBUG
    recordBrowserT5Debug(cluster.id, {
      mlWorkerAvailable,
      outcome: 'exception',
      exceptionMessage: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    });
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
