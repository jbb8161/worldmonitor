// Unit coverage for the AUSPEX Briefing's pure clustering/ranking/padding
// logic (src/services/auspex-briefing-rank.ts). Kept in its own
// dependency-light module specifically so it's importable here without
// pulling in Vite-only module-scope reads (see that file's header comment).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { NewsItem } from '@/types';
import {
  buildClusters,
  rankClusters,
  buildHeadlinesForCluster,
  scoreCluster,
} from '@/services/auspex-briefing-rank';

function item(overrides: Partial<NewsItem> & { title: string }): NewsItem {
  return {
    source: 'Test Source',
    link: 'https://example.com/a',
    pubDate: new Date(),
    isAlert: false,
    ...overrides,
  };
}

describe('buildClusters', () => {
  it('groups near-duplicate headlines from different sources into one cluster', () => {
    const tagged = [
      { item: item({ title: 'SEC fines crypto exchange $50M for AML failures', source: 'Reuters' }), category: 'cryptoFraud' as const },
      { item: item({ title: 'SEC fines crypto exchange $50 million for anti-money-laundering failures', source: 'Bloomberg' }), category: 'cryptoFraud' as const },
      { item: item({ title: 'New AI model beats benchmark on reasoning tasks', source: 'TechCrunch' }), category: 'ai' as const },
    ];

    const clusters = buildClusters(tagged);
    assert.equal(clusters.length, 2);

    const merged = clusters.find((c) => c.items.length === 2);
    assert.ok(merged, 'the two SEC-fine headlines should merge into one cluster');
    assert.deepEqual(new Set(merged!.items.map((i) => i.source)), new Set(['Reuters', 'Bloomberg']));

    const singleton = clusters.find((c) => c.items.length === 1);
    assert.ok(singleton);
    assert.equal(singleton!.items[0]!.title, 'New AI model beats benchmark on reasoning tasks');
  });

  it('carries every contributing category onto the cluster, deduplicated', () => {
    const tagged = [
      { item: item({ title: 'Stablecoin issuer accused of reserve fraud in new lawsuit' }), category: 'cryptoFraud' as const },
      { item: item({ title: 'Stablecoin issuer accused of reserve fraud in new lawsuit', source: 'Other Source' }), category: 'stablecoins' as const },
    ];
    const [cluster] = buildClusters(tagged);
    assert.deepEqual(cluster!.categories.slice().sort(), ['cryptoFraud', 'stablecoins']);
  });

  it('starts every cluster as angle-pending with no angle yet', () => {
    const [cluster] = buildClusters([{ item: item({ title: 'Some fraud story' }), category: 'fraud' as const }]);
    assert.equal(cluster!.angleStatus, 'pending');
    assert.equal(cluster!.angle, null);
  });
});

describe('scoreCluster', () => {
  it('scores a fresh, multi-source, enforcement-keyword story higher than a stale singleton', () => {
    const now = Date.now();
    const strong = [
      item({ title: 'DOJ indicts fintech founder for wire fraud', source: 'Reuters', pubDate: new Date(now) }),
      item({ title: 'DOJ indicts fintech founder for wire fraud scheme', source: 'AP News', pubDate: new Date(now) }),
    ];
    const weak = [
      item({ title: 'Startup announces new logo', source: 'Random Blog', pubDate: new Date(now - 30 * 24 * 60 * 60 * 1000) }),
    ];
    assert.ok(scoreCluster(strong) > scoreCluster(weak));
  });

  it('does not require corroboration to score above zero — singletons stay in contention', () => {
    const singleton = [item({ title: 'Regulator fines payments firm for KYC gaps' })];
    assert.ok(scoreCluster(singleton) > 0);
  });
});

describe('rankClusters', () => {
  it('sorts clusters by score descending without mutating the input array', () => {
    const clusters = buildClusters([
      { item: item({ title: 'Old unremarkable story', pubDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }), category: 'ai' as const },
      { item: item({ title: 'DOJ charges executive with fraud today', pubDate: new Date() }), category: 'fraud' as const },
    ]);
    const input = [...clusters];
    const ranked = rankClusters(clusters);

    assert.deepEqual(clusters, input, 'rankClusters must not mutate its input');
    assert.ok(ranked[0]!.score >= ranked[1]!.score);
    assert.equal(ranked[0]!.items[0]!.title, 'DOJ charges executive with fraud today');
  });
});

describe('buildHeadlinesForCluster', () => {
  it('returns deduplicated titles as-is when the cluster already has 2+ distinct headlines', () => {
    const items = [
      item({ title: 'Headline A' }),
      item({ title: 'Headline B' }),
    ];
    assert.deepEqual(buildHeadlinesForCluster(items), ['Headline A', 'Headline B']);
  });

  it('pads a singleton cluster using the snippet when it adds real information', () => {
    const items = [item({ title: 'Exchange breached, $10M stolen', snippet: 'Attackers exploited a smart-contract bug to drain funds overnight.' })];
    const headlines = buildHeadlinesForCluster(items);
    assert.equal(headlines.length, 2);
    assert.equal(headlines[0], 'Exchange breached, $10M stolen');
    assert.equal(headlines[1], 'Attackers exploited a smart-contract bug to drain funds overnight.');
  });

  it('pads a singleton cluster by duplicating the title when there is no usable snippet', () => {
    const items = [item({ title: 'Exchange breached, $10M stolen' })];
    assert.deepEqual(buildHeadlinesForCluster(items), ['Exchange breached, $10M stolen', 'Exchange breached, $10M stolen']);
  });

  it('does not pad with a snippet identical to the title', () => {
    const items = [item({ title: 'Exchange breached, $10M stolen', snippet: 'Exchange breached, $10M stolen' })];
    assert.deepEqual(buildHeadlinesForCluster(items), ['Exchange breached, $10M stolen', 'Exchange breached, $10M stolen']);
  });

  it('never returns fewer than 2 headlines, satisfying generateSummary()\'s minimum', () => {
    const items = [item({ title: 'Solo story' })];
    assert.ok(buildHeadlinesForCluster(items).length >= 2);
  });
});
