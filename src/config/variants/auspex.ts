// AUSPEX variant - cybersecurity, fintech, crypto/stablecoin, and fraud
// intelligence dashboard. Forked from the tech/AI variant (tech.ts),
// merged with the icounter fraud/fintech feed additions, and stripped of
// tech.ts's startup/VC-ecosystem categories (startups, vcblogs,
// regionalStartups, unicorns, accelerators, producthunt, hardware, cloud,
// dev, layoffs) — noise for a fraud/fintech GTM audience.
import type { PanelConfig, MapLayers } from '@/types';
import type { VariantConfig } from './base';

// Re-export base config
export * from './base';

// Tech-specific exports (carried over from tech.ts)
export * from '../tech-companies';
export * from '../ai-research-labs';
export * from '../startup-ecosystems';
export * from '../ai-regulations';

// Tech-focused feeds (subset of full feeds config)
export {
  SOURCE_TIERS,
  getSourceTier,
  SOURCE_TYPES,
  getSourceType,
  getSourcePropagandaRisk,
  type SourceRiskProfile,
  type SourceType,
} from '../feeds';

// AUSPEX FEEDS configuration: tech.ts's feeds (minus the dropped
// startup/VC-ecosystem categories) + icounter fraud/fintech additions
import type { Feed } from '@/types';
import { rssProxyUrl } from '@/utils';
import { ICOUNTER_FEED_ADDITIONS, ICOUNTER_PANEL_ADDITIONS } from '../icounter-feeds-additions';

const rss = rssProxyUrl;

