import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, delay, map } from 'rxjs/operators';

import { NewsItem } from '../lib/news';
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

    if (!this.config.enabled || !this.config.apiToken) {
      return this.getFallbackNews(effectiveFilter);
    }

    const params = new HttpParams()
      .set('auth_token', this.config.apiToken)
      .set('currencies', effectiveFilter.codes.join(','))
      .set('public', 'true')
      .set('kind', 'news');

    return this.http
      .get<CryptoPanicResponse>(`${this.config.baseUrl ?? 'https://cryptopanic.com/api/v1/posts/'}`, { params })
      .pipe(
        map((response) => this.mapCryptoPanicResponse(response, effectiveFilter)),
        catchError(() => this.getFallbackNews(effectiveFilter)),
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

  private getFallbackNews(filter: NewsFilter): Observable<NewsItem[]> {
    return of(this.getFilteredSample(filter)).pipe(delay(120));
  }

  private getFilteredSample(filter: NewsFilter): NewsItem[] {
    const clone = cloneNews(SAMPLE_NEWS);
    const filtered = clone.filter((item) => isSampleRelevant(item, filter));
    return filtered.length ? filtered : clone;
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
