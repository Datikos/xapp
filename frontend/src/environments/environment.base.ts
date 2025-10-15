import type { Interval } from '../app/models/candle.model';
import type { ProviderOption } from '../app/models/provider.model';

export interface DashboardConfig {
  autoRefreshMs: number;
  priceWindowSize: number;
  candleWindowSize: number;
  newsHistoryDays: number;
  validationLabelCount: number;
}

export interface MarketDataConfig {
  binanceUrl: string;
  coinbaseUrl: string;
}

export interface NewsApiEnvironmentConfig {
  enabled: boolean;
  apiToken: string;
  baseUrl: string;
}

export interface AppEnvironment {
  production: boolean;
  intervals: Interval[];
  defaultInterval: Interval;
  providers: ProviderOption[];
  dashboard: DashboardConfig;
  marketData: MarketDataConfig;
  newsApi: NewsApiEnvironmentConfig;
}

const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

const coerceNumber = (value: unknown, fallback: number): number => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const trimOrFallback = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
};

export const buildEnvironment = (production: boolean): AppEnvironment => {
  const newsApiToken = trimOrFallback(
    metaEnv.NG_APP_NEWS_TOKEN ?? metaEnv.NG_APP_CRYPTOPANIC_TOKEN,
    '',
  );
  const newsApiBaseUrl = trimOrFallback(
    metaEnv.NG_APP_NEWS_BASE_URL,
    'https://cryptopanic.com/api/v1/posts/',
  );

  const allIntervals: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
  const defaultIntervalCandidate = trimOrFallback(metaEnv.NG_APP_DEFAULT_INTERVAL, '1m') as Interval;
  const defaultInterval = allIntervals.includes(defaultIntervalCandidate)
    ? defaultIntervalCandidate
    : '1m';

  const providers: ProviderOption[] = [
    {
      id: 'binance',
      label: trimOrFallback(metaEnv.NG_APP_BINANCE_LABEL, 'Binance (Spot)'),
      symbol: trimOrFallback(metaEnv.NG_APP_BINANCE_SYMBOL, 'BTCUSDT'),
    },
    {
      id: 'coinbase',
      label: trimOrFallback(metaEnv.NG_APP_COINBASE_LABEL, 'Coinbase Advanced'),
      symbol: trimOrFallback(metaEnv.NG_APP_COINBASE_SYMBOL, 'BTC-USD'),
    },
  ];

  return {
    production,
    intervals: allIntervals,
    defaultInterval,
    providers,
    dashboard: {
      autoRefreshMs: coerceNumber(metaEnv.NG_APP_AUTO_REFRESH_MS, 30_000),
      priceWindowSize: coerceNumber(metaEnv.NG_APP_PRICE_WINDOW, 180),
      candleWindowSize: coerceNumber(metaEnv.NG_APP_CANDLE_WINDOW, 150),
      newsHistoryDays: coerceNumber(metaEnv.NG_APP_NEWS_HISTORY_DAYS, 30),
      validationLabelCount: coerceNumber(metaEnv.NG_APP_VALIDATION_LABEL_COUNT, 4),
    },
    marketData: {
      binanceUrl: trimOrFallback(
        metaEnv.NG_APP_BINANCE_URL,
        'https://api.binance.com/api/v3/klines',
      ),
      coinbaseUrl: trimOrFallback(
        metaEnv.NG_APP_COINBASE_URL,
        'https://api.exchange.coinbase.com/products',
      ),
    },
    newsApi: {
      enabled: Boolean(newsApiToken),
      apiToken: newsApiToken,
      baseUrl: newsApiBaseUrl,
    },
  };
};
