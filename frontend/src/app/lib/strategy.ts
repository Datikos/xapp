import { Candle } from '../models/candle.model';
import { ema, macd, rsi } from './indicators';

export type SignalType = 'LONG' | 'SHORT' | 'FLAT';

type ConditionCheck = { label: string; ok: boolean };

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
  validations: DecisionValidation[];
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

export interface DecisionValidation {
  signalTime: number;
  signalType: SignalType;
  entryPrice: number;
  evaluationTime: number | null;
  exitPrice: number | null;
  horizonCandles: number;
  actualHorizon: number | null;
  directionChangePct: number | null;
  outcome: 'WIN' | 'LOSS' | 'PENDING';
}

export interface NearMiss {
  time: number;
  price: number;
  bias: 'LONG' | 'SHORT';
  satisfied: string[];
  missing: string[];
}

interface ConditionEvaluation {
  satisfied: string[];
  missing: string[];
}

const NEAR_MISS_LIMIT = 100;

export function generateSignals(candles: Candle[]): StrategyResult {
  if (!candles.length) {
    return {
      signals: [],
      fastSignals: [],
      diagnostics: { nearMisses: [], lastEvaluatedCandle: null },
      trend: 'NEUTRAL',
      trendDetails: { score: 0, confidence: 0, direction: 'NEUTRAL', factors: [] },
      validations: [],
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
  const recordNearMiss = (entry: NearMiss) => {
    nearMisses.push(entry);
    if (nearMisses.length > NEAR_MISS_LIMIT) {
      nearMisses.shift();
    }
  };

  for (let index = 200; index < candles.length; index++) {
    const price = closes[index];
    const ema50Value = ema50[index];
    const ema200Value = ema200[index];
    const ema9Value = ema9[index];
    const ema21Value = ema21[index];

    if (!isFiniteNumber(price) || !isFiniteNumber(ema50Value) || !isFiniteNumber(ema200Value)) {
      continue;
    }

    const bullishTrend = ema50Value > ema200Value;
    const bearishTrend = ema50Value < ema200Value;

    const macdLinePrev = macdLine[index - 1];
    const macdLineNow = macdLine[index];
    const signalLinePrev = signalLine[index - 1];
    const signalLineNow = signalLine[index];
    const hasMacdPrev = isFiniteNumber(macdLinePrev) && isFiniteNumber(signalLinePrev);
    const hasMacdNow = isFiniteNumber(macdLineNow) && isFiniteNumber(signalLineNow);
    const macdBullishCross =
      hasMacdPrev &&
      hasMacdNow &&
      (macdLinePrev as number) <= (signalLinePrev as number) &&
      (macdLineNow as number) > (signalLineNow as number);
    const macdBearishCross =
      hasMacdPrev &&
      hasMacdNow &&
      (macdLinePrev as number) >= (signalLinePrev as number) &&
      (macdLineNow as number) < (signalLineNow as number);

    const histogramNowRaw = histogram[index];
    const histogramPrevRaw = histogram[index - 1];
    const hasHistogramNow = isFiniteNumber(histogramNowRaw);
    const histogramNow = hasHistogramNow ? (histogramNowRaw as number) : 0;
    const histogramPrev = isFiniteNumber(histogramPrevRaw) ? (histogramPrevRaw as number) : histogramNow;
    const macdMomentumUp =
      hasHistogramNow && histogramNow >= 0 && (histogramNow >= histogramPrev || macdBullishCross);
    const macdMomentumDown =
      hasHistogramNow && histogramNow <= 0 && (histogramNow <= histogramPrev || macdBearishCross);

    const rsiValue = rsi14[index];
    const hasRsi = isFiniteNumber(rsiValue);
    const rsiSupportsLong = hasRsi && (rsiValue as number) <= 45;
    const rsiSupportsShort = hasRsi && (rsiValue as number) >= 55;

    const priceAboveEma50 = price >= ema50Value * 0.995;
    const priceBelowEma50 = price <= ema50Value * 1.005;

    const longConditions: ConditionCheck[] = [
      { label: 'EMA50 above EMA200', ok: bullishTrend },
      { label: 'MACD bullish momentum', ok: macdBullishCross || macdMomentumUp },
      { label: 'RSI <= 45', ok: rsiSupportsLong },
      { label: 'Price above EMA50 (±0.5%)', ok: priceAboveEma50 },
    ];

    const shortConditions: ConditionCheck[] = [
      { label: 'EMA50 below EMA200', ok: bearishTrend },
      { label: 'MACD bearish momentum', ok: macdBearishCross || macdMomentumDown },
      { label: 'RSI >= 55', ok: rsiSupportsShort },
      { label: 'Price below EMA50 (±0.5%)', ok: priceBelowEma50 },
    ];

    const longEval = evaluateConditions(longConditions);
    if (longEval.missing.length === 0) {
      signals.push({
        time: candles[index].closeTime,
        price,
        type: 'LONG',
        reason: 'EMA trend + MACD momentum + RSI support + price > EMA50',
      });
    } else if (longEval.missing.length === 1) {
      recordNearMiss({
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
      recordNearMiss({
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
  const validations = evaluateHistoricalDecisions(candles, signals);

  return {
    signals,
    fastSignals,
    diagnostics: {
      nearMisses: trimmedNearMisses,
      lastEvaluatedCandle: candles[lastIndex]?.closeTime ?? null,
    },
    trend,
    trendDetails,
    validations,
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

function evaluateConditions(conditions: ConditionCheck[]): ConditionEvaluation {
  const satisfied: string[] = [];
  const missing: string[] = [];
  for (const condition of conditions) {
    if (condition.ok) {
      satisfied.push(condition.label);
    } else {
      missing.push(condition.label);
    }
  }
  return { satisfied, missing };
}

function evaluateHistoricalDecisions(candles: Candle[], signals: Signal[], horizon = 5): DecisionValidation[] {
  if (!signals.length || !candles.length) {
    return [];
  }

  const lookup = new Map<number, number>();
  candles.forEach((candle, index) => {
    if (isFiniteNumber(candle.closeTime)) {
      lookup.set(candle.closeTime, index);
    }
  });

  return signals.map((signal) => {
    const startIndex = lookup.get(signal.time);
    if (startIndex === undefined) {
      return {
        signalTime: signal.time,
        signalType: signal.type,
        entryPrice: signal.price,
        evaluationTime: null,
        exitPrice: null,
        horizonCandles: horizon,
        actualHorizon: null,
        directionChangePct: null,
        outcome: 'PENDING',
      };
    }

    const targetIndex = Math.min(candles.length - 1, startIndex + horizon);
    if (targetIndex <= startIndex) {
      return {
        signalTime: signal.time,
        signalType: signal.type,
        entryPrice: signal.price,
        evaluationTime: null,
        exitPrice: null,
        horizonCandles: horizon,
        actualHorizon: null,
        directionChangePct: null,
        outcome: 'PENDING',
      };
    }

    const evaluationCandle = candles[targetIndex];
    const exitPrice = evaluationCandle.close;
    const directionMultiplier = signal.type === 'LONG' ? 1 : signal.type === 'SHORT' ? -1 : 0;

    let outcome: DecisionValidation['outcome'] = 'PENDING';
    let directionChangePct: number | null = null;

    if (directionMultiplier !== 0 && isFiniteNumber(exitPrice) && isFiniteNumber(signal.price)) {
      const rawChange = ((exitPrice - signal.price) / signal.price) * 100;
      directionChangePct = rawChange * directionMultiplier;
      if (directionChangePct > 0) {
        outcome = 'WIN';
      } else if (directionChangePct < 0) {
        outcome = 'LOSS';
      }
    }

    return {
      signalTime: signal.time,
      signalType: signal.type,
      entryPrice: signal.price,
      evaluationTime: evaluationCandle.closeTime,
      exitPrice,
      horizonCandles: horizon,
      actualHorizon: targetIndex - startIndex,
      directionChangePct,
      outcome,
    };
  });
}
