import { Candle } from '../models/candle.model';
import { TrendDetails, Signal, TrendFactor, NearMiss } from './strategy';

export type AdvisorTone = 'positive' | 'caution' | 'neutral';

export interface IncomeAdvice {
  headline: string;
  tone: AdvisorTone;
  rationale: string;
  suggestions: string[];
  confidenceScore: number; // 0-100
  riskScore: number; // 0-100 (higher = more risk)
  metrics: {
    volatilityPct: number | null;
    signalFreshnessMinutes: number | null;
    trendScore: number | null;
    momentumScore: number | null;
  };
}

export interface AdvisorContext {
  trendDetails: TrendDetails | null;
  latestSignal: Signal | null;
  latestFastSignal: Signal | null;
  nearMiss: NearMiss | null;
  candles: Candle[];
  intervalMs: number;
  fetchError: string | null;
  lastCandleTime: number | null;
}

export function generateIncomeAdvice(context: AdvisorContext): IncomeAdvice {
  if (context.fetchError) {
    return {
      headline: 'Fix data feed before risking capital',
      tone: 'caution',
      rationale: 'Live market feed is unavailable, so acting now introduces execution risk.',
      suggestions: [
        'Retry the refresh or switch providers to restore pricing.',
        'Avoid opening new positions until candles update reliably.',
        'Set alerts or fall back to a secondary data source before redeploying capital.',
      ],
      confidenceScore: 25,
      riskScore: 80,
      metrics: {
        volatilityPct: null,
        signalFreshnessMinutes: null,
        trendScore: null,
        momentumScore: null,
      },
    };
  }

  const trendDetails = context.trendDetails;
  if (!trendDetails || !context.lastCandleTime) {
    return {
      headline: 'Gather more market data',
      tone: 'neutral',
      rationale: 'There is not enough recent price action to justify a confident allocation.',
      suggestions: [
        'Increase the lookback or switch to a longer interval.',
        'Confirm connectivity, then trigger a manual refresh.',
        'Review higher timeframe structure before planning entries.',
      ],
      confidenceScore: 30,
      riskScore: 50,
      metrics: {
        volatilityPct: null,
        signalFreshnessMinutes: null,
        trendScore: null,
        momentumScore: null,
      },
    };
  }

  const volatilityPct = computeVolatilityPct(context.candles);
  const signalFreshness = computeSignalFreshnessMinutes(context.latestSignal, context.lastCandleTime);
  const nearMiss = context.nearMiss;
  const momentumScore = computeMomentumScore(trendDetails);
  const baseRisk = clamp(
    ((volatilityPct ?? 0) * 1.5 + (momentumScore ?? 0)) / 2,
    0,
    100,
  );

  const bias = trendDetails.direction;
  const confidence = trendDetails.confidence;
  const score = trendDetails.score;

  if (bias === 'BULL') {
    if (confidence >= 70) {
      return {
        headline: 'Press the long bias with managed scaling',
        tone: 'positive',
        rationale: `High-conviction bullish structure (score ${score}) suggests allocating more capital with controlled risk.`,
        suggestions: [
          context.latestSignal && isFresh(context.latestSignal.time, context.lastCandleTime, context.intervalMs * 1.5)
            ? 'Add on minor pullbacks toward EMA50 while the latest LONG signal remains valid.'
            : 'Plan staged entries near EMA50 retests and validate with fresh LONG signals.',
          'Trail stops below recent swing lows to protect realised income.',
          context.latestFastSignal && isFresh(context.latestFastSignal.time, context.lastCandleTime, context.intervalMs)
            ? 'Consider a quick momentum add-on using the latest momentum ping.'
            : 'Set alerts for the next momentum ping to avoid chasing vertical moves.',
        ],
        confidenceScore: clamp(confidence + 10, 0, 100),
        riskScore: clamp(baseRisk + 10, 0, 100),
        metrics: {
          volatilityPct,
          signalFreshnessMinutes: signalFreshness,
          trendScore: score,
          momentumScore,
        },
      };
    }

    return {
      headline: 'Build bullish exposure selectively',
      tone: 'positive',
      rationale: 'Trend leans bullish but conviction is moderate, so favour asymmetric setups.',
      suggestions: [
        context.latestSignal
          ? 'Size positions modestly around the most recent LONG signal and scale once confidence improves.'
          : 'Let price accept above EMA50 with improving MACD momentum before committing capital.',
        nearMiss
          ? `Watch the "${nearMiss.missing.join(', ')}" criterion — clearing it can unlock a full setup.`
          : 'Use laddered limit orders near support to capture dips without chasing.',
        'Keep risk per trade tight (≤1%) until confidence breaks above 70%.',
      ],
      confidenceScore: clamp(confidence + 5, 0, 100),
      riskScore: clamp(baseRisk + 15, 0, 100),
      metrics: {
        volatilityPct,
        signalFreshnessMinutes: signalFreshness,
        trendScore: score,
        momentumScore,
      },
    };
  }

  if (bias === 'BEAR') {
    if (confidence >= 70) {
      return {
        headline: 'Lean into defensive / short-side plays',
        tone: 'caution',
        rationale: `Dominant bearish momentum (score ${score}) favours income via downside exposure or hedges.`,
        suggestions: [
          context.latestSignal && isFresh(context.latestSignal.time, context.lastCandleTime, context.intervalMs * 1.5)
            ? 'Scale into short exposure on weak bounces toward EMA50 in line with the latest SHORT signal.'
            : 'Stalk rallies into resistance to initiate shorts with tight stops above the swing high.',
          'Rotate capital into defensive holdings or stablecoins to lock in gains.',
          'Trail stops above the most recent lower high to preserve downside profits.',
        ],
        confidenceScore: clamp(confidence + 10, 0, 100),
        riskScore: clamp(baseRisk + 20, 0, 100),
        metrics: {
          volatilityPct,
          signalFreshnessMinutes: signalFreshness,
          trendScore: score,
          momentumScore,
        },
      };
    }

    return {
      headline: 'Protect capital while trend turns lower',
      tone: 'caution',
      rationale: 'Bearish bias is forming but still susceptible to squeezes.',
      suggestions: [
        'Trim or hedge long exposure; replace with options or inverse ETFs for insurance.',
        nearMiss
          ? `Track the near-miss from ${formatTimestamp(nearMiss.time)} — a full SHORT setup could trigger soon.`
          : 'Wait for MACD momentum to flip negative before sizing into shorts.',
        'Keep position sizes light and take profits quickly until confidence builds.',
      ],
      confidenceScore: clamp(confidence + 5, 0, 100),
      riskScore: clamp(baseRisk + 25, 0, 100),
      metrics: {
        volatilityPct,
        signalFreshnessMinutes: signalFreshness,
        trendScore: score,
        momentumScore,
      },
    };
  }

  return {
    headline: 'Stay patient — conditions are mixed',
    tone: 'neutral',
    rationale: 'Trend signals conflict, so forcing trades risks churn instead of income.',
    suggestions: [
      context.latestFastSignal && isFresh(context.latestFastSignal.time, context.lastCandleTime, context.intervalMs)
        ? 'If you must trade, treat the momentum ping as a quick scalp with tight stops.'
        : 'Collect more data or drop to a faster interval for clearer structure.',
      nearMiss
        ? `Refine entries around the near-miss: ${nearMiss.missing.join(', ')} is the key trigger to monitor.`
        : 'Focus on capital preservation — deploy funds only when trend and momentum agree.',
      'Review broader market catalysts (macro releases, liquidity shifts) before reallocating capital.',
    ],
    confidenceScore: clamp(confidence + 5, 0, 100),
    riskScore: clamp(baseRisk + 10, 0, 100),
    metrics: {
      volatilityPct,
      signalFreshnessMinutes: signalFreshness,
      trendScore: score,
      momentumScore,
    },
  };
}