export const FEEDS: Record<string, Feed[]> = {
  // Core Tech News
  tech: [
    { name: 'TechCrunch', url: rss('https://techcrunch.com/feed/') },
    { name: 'The Verge', url: rss('https://www.theverge.com/rss/index.xml') },
    { name: 'Ars Technica', url: rss('https://feeds.arstechnica.com/arstechnica/technology-lab') },
    { name: 'Hacker News', url: rss('https://hnrss.org/frontpage') },
    { name: 'MIT Tech Review', url: rss('https://www.technologyreview.com/feed/') },
    { name: 'ZDNet', url: rss('https://www.zdnet.com/news/rss.xml') },
    { name: 'TechMeme', url: rss('https://www.techmeme.com/feed.xml') },
    { name: 'Engadget', url: rss('https://www.engadget.com/rss.xml') },
    { name: 'Fast Company', url: rss('https://feeds.feedburner.com/fastcompany/headlines') },
  ],

  // AI & Machine Learning
  ai: [
    { name: 'AI News', url: rss('https://news.google.com/rss/search?q=(OpenAI+OR+Anthropic+OR+Google+AI+OR+"large+language+model"+OR+ChatGPT+OR+Claude+OR+"AI+model")+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'VentureBeat AI', url: rss('https://venturebeat.com/category/ai/feed/') },
    { name: 'The Verge AI', url: rss('https://www.theverge.com/rss/ai-artificial-intelligence/index.xml') },
    { name: 'MIT Tech Review AI', url: rss('https://www.technologyreview.com/topic/artificial-intelligence/feed') },
    { name: 'MIT Research', url: rss('https://news.mit.edu/rss/research') },
    { name: 'ArXiv AI', url: rss('https://export.arxiv.org/rss/cs.AI') },
    { name: 'ArXiv ML', url: rss('https://export.arxiv.org/rss/cs.LG') },
    { name: 'AI Weekly', url: rss('https://news.google.com/rss/search?q="artificial+intelligence"+OR+"machine+learning"+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Anthropic News', url: rss('https://news.google.com/rss/search?q=Anthropic+Claude+AI+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'OpenAI News', url: rss('https://news.google.com/rss/search?q=OpenAI+ChatGPT+GPT-4+when:7d&hl=en-US&gl=US&ceid=US:en') },
  ],

  // Cybersecurity
  security: [
    { name: 'Krebs Security', url: rss('https://krebsonsecurity.com/feed/') },
    { name: 'The Hacker News', url: rss('https://feeds.feedburner.com/TheHackersNews') },
    { name: 'Dark Reading', url: rss('https://www.darkreading.com/rss.xml') },
    { name: 'Schneier', url: rss('https://www.schneier.com/feed/') },
    { name: 'CISA Advisories', url: rss('https://www.cisa.gov/cybersecurity-advisories/all.xml') },
    { name: 'Cyber Incidents', url: rss('https://news.google.com/rss/search?q=cyber+attack+OR+data+breach+OR+ransomware+OR+hacking+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Ransomware.live', url: rss('https://www.ransomware.live/rss.xml') },
  ],

  // Policy & Regulation
  policy: [
    { name: 'Politico Tech', url: rss('https://rss.politico.com/technology.xml') },
    { name: 'AI Regulation', url: rss('https://news.google.com/rss/search?q=AI+regulation+OR+"artificial+intelligence"+law+OR+policy+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Tech Antitrust', url: rss('https://news.google.com/rss/search?q=tech+antitrust+OR+FTC+Google+OR+FTC+Apple+OR+FTC+Amazon+when:7d&hl=en-US&gl=US&ceid=US:en') },
  ],

  // Markets & Finance (tech-focused)
  finance: [
    { name: 'CNBC Tech', url: rss('https://www.cnbc.com/id/19854910/device/rss/rss.html') },
    { name: 'MarketWatch Tech', url: rss('https://news.google.com/rss/search?q=site:marketwatch.com+technology+markets+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Yahoo Finance', url: rss('https://finance.yahoo.com/rss/topstories') },
    { name: 'Seeking Alpha Tech', url: rss('https://seekingalpha.com/market_currents.xml') },
  ],

  // IPO & SPAC
  ipo: [
    { name: 'IPO News', url: rss('https://news.google.com/rss/search?q=(IPO+OR+"initial+public+offering"+OR+SPAC)+tech+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Tech IPO News', url: rss('https://news.google.com/rss/search?q=tech+IPO+OR+"tech+company"+IPO+when:7d&hl=en-US&gl=US&ceid=US:en') },
  ],

  // Cyber-enabled fraud, crypto/stablecoin fraud, and AI-enabled fraud
  // (merged in from icounter-feeds-additions.ts)
  ...ICOUNTER_FEED_ADDITIONS,
};

// Panel configuration for AUSPEX (cybersecurity/fintech/fraud) analysis
export const DEFAULT_PANELS: Record<string, PanelConfig> = {
  map: { name: 'Global Tech Map', enabled: true, priority: 1 },
  'live-news': { name: 'Tech Headlines', enabled: true, priority: 1 },
  events: { name: 'Tech Events', enabled: true, priority: 1 },
  ai: { name: 'AI/ML News', enabled: true, priority: 1 },
  tech: { name: 'Technology', enabled: true, priority: 1 },
  security: { name: 'Cybersecurity', enabled: true, priority: 1 },
  policy: { name: 'AI Policy & Regulation', enabled: true, priority: 1 },
  markets: { name: 'Tech Stocks', enabled: true, priority: 2 },
  finance: { name: 'Financial News', enabled: true, priority: 2 },
  crypto: { name: 'Crypto', enabled: true, priority: 2 },
  'macro-signals': { name: 'Market Radar', enabled: true, priority: 2 },
  'etf-flows': { name: 'BTC ETF Tracker', enabled: true, priority: 2 },
  stablecoins: { name: 'Stablecoins', enabled: true, priority: 2 },
  monitors: { name: 'My Monitors', enabled: true, priority: 2 },
  // Cyber-enabled / crypto / AI-enabled fraud (merged in from icounter-feeds-additions.ts)
  ...ICOUNTER_PANEL_ADDITIONS,
};

// Tech-focused map layers (subset), minus the dropped startup/VC-ecosystem
// layers (startupHubs, cloudRegions, techHQs, techEvents; accelerators was
// already off by default in tech.ts).
export const DEFAULT_MAP_LAYERS: MapLayers = {
  // Keep only relevant layers, set others to false
  gpsJamming: false,
  satellites: false,


  conflicts: false,
  bases: false,
  cables: true,
  pipelines: false,
  hotspots: false,
  ais: false,
  nuclear: false,
  irradiators: false,
  sanctions: false,
  weather: true,
  economic: true,
  waterways: false,
  outages: true,
  cyberThreats: false,
  datacenters: true,
  protests: false,
  flights: false,
  military: false,
  natural: true,
  spaceports: false,
  minerals: false,
  fires: false,
  ucdpEvents: false,
  displacement: false,
  climate: false,
  // Tech-specific layers (startup/VC-ecosystem layers dropped for AUSPEX)
  startupHubs: false,
  cloudRegions: false,
  accelerators: false,
  techHQs: false,
  techEvents: false,
  // Finance layers (disabled in tech variant)
  stockExchanges: false,
  financialCenters: false,
  centralBanks: false,
  commodityHubs: false,
  gulfInvestments: false,
  // Happy variant layers
  positiveEvents: false,
  kindness: false,
  happiness: false,
  speciesRecovery: false,
  renewableInstallations: false,
  tradeRoutes: false,
  iranAttacks: false,
  ciiChoropleth: false,
  resilienceScore: false,
  dayNight: false,
  // Commodity variant layers (disabled in tech variant)
  miningSites: false,
  processingPlants: false,
  commodityPorts: false,
  webcams: false,
  diseaseOutbreaks: false,
};

// Mobile defaults for AUSPEX variant
export const MOBILE_DEFAULT_MAP_LAYERS: MapLayers = {
  gpsJamming: false,
  satellites: false,


  conflicts: false,
  bases: false,
  cables: false,
  pipelines: false,
  hotspots: false,
  ais: false,
  nuclear: false,
  irradiators: false,
  sanctions: false,
  weather: false,
  economic: false,
  waterways: false,
  outages: true,
  cyberThreats: false,
  datacenters: true,
  protests: false,
  flights: false,
  military: false,
  natural: true,
  spaceports: false,
  minerals: false,
  fires: false,
  ucdpEvents: false,
  displacement: false,
  climate: false,
  // Tech-specific layers (startup/VC-ecosystem layers dropped for AUSPEX)
  startupHubs: false,
  cloudRegions: false,
  accelerators: false,
  techHQs: false,
  techEvents: false,
  // Finance layers (disabled in tech variant)
  stockExchanges: false,
  financialCenters: false,
  centralBanks: false,
  commodityHubs: false,
  gulfInvestments: false,
  // Happy variant layers
  positiveEvents: false,
  kindness: false,
  happiness: false,
  speciesRecovery: false,
  renewableInstallations: false,
  tradeRoutes: false,
  iranAttacks: false,
  ciiChoropleth: false,
  resilienceScore: false,
  dayNight: false,
  // Commodity variant layers (disabled in tech variant)
  miningSites: false,
  processingPlants: false,
  commodityPorts: false,
  webcams: false,
  diseaseOutbreaks: false,
};

export const VARIANT_CONFIG: VariantConfig = {
  name: 'auspex',
  description: 'Cybersecurity, fintech, crypto & fraud intelligence dashboard',
  panels: DEFAULT_PANELS,
  mapLayers: DEFAULT_MAP_LAYERS,
  mobileMapLayers: MOBILE_DEFAULT_MAP_LAYERS,
};
