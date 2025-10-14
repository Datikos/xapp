import { Candle } from '../models/candle.model';
import { ema, macd, rsi } from './indicators';

export type SignalType = 'LONG' | 'SHORT' | 'FLAT';

export interface Signal {
  time: number;
  price: number;
  type: SignalType;
  reason: string;
}

export interface StrategyResult {
  signals: Signal[];
  fastSignals: Signal[];
  diagnostics: StrategyDiagnostics;
  trend: 'BULL' | 'BEAR' | 'NEUTRAL';
  trendDetails: TrendDetails;
}

export interface TrendDetails {
  score: number;
  confidence: number;
  direction: 'BULL' | 'BEAR' | 'NEUTRAL';
  factors: TrendFactor[];
}

export interface TrendFactor {
  label: string;
  detail: string;
  weight: number;
  contribution: number;
  direction: 'BULL' | 'BEAR' | 'NEUTRAL';
}

export interface StrategyDiagnostics {
  nearMisses: NearMiss[];
  lastEvaluatedCandle: number | null;
}

export interface NearMiss {
  time: number;
  price: number;
  bias: 'LONG' | 'SHORT';
  satisfied: string[];
  missing: string[];
}

export function generateSignals(candles: Candle[]): StrategyResult {
  if (!candles.length) {
    return {
      signals: [],
      fastSignals: [],
      diagnostics: { nearMisses: [], lastEvaluatedCandle: null },
      trend: 'NEUTRAL',
      trendDetails: { score: 0, confidence: 0, direction: 'NEUTRAL', factors: [] },
    };
  }

  const closes = candles.map((candle) => candle.close);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const rsi14 = rsi(closes, 14);
  const { macdLine, signalLine, histogram } = macd(closes);

  const signals: Signal[] = [];
  const fastSignals: Signal[] = [];
  const nearMisses: NearMiss[] = [];

  for (let index = 200; index < candles.length; index++) {
    const price = closes[index];
    const ema50Value = ema50[index] ?? 0;
    const ema200Value = ema200[index] ?? 0;
    const ema9Value = ema9[index];
    const ema21Value = ema21[index];

    const bullishTrend = ema50Value > ema200Value;
    const bearishTrend = ema50Value < ema200Value;

    const macdBullishCross =
      (macdLine[index - 1] ?? 0) <= (signalLine[index - 1] ?? 0) && (macdLine[index] ?? 0) > (signalLine[index] ?? 0);
    const macdBearishCross =
      (macdLine[index - 1] ?? 0) >= (signalLine[index - 1] ?? 0) && (macdLine[index] ?? 0) < (signalLine[index] ?? 0);

    const histogramNow = histogram[index] ?? 0;
    const histogramPrev = histogram[index - 1] ?? histogramNow;
    const macdMomentumUp = histogramNow >= 0 && (histogramNow >= histogramPrev || macdBullishCross);
    const macdMomentumDown = histogramNow <= 0 && (histogramNow <= histogramPrev || macdBearishCross);

    const rsiValue = rsi14[index] ?? 50;
    const rsiSupportsLong = rsiValue <= 65;
    const rsiSupportsShort = rsiValue >= 35;

    const priceAboveEma50 = price >= ema50Value * 0.995;
    const priceBelowEma50 = price <= ema50Value * 1.005;

    const longConditions = [
      { label: 'EMA50 above EMA200', ok: bullishTrend },
      { label: 'MACD bullish momentum', ok: macdBullishCross || macdMomentumUp },
      { label: 'RSI <= 65', ok: rsiSupportsLong },
      { label: 'Price above EMA50 (±0.5%)', ok: priceAboveEma50 },
    ];

    const shortConditions = [
      { label: 'EMA50 below EMA200', ok: bearishTrend },
      { label: 'MACD bearish momentum', ok: macdBearishCross || macdMomentumDown },
      { label: 'RSI >= 35', ok: rsiSupportsShort },
      { label: 'Price below EMA50 (±0.5%)', ok: priceBelowEma50 },
    ];

    const evaluateConditions = (conditions: { label: string; ok: boolean }[]) => {
      const satisfied = conditions.filter((condition) => condition.ok).map((condition) => condition.label);
      const missing = conditions.filter((condition) => !condition.ok).map((condition) => condition.label);
      return { satisfied, missing };
    };

    const longEval = evaluateConditions(longConditions);
    if (longEval.missing.length === 0) {
      signals.push({
        time: candles[index].closeTime,
        price,
        type: 'LONG',
        reason: 'EMA trend + MACD momentum + RSI support + price > EMA50',
      });
    } else if (longEval.missing.length === 1) {
      nearMisses.push({
        time: candles[index].closeTime,
        price,
        bias: 'LONG',
        satisfied: longEval.satisfied,
        missing: longEval.missing,
      });
    }

    const shortEval = evaluateConditions(shortConditions);
    if (shortEval.missing.length === 0) {
      signals.push({
        time: candles[index].closeTime,
        price,
        type: 'SHORT',
        reason: 'EMA trend + MACD momentum + RSI resistance + price < EMA50',
      });
    } else if (shortEval.missing.length === 1) {
      nearMisses.push({
        time: candles[index].closeTime,
        price,
        bias: 'SHORT',
        satisfied: shortEval.satisfied,
        missing: shortEval.missing,
      });
    }

    if (isFiniteNumber(ema9Value) && isFiniteNumber(ema21Value)) {
      const prevEma9 = ema9[index - 1];
      const prevEma21 = ema21[index - 1];
      const fastBullCross = isFiniteNumber(prevEma9) && isFiniteNumber(prevEma21) && prevEma9 <= prevEma21 && ema9Value > ema21Value;
      const fastBearCross = isFiniteNumber(prevEma9) && isFiniteNumber(prevEma21) && prevEma9 >= prevEma21 && ema9Value < ema21Value;

      if (fastBullCross && (macdMomentumUp || histogramNow > 0) && price >= (ema9Value ?? price)) {
        fastSignals.push({
          time: candles[index].closeTime,
          price,
          type: 'LONG',
          reason: 'EMA9 > EMA21 crossover with positive MACD momentum',
        });
      } else if (fastBearCross && (macdMomentumDown || histogramNow < 0) && price <= (ema9Value ?? price)) {
        fastSignals.push({
          time: candles[index].closeTime,
          price,
          type: 'SHORT',
          reason: 'EMA9 < EMA21 crossover with negative MACD momentum',
        });
      }
    }
  }

  const lastIndex = candles.length - 1;
  const trendDetails = buildTrendDetails({
    candles,
    ema50,
    ema200,
    macdHistogram: histogram,
    rsi14,
  });

  const trend = trendDetails.direction;
  const trimmedNearMisses = nearMisses.slice(-100);

  return {
    signals,
    fastSignals,
    diagnostics: {
      nearMisses: trimmedNearMisses,
      lastEvaluatedCandle: candles[lastIndex]?.closeTime ?? null,
    },
    trend,
    trendDetails,
  };
}

