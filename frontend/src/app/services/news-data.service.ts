import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, delay, map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { NewsItem, NewsSentiment } from '../lib/news';
import { NEWS_API_CONFIG, NewsApiConfig } from './news-api.config';

const SAMPLE_NEWS: NewsItem[] = [
  {
    id: 'cpi-cooling',
    time: Date.now() - 90 * 60 * 1000,
    headline: 'US CPI cools more than expected, reigniting Fed cut bets',
    summary:
      'Headline inflation printed 2.9% YoY versus 3.1% forecast, pulling Treasury yields lower and lifting risk sentiment across crypto majors.',
    sentiment: 'positive',
    sentimentScore: 0.68,
    confidence: 82,
    impactArea: 'macro',
    reach: 'global',
    source: 'Bloomberg',
    url: 'https://www.bloomberg.com/',
  },
  {
    id: 'etf-record',
    time: Date.now() - 4 * 60 * 60 * 1000,
    headline: 'Spot Bitcoin ETFs register record $520m daily inflow',
    summary:
      'BlackRock, Fidelity, and Bitwise products saw the strongest net creations since March, signalling sustained institutional demand.',
    sentiment: 'positive',
    sentimentScore: 0.74,
    confidence: 76,
    impactArea: 'adoption',
    reach: 'global',
    source: 'The Block',
    url: 'https://www.theblock.co/',
  },
  {
    id: 'sec-approval',
    time: Date.now() - 10 * 60 * 60 * 1000,
    headline: 'SEC clears Ether staking ETFs for launch in early Q4',
    summary:
      'Regulators signed off on the final S-1 amendments, removing a key overhang for ETH and reinforcing the broader digital asset narrative.',
    sentiment: 'positive',
    sentimentScore: 0.61,
    confidence: 70,
    impactArea: 'regulation',
    reach: 'global',
    source: 'CNBC',
    url: 'https://www.cnbc.com/',
  },
  {
    id: 'miner-selloff',
    time: Date.now() - 16 * 60 * 60 * 1000,
    headline: 'Bitcoin miner reserves drop to three-year low, signalling sell pressure',
    summary:
      'CryptoQuant data shows miners sending 12,500 BTC to exchanges this week, raising risk of short-term supply spikes.',
    sentiment: 'negative',
    sentimentScore: -0.57,
    confidence: 68,
    impactArea: 'onchain',
    reach: 'global',
    source: 'CryptoQuant',
    url: 'https://cryptoquant.com/',
  },
  {
    id: 'asia-licence',
    time: Date.now() - 22 * 60 * 60 * 1000,
    headline: 'Hong Kong grants first spot BTC/ETH exchange licences to mainland-backed brokers',
    summary:
      'HashKey and OSL subsidiaries win approvals, paving the way for expanded retail access across Greater China.',
    sentiment: 'positive',
    sentimentScore: 0.47,
    confidence: 62,
    impactArea: 'adoption',
    reach: 'regional',
    source: 'South China Morning Post',
    url: 'https://www.scmp.com/',
  },
];

const EQUITY_SAMPLE_NEWS: Record<string, NewsItem[]> = {
  AAPL: [
    {
      id: 'sample-aapl-innovation',
      time: Date.now() - 3 * 60 * 60 * 1000,
      headline: 'Apple unveils premium AI features to drive device upgrade wave',
      summary:
        'WWDC preview shows on-device generative AI rolling out to iPhone 16 Pro and M3 Macs, stoking expectations for a stronger refresh cycle.',
      sentiment: 'positive',
      sentimentScore: 0.52,
      confidence: 74,
      impactArea: 'adoption',
      reach: 'global',
      source: 'wsj.com',
      url: 'https://www.wsj.com/',
    },
    {
      id: 'sample-aapl-supply',
      time: Date.now() - 8 * 60 * 60 * 1000,
      headline: 'Taiwan supply partners flag softer iPhone build orders into autumn',
      summary:
        'Hon Hai and Pegatron executives guide to cautious volumes after a stronger-than-expected spring, hinting at a modest production pullback.',
      sentiment: 'negative',
      sentimentScore: -0.36,
      confidence: 61,
      impactArea: 'liquidity',
      reach: 'regional',
      source: 'asia.nikkei.com',
      url: 'https://asia.nikkei.com/',
    },
  ],
  NVDA: [
    {
      id: 'sample-nvda-datacenter',
      time: Date.now() - 2 * 60 * 60 * 1000,
      headline: 'Hyperscalers accelerate H200 orders as AI capex plans expand',
      summary:
        'Channel checks point to double-digit sequential growth in Nvidia datacenter shipments with Meta and Alphabet front-loading deliveries.',
      sentiment: 'positive',
      sentimentScore: 0.63,
      confidence: 78,
      impactArea: 'adoption',
      reach: 'global',
      source: 'reuters.com',
      url: 'https://www.reuters.com/',
    },
    {
      id: 'sample-nvda-competition',
      time: Date.now() - 11 * 60 * 60 * 1000,
      headline: 'AMD and Broadcom pitch cheaper AI accelerators to cloud buyers',
      summary:
        'Reports suggest large customers are negotiating blended procurement to reduce reliance on Nvidia, introducing incremental pricing pressure.',
      sentiment: 'negative',
      sentimentScore: -0.41,
      confidence: 66,
      impactArea: 'liquidity',
      reach: 'global',
      source: 'bloomberg.com',
      url: 'https://www.bloomberg.com/',
    },
  ],
};

