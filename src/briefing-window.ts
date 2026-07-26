// AUSPEX content-ideation Briefing: the variant's default landing view
// (replaces the globe/map dashboard — still reachable at /globe). Ranks
// clustered stories across the 10 fraud/fintech/crypto/security/AI
// categories and surfaces a suggested content angle for the top-ranked
// ones. See src/services/auspex-briefing.ts for the fetch/cluster/rank/
// angle-generation logic this view renders.
import { joinSafeHtml, safeHtml, safeUrlAttr, type SafeHtml } from '@/utils/sanitize';
import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';
import { effectivePubDateMs } from '@/services/feed-date';
import {
  buildBriefing,
  generateAngleForCluster,
  type BriefingCluster,
} from '@/services/auspex-briefing';

function formatTimeAgo(epochMs: number): string {
  if (!epochMs) return '';
  const diffMs = Date.now() - epochMs;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function renderAngleBody(cluster: BriefingCluster): SafeHtml {
  if (cluster.angleStatus === 'ready' && cluster.angle) {
    return safeHtml`<p class="briefing-card-angle-text">${cluster.angle}</p>`;
  }
  if (cluster.angleStatus === 'generating') {
    return safeHtml`<p class="briefing-card-angle-pending">Generating content angle…</p>`;
  }
  if (cluster.angleStatus === 'unavailable') {
    return safeHtml`<p class="briefing-card-angle-pending">No content angle available.</p>`;
  }
  return safeHtml``;
}

function renderRelatedHeadlines(cluster: BriefingCluster): SafeHtml {
  if (cluster.items.length <= 1) return safeHtml``;
  const rest = cluster.items.slice(1);
  const rows = joinSafeHtml(
    rest.map((item) => safeHtml`<li><a href="${safeUrlAttr(item.link)}" target="_blank" rel="noopener noreferrer">${item.title}</a> <span class="briefing-card-related-source">— ${item.source}</span></li>`)
  );
  return safeHtml`<details class="briefing-card-related"><summary>${String(rest.length)} related headline${rest.length === 1 ? '' : 's'}</summary><ul>${rows}</ul></details>`;
}

function renderCard(cluster: BriefingCluster, rank: number): SafeHtml {
  const primary = cluster.items[0];
  if (!primary) return safeHtml``;
  const distinctSources = new Set(cluster.items.map((i) => i.source)).size;
  const newestMs = Math.max(...cluster.items.map((i) => effectivePubDateMs(i)));
  const categoryLabel = cluster.categories.join(' · ');

  return safeHtml`<article class="briefing-card" data-cluster-id="${cluster.id}">
    <div class="briefing-card-rank">#${String(rank)}</div>
    <div class="briefing-card-body">
      <div class="briefing-card-meta">
        <span class="briefing-card-sources">${String(distinctSources)} source${distinctSources === 1 ? '' : 's'}</span>
        <span class="briefing-card-categories">${categoryLabel}</span>
        <span class="briefing-card-freshness">${formatTimeAgo(newestMs)}</span>
      </div>
      <h2 class="briefing-card-headline"><a href="${safeUrlAttr(primary.link)}" target="_blank" rel="noopener noreferrer">${primary.title}</a></h2>
      <div class="briefing-card-angle" data-angle-status="${cluster.angleStatus}">${renderAngleBody(cluster)}</div>
      ${renderRelatedHeadlines(cluster)}
    </div>
  </article>`;
}

function updateCardAngle(cluster: BriefingCluster): void {
  const card = document.querySelector<HTMLElement>(`.briefing-card[data-cluster-id="${cluster.id}"] .briefing-card-angle`);
  if (!card) return;
  card.dataset.angleStatus = cluster.angleStatus;
  setTrustedHtml(card, trustedHtml(renderAngleBody(cluster).toString(), 'briefing angle update — content pre-escaped via safeHtml'));
}

function setStatus(message: string): void {
  const el = document.getElementById('briefingStatus');
  if (el) el.textContent = message;
}

function renderList(clusters: BriefingCluster[]): void {
  const listEl = document.getElementById('briefingList');
  if (!listEl) return;
  if (clusters.length === 0) {
    setTrustedHtml(listEl, trustedHtml('<p class="briefing-empty">No stories found. Feeds may be unreachable — try refreshing.</p>', 'briefing empty state, static string'));
    return;
  }
  const cards = joinSafeHtml(clusters.map((cluster, i) => renderCard(cluster, i + 1)));
  setTrustedHtml(listEl, trustedHtml(cards.toString(), 'briefing card list — content pre-escaped via safeHtml'));
}

async function generateAnglesSequentially(clusters: BriefingCluster[], angleLimit: number): Promise<void> {
  const targets = clusters.slice(0, angleLimit);
  for (const cluster of targets) {
    cluster.angleStatus = 'generating';
    updateCardAngle(cluster);
    const angle = await generateAngleForCluster(cluster);
    cluster.angle = angle;
    cluster.angleStatus = angle ? 'ready' : 'unavailable';
    updateCardAngle(cluster);
  }
}

async function loadBriefing(): Promise<void> {
  setStatus('Loading feeds…');
  try {
    const { clusters, angleLimit } = await buildBriefing();
    setStatus(clusters.length > 0
      ? `${clusters.length} clustered ${clusters.length === 1 ? 'story' : 'stories'} — generating angles for the top ${Math.min(angleLimit, clusters.length)}…`
      : '');
    renderList(clusters);
    await generateAnglesSequentially(clusters, angleLimit);
    setStatus(`${clusters.length} clustered ${clusters.length === 1 ? 'story' : 'stories'}`);
  } catch (err) {
    console.error('[Briefing] Failed to load:', err);
    setStatus('Failed to load the briefing. Try refreshing.');
  }
}

export function initBriefingView(): void {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  document.title = 'AUSPEX Briefing';

  setTrustedHtml(appEl, trustedHtml(`
    <div class="briefing-shell">
      <header class="briefing-header">
        <div class="briefing-header-text">
          <span class="briefing-title">AUSPEX Briefing</span>
          <p class="briefing-subtitle">Ranked story clusters worth turning into content — across fraud, crypto, security, and fintech feeds.</p>
        </div>
        <div class="briefing-header-actions">
          <button type="button" class="briefing-refresh-btn" id="briefingRefresh">Refresh</button>
          <a class="briefing-globe-link" href="/globe">Open Globe Dashboard &rarr;</a>
        </div>
      </header>
      <div class="briefing-status" id="briefingStatus"></div>
      <div class="briefing-list" id="briefingList"></div>
    </div>
  `, 'briefing view shell — static markup, no interpolation'));

  document.getElementById('briefingRefresh')?.addEventListener('click', () => {
    void loadBriefing();
  });

  void loadBriefing();
}
