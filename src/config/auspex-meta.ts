// AUSPEX branding — internal GTM intelligence tool, NOT part of the
// worldmonitor.app multi-tenant deployment. Deliberately kept OUT of
// variant-meta.ts: tests/deploy-config.test.mjs text-scans that file for any
// `url: 'https://...'` pattern and cross-checks it against vercel.json host
// rewrites + middleware.ts crawler stubs for the real worldmonitor.app
// subdomains. Living in this separate file keeps AUSPEX out of that
// production-topology contract. getVariantMeta() in variant-meta.ts is the
// only supported way to resolve this.
//
// Placeholder domain — replace `url`/`siteName` with your own before any
// shared deployment; these values only drive the HTML <title>, OG/Twitter
// meta, and JSON-LD on an AUSPEX build (VITE_VARIANT=auspex).
import type { VariantMeta } from './variant-meta';

export const AUSPEX_META: VariantMeta = {
  title: 'AUSPEX - Cybersecurity, Fintech & Fraud Intelligence Dashboard',
  description: 'Real-time intelligence dashboard tracking cybersecurity, fintech, crypto/stablecoins, cyber-enabled fraud, and AI-enabled fraud for GTM content research.',
  keywords: 'cybersecurity, fintech, crypto fraud, stablecoin fraud, cyber-enabled fraud, AI-enabled fraud, deepfake fraud, synthetic identity fraud, account takeover, money mule, AML, fraud intelligence, GTM content research',
  url: 'https://auspex.example.com/dashboard',
  siteName: 'AUSPEX',
  shortName: 'AUSPEX',
  subject: 'Cybersecurity, Fintech, and Fraud Intelligence',
  classification: 'Fraud Intelligence Dashboard, Fintech Tracker, GTM Research Tool',
  categories: ['news', 'business'],
  features: [
    'Cybersecurity news aggregation',
    'Crypto & stablecoin tracking',
    'Cyber-enabled fraud monitoring',
    'AI-enabled fraud monitoring',
    'Fraud scenario vector tracking',
    'Fintech & payments news',
    'AI/ML industry news',
    'Financial regulation tracking',
  ],
};
