// Drop-in additions to FEEDS in a new src/config/variants/icounter.ts
// (start by copying src/config/variants/tech.ts, then merge these categories in)
//
// NOTE: RSS URLs for smaller trade-press outlets change more often than major
// outlets. Test each feed after cloning before relying on it in production;
// swap dead ones for the Google News RSS search pattern used below, which is
// the most durable option since it doesn't depend on a publisher's own feed.

import type { Feed } from '@/types';
import { rssProxyUrl } from '@/utils';

const rss = rssProxyUrl;

export const ICOUNTER_FEED_ADDITIONS: Record<string, Feed[]> = {
  // Cyber-Enabled Fraud — general
  fraud: [
    { name: 'BankInfoSecurity', url: rss('https://www.bankinfosecurity.com/rss-feeds') },
    { name: 'GovInfoSecurity', url: rss('https://www.govinfosecurity.com/rss-feeds') },
    { name: 'PYMNTS', url: rss('https://www.pymnts.com/feed/') },
    { name: 'Payments Dive', url: rss('https://www.paymentsdive.com/feeds/news/') },
    { name: 'Finextra', url: rss('https://www.finextra.com/rss/finextra.aspx') },
    { name: 'ACAMS moneylaundering.com', url: rss('https://www.moneylaundering.com/feed/') },
    { name: 'Fraud Magazine (ACFE)', url: rss('https://news.google.com/rss/search?q=site:fraud-magazine.com&hl=en-US&gl=US&ceid=US:en') },
    { name: 'FinCEN Advisories', url: rss('https://news.google.com/rss/search?q=FinCEN+advisory+OR+FinCEN+alert+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'DOJ Fraud Press Releases', url: rss('https://news.google.com/rss/search?q=site:justice.gov+fraud+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'FBI IC3 / Cyber Division', url: rss('https://news.google.com/rss/search?q=FBI+IC3+OR+"FBI+cyber"+fraud+when:5d&hl=en-US&gl=US&ceid=US:en') },
  ],

  // Priority scenario vectors — mapped to the six MVP scenarios
  fraudVectors: [
    { name: 'Synthetic Identity Fraud', url: rss('https://news.google.com/rss/search?q="synthetic+identity"+fraud+when:5d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Authorized Push Payment Fraud', url: rss('https://news.google.com/rss/search?q="authorized+push+payment"+OR+APP+fraud+when:5d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Account Takeover', url: rss('https://news.google.com/rss/search?q="account+takeover"+fraud+when:5d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Mule Networks', url: rss('https://news.google.com/rss/search?q="money+mule"+OR+"mule+network"+when:5d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Check Fraud', url: rss('https://news.google.com/rss/search?q="check+fraud"+OR+"check+washing"+when:5d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Credit Mule Schemes', url: rss('https://news.google.com/rss/search?q="credit+mule"+OR+"bust-out+fraud"+when:7d&hl=en-US&gl=US&ceid=US:en') },
  ],

  // Crypto / Stablecoin fraud specifically (distinct from tech.ts's general "crypto" category)
  cryptoFraud: [
    { name: 'Stablecoin Fraud & Regulation', url: rss('https://news.google.com/rss/search?q=stablecoin+fraud+OR+stablecoin+regulation+when:5d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Crypto Exchange Hacks', url: rss('https://news.google.com/rss/search?q=crypto+exchange+hack+OR+"crypto+scam"+when:5d&hl=en-US&gl=US&ceid=US:en') },
  ],

  // AI-enabled fraud — the sharper "AI" angle for a counter-fraud audience
  aiFraud: [
    { name: 'Deepfake Fraud', url: rss('https://news.google.com/rss/search?q=deepfake+fraud+OR+"voice+cloning"+scam+when:5d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'AI-Generated Synthetic Identity', url: rss('https://news.google.com/rss/search?q=AI+"synthetic+identity"+OR+AI+generated+identity+fraud+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'AI Regulation (Financial Sector)', url: rss('https://news.google.com/rss/search?q="AI+regulation"+bank+OR+financial+when:7d&hl=en-US&gl=US&ceid=US:en') },
  ],

  // Third-Party Risk Management — closes the gap with iCOUNTER's four-domain
  // intel taxonomy (Third-Party Risk was in the original CTOS scope but
  // hadn't made it into AUSPEX until now).
  tprm: [
    { name: 'Third-Party Breach Disclosures', url: rss('https://news.google.com/rss/search?q="third+party"+OR+vendor+breach+when:5d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Supply Chain Compromise', url: rss('https://news.google.com/rss/search?q="supply+chain+attack"+OR+"supply+chain+compromise"+when:5d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Fourth-Party Risk', url: rss('https://news.google.com/rss/search?q="fourth+party"+risk+OR+"fourth-party+risk"+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Vendor Risk Management', url: rss('https://news.google.com/rss/search?q="vendor+risk+management"+OR+"third+party+risk"+when:5d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Concentration Risk / Critical Vendors', url: rss('https://news.google.com/rss/search?q="vendor+concentration+risk"+OR+"critical+vendor"+regulatory+when:7d&hl=en-US&gl=US&ceid=US:en') },
  ],
};

// Suggested PANELS entries to merge alongside the existing tech.ts panel config
export const ICOUNTER_PANEL_ADDITIONS = {
  fraud: { name: 'Cyber-Enabled Fraud', enabled: true, priority: 1 },
  fraudVectors: { name: 'Fraud Scenario Watch', enabled: true, priority: 1 },
  cryptoFraud: { name: 'Crypto & Stablecoin Fraud', enabled: true, priority: 1 },
  aiFraud: { name: 'AI-Enabled Fraud', enabled: true, priority: 1 },
  tprm: { name: 'Third-Party Risk', enabled: true, priority: 1 },
};