function computeVolatilityPct(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) {
    return null;
  }
  const atr = calculateATR(candles, period);
  const latestATR = atr[atr.length - 1];
  const latestClose = candles[candles.length - 1]?.close;
  if (!latestATR || !latestClose) {
    return null;
  }
  return Math.round((latestATR / latestClose) * 10000) / 100;
}

function calculateATR(candles: Candle[], period: number): number[] {
  const result: number[] = [];
  let prevClose = candles[0].close;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];
    const highLow = candle.high - candle.low;
    const highPrevClose = Math.abs(candle.high - prevClose);
    const lowPrevClose = Math.abs(candle.low - prevClose);
    const tr = Math.max(highLow, highPrevClose, lowPrevClose);
    trs.push(tr);
    prevClose = candle.close;
  }

  if (trs.length < period) {
    return [];
  }

  let atr = average(trs.slice(0, period));
  result[period] = atr;
  for (let i = period + 1; i < candles.length; i++) {
    const tr = trs[i - 1];
    atr = (atr * (period - 1) + tr) / period;
    result[i] = atr;
  }

  return result;
}

function computeSignalFreshnessMinutes(signal: Signal | null, lastCandleTime: number | null): number | null {
  if (!signal || !lastCandleTime) {
    return null;
  }
  const diffMs = lastCandleTime - signal.time;
  if (diffMs < 0) {
    return 0;
  }
  return Math.round(diffMs / 60000);
}

function computeMomentumScore(trendDetails: TrendDetails): number | null {
  if (!trendDetails) {
    return null;
  }
  const macdFactor = findFactor(trendDetails.factors, 'MACD momentum');
  const rsiFactor = findFactor(trendDetails.factors, 'RSI bias');
  const priceFactor = findFactor(trendDetails.factors, 'Price vs EMA50');

  const contributions = [macdFactor, rsiFactor, priceFactor]
    .filter(Boolean)
    .map((factor) => Math.sign(factor!.contribution) * factorIntensityValue(factor!) * 25);

  if (!contributions.length) {
    return null;
  }
  return clamp(Math.round(contributions.reduce((acc, value) => acc + value, 0) / contributions.length + 50), 0, 100);
}

function findFactor(factors: TrendFactor[], label: string): TrendFactor | undefined {
  return factors.find((factor) => factor.label === label);
}

function factorIntensityValue(factor: TrendFactor): number {
  const weight = factor.weight || 1;
  if (weight === 0) {
    return 0;
  }
  return Math.min(1, Math.abs(factor.contribution) / weight);
}

function isFresh(time: number, lastCandle: number, thresholdMs: number): boolean {
  return Math.abs(lastCandle - time) <= thresholdMs;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function formatTimestamp(value: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}