const EQUITY_KEYWORD_CODE_MAP: Record<string, string> = {
  aapl: 'AAPL',
  apple: 'AAPL',
  iphone: 'AAPL',
  macbook: 'AAPL',
  cook: 'AAPL',
  nvda: 'NVDA',
  nvidia: 'NVDA',
  gpu: 'NVDA',
  ai: 'NVDA',
  chip: 'NVDA',
  chips: 'NVDA',
  semiconductor: 'NVDA',
};

const NASDAQ_NEWS_CODES = new Set<string>(
  environment.assets.flatMap((asset) => {
    if (!asset.providerSymbols?.nasdaq) {
      return [];
    }
    return (asset.newsCodes ?? []).map((code) => code.toUpperCase());
  }),
);

const EQUITY_CODE_CANDIDATES = new Set<string>([
  ...Array.from(NASDAQ_NEWS_CODES),
  ...Object.keys(EQUITY_SAMPLE_NEWS),
]);

const POSITIVE_TERMS = [
  'beat',
  'beats',
  'record',
  'surge',
  'soar',
  'soars',
  'upgrade',
  'upgrades',
  'raises',
  'growth',
  'strong',
  'tops',
  'expands',
  'improves',
  'bullish',
  'outperform',
  'buyback',
  'accretion',
  'rally',
];

const NEGATIVE_TERMS = [
  'miss',
  'misses',
  'falls',
  'fall',
  'drop',
  'drops',
  'downgrade',
  'downgrades',
  'cuts',
  'cut',
  'decline',
  'declines',
  'slump',
  'slumps',
  'lawsuit',
  'delay',
  'delays',
  'weak',
  'bearish',
  'selloff',
  'reduction',
];

const SOURCE_DOMAIN_MAP: Record<string, string> = {
  bloomberg: 'bloomberg.com',
  reuters: 'reuters.com',
  'the wall street journal': 'wsj.com',
  'wall street journal': 'wsj.com',
  wsj: 'wsj.com',
  cnbc: 'cnbc.com',
  'financial times': 'ft.com',
  ft: 'ft.com',
  'the block': 'theblock.co',
  'new york times': 'nytimes.com',
};

export interface NewsFilter {
  codes: string[];
  keywords: string[];
}

interface CryptoPanicResponse {
  results: CryptoPanicPost[];
}

interface CryptoPanicVotes {
  positive: number;
  negative: number;
  important: number;
  saved: number;
  lol: number;
  to_the_moon: number;
  visiting: number;
}

interface CryptoPanicPost {
  id: number;
  title: string;
  slug: string;
  url: string;
  domain: string;
  published_at: string;
  metadata?: {
    description?: string;
  };
  votes: CryptoPanicVotes;
  currencies?: Array<{ code: string }>;
}

@Injectable({ providedIn: 'root' })
export class NewsDataService {
  private readonly http = inject(HttpClient);
  private readonly config = inject<NewsApiConfig>(NEWS_API_CONFIG);

  getLatestNews(filter?: NewsFilter): Observable<NewsItem[]> {
    const effectiveFilter = normaliseFilter(filter);
    const equityFilter: NewsFilter = {
      ...effectiveFilter,
      codes: resolveEquityCodes(effectiveFilter),
    };

    if (equityFilter.codes.length) {
      return this.fetchEquityNews(equityFilter);
    }

    return this.fetchCryptoNews(effectiveFilter);
  }