interface TrendInputs {
  candles: Candle[];
  ema50: number[];
  ema200: number[];
  macdHistogram: number[];
  rsi14: number[];
}

function buildTrendDetails({ candles, ema50, ema200, macdHistogram, rsi14 }: TrendInputs): TrendDetails {
  const lastIndex = candles.length - 1;
  const prevIndex = Math.max(0, lastIndex - 5);
  const factors: TrendFactor[] = [];

  const ema50Value = ema50[lastIndex];
  const ema200Value = ema200[lastIndex];

  if (isFiniteNumber(ema50Value) && isFiniteNumber(ema200Value)) {
    const diff = ema50Value - ema200Value;
    const direction = diff > 0 ? 'BULL' : diff < 0 ? 'BEAR' : 'NEUTRAL';
    const contribution = diff > 0 ? 2 : diff < 0 ? -2 : 0;
    factors.push({
      label: 'EMA alignment',
      detail: `EMA50 is ${diff > 0 ? 'above' : diff < 0 ? 'below' : 'at'} EMA200`,
      weight: 2,
      contribution,
      direction,
    });
  }

  const ema50Prev = ema50[prevIndex];
  if (isFiniteNumber(ema50Value) && isFiniteNumber(ema50Prev)) {
    const slope = ema50Value - ema50Prev;
    const direction = slope > 0 ? 'BULL' : slope < 0 ? 'BEAR' : 'NEUTRAL';
    const contribution = slope > 0 ? 1 : slope < 0 ? -1 : 0;
    factors.push({
      label: 'EMA50 slope',
      detail: `EMA50 has ${slope > 0 ? 'rising' : slope < 0 ? 'falling' : 'flat'} momentum`,
      weight: 1,
      contribution,
      direction,
    });
  }

  const price = candles[lastIndex]?.close;
  if (isFiniteNumber(price) && isFiniteNumber(ema50Value)) {
    const direction = price > ema50Value ? 'BULL' : price < ema50Value ? 'BEAR' : 'NEUTRAL';
    const contribution = direction === 'BULL' ? 1 : direction === 'BEAR' ? -1 : 0;
    factors.push({
      label: 'Price vs EMA50',
      detail: `Price is ${price > ema50Value ? 'above' : price < ema50Value ? 'below' : 'touching'} EMA50`,
      weight: 1,
      contribution,
      direction,
    });
  }

  if (isFiniteNumber(price) && isFiniteNumber(ema200Value)) {
    const direction = price > ema200Value ? 'BULL' : price < ema200Value ? 'BEAR' : 'NEUTRAL';
    const contribution = direction === 'BULL' ? 1 : direction === 'BEAR' ? -1 : 0;
    factors.push({
      label: 'Price vs EMA200',
      detail: `Price is ${price > ema200Value ? 'above' : price < ema200Value ? 'below' : 'touching'} EMA200`,
      weight: 1,
      contribution,
      direction,
    });
  }

  const macdValue = macdHistogram[lastIndex];
  if (isFiniteNumber(macdValue)) {
    const direction = macdValue > 0 ? 'BULL' : macdValue < 0 ? 'BEAR' : 'NEUTRAL';
    const contribution = direction === 'BULL' ? 1 : direction === 'BEAR' ? -1 : 0;
    factors.push({
      label: 'MACD momentum',
      detail: `Histogram is ${macdValue > 0 ? 'positive' : macdValue < 0 ? 'negative' : 'flat'}`,
      weight: 1,
      contribution,
      direction,
    });
  }

  const rsiValue = rsi14[lastIndex];
  if (isFiniteNumber(rsiValue)) {
    let direction: TrendFactor['direction'] = 'NEUTRAL';
    let contribution = 0;
    if (rsiValue >= 55) {
      direction = 'BULL';
      contribution = 1;
    } else if (rsiValue <= 45) {
      direction = 'BEAR';
      contribution = -1;
    }
    factors.push({
      label: 'RSI bias',
      detail: `RSI at ${rsiValue.toFixed(1)}`,
      weight: 1,
      contribution,
      direction,
    });
  }

  const score = factors.reduce((acc, factor) => acc + factor.contribution, 0);
  const maxWeight = factors.reduce((acc, factor) => acc + factor.weight, 0) || 1;
  const direction = score > 1 ? 'BULL' : score < -1 ? 'BEAR' : 'NEUTRAL';
  const confidence = Math.min(100, Math.round((Math.abs(score) / maxWeight) * 100));

  return { score, confidence, direction, factors };
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