  private fetchCryptoNews(filter: NewsFilter): Observable<NewsItem[]> {
    if (!this.config.enabled || !this.config.apiToken) {
      return this.getFallbackNews(filter);
    }

    const params = new HttpParams()
      .set('auth_token', this.config.apiToken)
      .set('currencies', filter.codes.join(','))
      .set('public', 'true')
      .set('kind', 'news');

    return this.http
      .get<CryptoPanicResponse>(`${this.config.baseUrl ?? 'https://cryptopanic.com/api/v1/posts/'}`, { params })
      .pipe(
        map((response) => this.mapCryptoPanicResponse(response, filter)),
        catchError(() => this.getFallbackNews(filter)),
      );
  }

  private fetchEquityNews(filter: NewsFilter): Observable<NewsItem[]> {
    const equitiesConfig = this.config.equities;
    if (!equitiesConfig?.enabled || !equitiesConfig.baseUrl) {
      return this.getFallbackNews(filter);
    }

    let params = new HttpParams();
    if (filter.codes.length) {
      params = params.set('tickers', filter.codes.join(','));
    }
    if (equitiesConfig.apiToken) {
      params = params.set('token', equitiesConfig.apiToken);
    }

    return this.http
      .get<unknown>(equitiesConfig.baseUrl, { params })
      .pipe(
        map((payload) => this.mapEquityNewsResponse(payload, filter)),
        catchError(() => this.getFallbackNews(filter)),
      );
  }

  private mapCryptoPanicResponse(response: CryptoPanicResponse, filter: NewsFilter): NewsItem[] {
    if (!response?.results?.length) {
      return this.getFilteredSample(filter);
    }

    const mapped = response.results
      .filter((post) => isAssetRelated(post, filter))
      .slice(0, 20)
      .map((post) => {
        const summary = post.metadata?.description ?? post.title;
        const sentimentScore = deriveSentimentScore(post.votes);
        const sentiment = sentimentScore > 0.1 ? 'positive' : sentimentScore < -0.1 ? 'negative' : 'neutral';
        const impactArea = deriveImpactArea(post.title);
        const reach = deriveReach(post.domain);
        const confidence = deriveConfidence(post.votes);

        return {
          id: `cryptopanic-${post.id}`,
          time: Date.parse(post.published_at),
          headline: post.title,
          summary,
          sentiment,
          sentimentScore,
          confidence,
          impactArea,
          reach,
          source: post.domain,
          url: post.url,
        } satisfies NewsItem;
      });

    return mapped.length ? mapped : this.getFilteredSample(filter);
  }

  private mapEquityNewsResponse(payload: unknown, filter: NewsFilter): NewsItem[] {
    const rows = extractEquityArticles(payload);
    if (!rows.length) {
      return this.getFilteredSample(filter);
    }

    const mapped = rows
      .map((row) => this.adaptEquityNewsItem(row))
      .filter((item): item is NewsItem => Boolean(item));

    if (!mapped.length) {
      return this.getFilteredSample(filter);
    }

    return mapped.sort((a, b) => b.time - a.time).slice(0, 25);
  }

  private adaptEquityNewsItem(row: unknown): NewsItem | null {
    if (!row || typeof row !== 'object') {
      return null;
    }

    const record = row as Record<string, unknown>;
    const headline = extractString(record['headline']) ?? extractString(record['title']);
    if (!headline) {
      return null;
    }

    const summary =
      extractString(record['summary']) ??
      extractString(record['description']) ??
      extractString(record['snippet']) ??
      headline;

    const timestamp =
      extractTimestamp(
        record['time'] ??
          record['published_at'] ??
          record['publishedAt'] ??
          record['datetime'] ??
          record['date'],
      ) ?? Date.now();

    const url = extractString(record['url']) ?? extractString(record['link']) ?? undefined;
    const rawSource = extractSource(record['source']);
    const source = rawSource ?? 'News Desk';
    const domain =
      extractDomain(url) ??
      (rawSource ? extractDomain(rawSource) : null) ??
      SOURCE_DOMAIN_MAP[source.toLowerCase()] ??
      null;
    const reach = deriveReach((domain ?? source).toLowerCase());

    const { sentiment, score, confidence } = deriveSentimentFromArticle(record, `${headline} ${summary}`);

    return {
      id: buildEquityNewsId(record, headline, timestamp, url),
      time: timestamp,
      headline,
      summary,
      sentiment,
      sentimentScore: score,
      confidence,
      impactArea: deriveImpactArea(`${headline} ${summary}`),
      reach,
      source,
      url,
    };
  }

  private getFallbackNews(filter: NewsFilter): Observable<NewsItem[]> {
    return of(this.getFilteredSample(filter)).pipe(delay(120));
  }

  private getFilteredSample(filter: NewsFilter): NewsItem[] {
    const pool = [...cloneNews(SAMPLE_NEWS), ...collectEquitySampleNews(filter)];
    const filtered = pool.filter((item) => isSampleRelevant(item, filter));
    return filtered.length ? filtered : pool;
  }
}

function cloneNews(items: NewsItem[]): NewsItem[] {
  return items.map((item) => ({ ...item }));
}

function deriveSentimentScore(votes: CryptoPanicVotes): number {
  const positive = votes.positive + votes.to_the_moon;
  const negative = votes.negative + votes.lol;
  const total = positive + negative || 1;
  const score = (positive - negative) / total;
  return Math.max(-1, Math.min(1, score));
}

function deriveImpactArea(title: string): NewsItem['impactArea'] {
  const lower = title.toLowerCase();
  if (lower.includes('sec') || lower.includes('regulat') || lower.includes('approval')) {
    return 'regulation';
  }
  if (lower.includes('etf') || lower.includes('institution') || lower.includes('adoption')) {
    return 'adoption';
  }
  if (lower.includes('inflation') || lower.includes('fed') || lower.includes('rates')) {
    return 'macro';
  }
  if (lower.includes('miner') || lower.includes('on-chain') || lower.includes('onchain') || lower.includes('reserve')) {
    return 'onchain';
  }
  if (lower.includes('liquidity') || lower.includes('volume') || lower.includes('flows')) {
    return 'liquidity';
  }
  return 'adoption';
}

function deriveReach(domain: string): NewsItem['reach'] {
  const globalDomains = ['bloomberg.com', 'reuters.com', 'cnbc.com', 'wsj.com', 'coindesk.com', 'theblock.co'];
  const regionalDomains = ['scmp.com', 'asia.nikkei.com', 'yonhapnews.co.kr', 'ft.com'];

  if (globalDomains.some((site) => domain.endsWith(site))) {
    return 'global';
  }
  if (regionalDomains.some((site) => domain.endsWith(site))) {
    return 'regional';
  }
  return 'local';
}

function deriveConfidence(votes: CryptoPanicVotes): number {
  const base = votes.important * 12 + votes.positive * 5 + votes.negative * 5;
  return Math.max(35, Math.min(90, base));
}

const DEFAULT_FILTER: NewsFilter = {
  codes: ['BTC'],
  keywords: ['bitcoin', 'btc', 'satoshi', 'btc/usdt'],
};

function normaliseFilter(filter?: NewsFilter): NewsFilter {
  const codes = (filter?.codes ?? DEFAULT_FILTER.codes)
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code.length);
  const keywords = (filter?.keywords ?? DEFAULT_FILTER.keywords)
    .map((keyword) => keyword.trim().toLowerCase())
    .filter((keyword) => keyword.length);
  return {
    codes: codes.length ? Array.from(new Set(codes)) : DEFAULT_FILTER.codes,
    keywords: keywords.length ? Array.from(new Set(keywords)) : DEFAULT_FILTER.keywords,
  };
}

function resolveEquityCodes(filter: NewsFilter): string[] {
  const matched = new Set<string>();
  for (const code of filter.codes) {
    if (isEquityCode(code)) {
      matched.add(code.toUpperCase());
    }
  }
  for (const keyword of filter.keywords) {
    const mapped = EQUITY_KEYWORD_CODE_MAP[keyword];
    if (mapped) {
      matched.add(mapped);
    }
  }
  return Array.from(matched);
}

function isEquityCode(code: string): boolean {
  return EQUITY_CODE_CANDIDATES.has(code.toUpperCase());
}

function isAssetRelated(post: CryptoPanicPost, filter: NewsFilter): boolean {
  if (post.currencies?.some((currency) => filter.codes.includes(currency.code?.toUpperCase() ?? ''))) {
    return true;
  }
  const text = `${post.title} ${post.metadata?.description ?? ''}`.toLowerCase();
  return filter.keywords.some((keyword) => keyword && text.includes(keyword));
}

function isSampleRelevant(item: NewsItem, filter: NewsFilter): boolean {
  const text = `${item.headline} ${item.summary}`.toLowerCase();
  return filter.keywords.some((keyword) => keyword && text.includes(keyword));
}

function collectEquitySampleNews(filter: NewsFilter): NewsItem[] {
  const codes = resolveEquityCodes(filter);
  return codes.flatMap((code) => cloneNews(EQUITY_SAMPLE_NEWS[code] ?? []));
}

function extractEquityArticles(payload: unknown): unknown[] {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['articles', 'items', 'data', 'results', 'news']) {
      const candidate = record[key];
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }
  }
  return [];
}

function extractString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function extractSource(value: unknown): string | null {
  const direct = extractString(value);
  if (direct) {
    return direct;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      extractString(record['name']) ??
      extractString(record['title']) ??
      extractString(record['source']) ??
      null
    );
  }
  return null;
}

function extractTimestamp(value: unknown): number | null {
  const numeric = ensureNumber(value);
  if (numeric !== null) {
    if (numeric > 1e12) {
      return Math.round(numeric);
    }
    if (numeric > 1e10) {
      return Math.round(numeric * 1000);
    }
    if (numeric > 1e6) {
      return Math.round(numeric * 1000);
    }
  }
  const text = extractString(value);
  if (text) {
    const parsed = Date.parse(text);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function ensureNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function extractDomain(candidate?: string | null): string | null {
  if (!candidate) {
    return null;
  }
  try {
    const reference = candidate.startsWith('http') ? candidate : `https://${candidate}`;
    const url = new URL(reference);
    return url.hostname.toLowerCase();
  } catch {
    const match = candidate.toLowerCase().match(/([a-z0-9-]+\.)+[a-z]{2,}/i);
    return match ? match[0] : null;
  }
}

function deriveSentimentFromArticle(
  record: Record<string, unknown>,
  text: string,
): { sentiment: NewsSentiment; score: number; confidence: number } {
  const explicitSentiment = extractString(record['sentiment']) ?? extractString(record['sentiment_label']);
  const explicitScore = ensureNumber(
    record['sentimentScore'] ?? record['sentiment_score'] ?? record['score'],
  );

  if (explicitSentiment) {
    const normalized = explicitSentiment.toLowerCase();
    const sentiment: NewsSentiment =
      normalized === 'positive' ? 'positive' : normalized === 'negative' ? 'negative' : 'neutral';
    if (explicitScore !== null) {
      const clamped = Math.max(-1, Math.min(1, explicitScore));
      return {
        sentiment,
        score: clamped,
        confidence: Math.min(95, 65 + Math.round(Math.abs(clamped) * 25)),
      };
    }
    const fallbackScore = sentiment === 'positive' ? 0.35 : sentiment === 'negative' ? -0.35 : 0;
    return {
      sentiment,
      score: fallbackScore,
      confidence: sentiment === 'neutral' ? 55 : 68,
    };
  }

  if (explicitScore !== null) {
    const clamped = Math.max(-1, Math.min(1, explicitScore));
    const sentiment: NewsSentiment = clamped > 0.1 ? 'positive' : clamped < -0.1 ? 'negative' : 'neutral';
    return {
      sentiment,
      score: clamped,
      confidence: Math.min(90, 60 + Math.round(Math.abs(clamped) * 30)),
    };
  }

  const estimated = estimateSentimentFromText(text);
  const confidence = Math.min(85, 55 + Math.round(Math.abs(estimated.score) * 60));
  return { ...estimated, confidence };
}

function estimateSentimentFromText(text: string): { sentiment: NewsSentiment; score: number } {
  const lower = text.toLowerCase();
  let score = 0;

  for (const term of POSITIVE_TERMS) {
    if (lower.includes(term)) {
      score += 1;
    }
  }

  for (const term of NEGATIVE_TERMS) {
    if (lower.includes(term)) {
      score -= 1;
    }
  }

  if (score === 0) {
    return { sentiment: 'neutral', score: 0 };
  }

  const normalized = Math.max(-1, Math.min(1, score / 8));
  return {
    sentiment: normalized > 0 ? 'positive' : 'negative',
    score: normalized,
  };
}

function buildEquityNewsId(
  record: Record<string, unknown>,
  headline: string,
  timestamp: number,
  url?: string,
): string {
  const explicitId =
    extractString(record['id']) ??
    extractString(record['uuid']) ??
    extractString(record['guid']) ??
    null;
  if (explicitId) {
    return `equity-${explicitId}`;
  }
  if (url) {
    return `equity-${url}`;
  }
  const slug = slugify(headline);
  return `equity-${timestamp}-${slug}`;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug.length ? slug : 'story';
}
