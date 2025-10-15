import { Injectable, computed, effect, signal } from '@angular/core';

import { Candle } from '../models/candle.model';
import {
  DecisionValidation,
  generateSignals,
  NearMiss,
  Signal,
  SignalType,
  StrategyDiagnostics,
  TrendDetails,
} from '../lib/strategy';
import { buildNewsPrediction, NewsItem, NewsPrediction } from '../lib/news';

@Injectable({ providedIn: 'root' })
export class SignalsStore {
  readonly candles = signal<Candle[]>([]);
  readonly signals = signal<Signal[]>([]);
  readonly fastSignals = signal<Signal[]>([]);
  readonly decisionValidations = signal<DecisionValidation[]>([]);
  readonly trend = signal<'BULL' | 'BEAR' | 'NEUTRAL'>('NEUTRAL');
  readonly trendDetails = signal<TrendDetails | null>(null);
  readonly lastUpdated = signal<number | null>(null);
  readonly diagnostics = signal<StrategyDiagnostics | null>(null);
  readonly newsEvents = signal<NewsItem[]>([]);

  readonly lastCandle = computed(() => {
    const items = this.candles();
    return items.length ? items[items.length - 1] : null;
  });

  readonly latestSignal = computed(() => {
    const items = this.signals();
    return items.length ? items[items.length - 1] : null;
  });

  readonly latestFastSignal = computed(() => {
    const items = this.fastSignals();
    return items.length ? items[items.length - 1] : null;
  });

  readonly latestValidation = computed(() => {
    const items = this.decisionValidations();
    return items.length ? items[items.length - 1] : null;
  });

  readonly nearMisses = computed<NearMiss[]>(() => this.diagnostics()?.nearMisses ?? []);

  readonly validationSummary = computed<DecisionValidationSummary | null>(() => {
    const items = this.decisionValidations();
    if (!items.length) {
      return null;
    }

    const completed = items.filter((item) => item.outcome !== 'PENDING');
    const wins = completed.filter((item) => item.outcome === 'WIN').length;
    const losses = completed.filter((item) => item.outcome === 'LOSS').length;
    const pending = items.length - completed.length;
    const winRate = completed.length ? Math.round((wins / completed.length) * 100) : null;
    const latest = items[items.length - 1];

    return {
      wins,
      losses,
      pending,
      winRate,
      lastOutcome: latest?.outcome ?? null,
      lastChangePct: latest?.directionChangePct ?? null,
    };
  });

  readonly validationAnalytics = computed<DecisionValidationAnalytics | null>(() => {
    const validations = this.decisionValidations().filter(
      (item) => item.directionChangePct !== null && item.outcome !== 'PENDING',
    );
    if (!validations.length) {
      return null;
    }

    let cumulative = 0;
    const points: DecisionValidationPoint[] = validations.map((item, index) => {
      const actual = item.directionChangePct as number;
      const expected = item.signalType === 'LONG' ? 1 : item.signalType === 'SHORT' ? -1 : 0;
      cumulative += actual;
      return {
        index,
        time: item.signalTime,
        expected,
        actual,
        outcome: item.outcome,
        cumulative,
      };
    });

    const expectedValues = points.map((point) => point.expected);
    const actualValues = points.map((point) => point.actual);
    const correlation = computeCorrelation(expectedValues, actualValues);
    const totalReturn = points[points.length - 1]?.cumulative ?? 0;

    return {
      points,
      totalReturn,
      correlation,
    };
  });

  readonly strategyHealth = computed<StrategyHealth | null>(() => {
    const validations = this.decisionValidations().filter(
      (item) => item.directionChangePct !== null && item.outcome !== 'PENDING',
    );
    if (!validations.length) {
      return null;
    }

    const returns = validations.map((item) => item.directionChangePct as number);
    const gains = returns.filter((value) => value > 0);
    const losses = returns.filter((value) => value < 0);
    const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);
    const avg = (values: number[]) => (values.length ? sum(values) / values.length : null);

    const totalGain = sum(gains);
    const totalLoss = Math.abs(sum(losses));
    const profitFactor =
      totalLoss === 0 ? (totalGain > 0 ? Number.POSITIVE_INFINITY : null) : totalGain / totalLoss || null;

    const expectancy = sum(returns) / returns.length;
    const averageGain = avg(gains);
    const averageLoss = avg(losses);

    const cumulative: number[] = [];
    returns.reduce((acc, value, index) => {
      const current = acc + value;
      cumulative[index] = current;
      return current;
    }, 0);

    let peak = cumulative[0] ?? 0;
    let maxDrawdown = 0;
    for (const value of cumulative) {
      peak = Math.max(peak, value);
      maxDrawdown = Math.min(maxDrawdown, value - peak);
    }

    let currentWinStreak = 0;
    let bestWinStreak = 0;
    let currentLossStreak = 0;
    let bestLossStreak = 0;
    for (const value of returns) {
      if (value > 0) {
        currentWinStreak += 1;
        bestWinStreak = Math.max(bestWinStreak, currentWinStreak);
        currentLossStreak = 0;
      } else if (value < 0) {
        currentLossStreak += 1;
        bestLossStreak = Math.max(bestLossStreak, currentLossStreak);
        currentWinStreak = 0;
      } else {
        currentWinStreak = 0;
        currentLossStreak = 0;
      }
    }

    const latest = validations[validations.length - 1];

    return {
      tradesEvaluated: validations.length,
      expectancy,
      averageGain,
      averageLoss,
      profitFactor,
      maxDrawdown,
      bestWinStreak,
      bestLossStreak,
      lastOutcome: latest.outcome,
      lastReturn: latest.directionChangePct ?? null,
    };
  });

  readonly patternAnalytics = computed<PatternAnalytics>(() => {
    const completed = this.decisionValidations().filter(
      (item) => item.directionChangePct !== null && item.outcome !== 'PENDING',
    );
    if (!completed.length) {
      return { patterns: [], summary: null };
    }

    const signalLookup = new Map<number, Signal>();
    for (const signal of this.signals()) {
      if (Number.isFinite(signal.time)) {
        signalLookup.set(signal.time, signal);
      }
    }

    interface Bucket {
      label: string;
      type: SignalType;
      totalReturn: number;
      count: number;
      wins: number;
      losses: number;
      maxGain: number;
      maxLoss: number;
    }

    const buckets = new Map<string, Bucket>();
    for (const validation of completed) {
      const signal = signalLookup.get(validation.signalTime);
      const label = signal?.reason ?? 'Unclassified pattern';
      const type = signal?.type ?? validation.signalType;
      const key = `${label}::${type}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          label,
          type,
          totalReturn: 0,
          count: 0,
          wins: 0,
          losses: 0,
          maxGain: Number.NEGATIVE_INFINITY,
          maxLoss: Number.POSITIVE_INFINITY,
        };
        buckets.set(key, bucket);
      }

      const change = validation.directionChangePct as number;
      bucket.totalReturn += change;
      bucket.count += 1;
      if (change > 0) {
        bucket.wins += 1;
        bucket.maxGain = Math.max(bucket.maxGain, change);
      } else if (change < 0) {
        bucket.losses += 1;
        bucket.maxLoss = Math.min(bucket.maxLoss, change);
      }
    }

    const patterns = Array.from(buckets.values())
      .map((bucket) => {
        const averageReturn = bucket.count ? bucket.totalReturn / bucket.count : 0;
        const winRate = bucket.count ? Math.round((bucket.wins / bucket.count) * 100) : 0;
        const bestReturn = bucket.maxGain === Number.NEGATIVE_INFINITY ? null : bucket.maxGain;
        const worstReturn = bucket.maxLoss === Number.POSITIVE_INFINITY ? null : bucket.maxLoss;
        const maxAdverse = worstReturn === null ? null : Math.abs(worstReturn);
        const riskReward =
          bestReturn !== null && maxAdverse && maxAdverse > 0 ? +(bestReturn / maxAdverse).toFixed(2) : null;
        return {
          label: bucket.label,
          type: bucket.type,
          occurrences: bucket.count,
          averageReturn,
          winRate,
          bestReturn,
          worstReturn,
          riskReward,
        };
      })
      .filter((pattern) => pattern.occurrences >= 2)
      .sort((a, b) => b.occurrences - a.occurrences || b.averageReturn - a.averageReturn)
      .slice(0, 6);

    const leaders = patterns.slice(0, 3);
    let summary: PatternSummary | null = null;
    if (leaders.length > 0) {
      const bullishCount = leaders.filter((item) => item.averageReturn >= 0).length;
      const dominantBias: PatternSummary['dominantBias'] =
        bullishCount >= leaders.length / 2 ? 'BULL' : 'BEAR';
      summary = {
        dominantBias,
        meanAverageReturn: leaders.reduce((acc, item) => acc + item.averageReturn, 0) / leaders.length,
        combinedWinRate: Math.round(leaders.reduce((acc, item) => acc + item.winRate, 0) / leaders.length),
      };
    }

    return { patterns, summary };
  });

  readonly newsPrediction = computed<NewsPrediction | null>(() => {
    const events = this.newsEvents();
    if (!events.length) {
      return null;
    }
    const trend = this.trendDetails();
    const health = this.strategyHealth();
    return (
      buildNewsPrediction({
        news: events,
        trendBias: trend?.direction ?? 'NEUTRAL',
        trendConfidence: trend?.confidence ?? 0,
        expectancy: health?.expectancy ?? null,
      }) ?? null
    );
  });

  constructor() {
    effect(() => {
      const data = this.candles();
      if (data.length) {
        const { signals, fastSignals, trend, trendDetails, diagnostics, validations } = generateSignals(data);
        this.signals.set(signals);
        this.fastSignals.set(fastSignals);
        this.decisionValidations.set(validations);
        this.trend.set(trend);
        this.trendDetails.set(trendDetails);
        this.diagnostics.set(diagnostics);
        this.lastUpdated.set(Date.now());
      } else {
        this.signals.set([]);
        this.fastSignals.set([]);
        this.decisionValidations.set([]);
        this.trend.set('NEUTRAL');
        this.trendDetails.set(null);
        this.diagnostics.set(null);
        this.lastUpdated.set(null);
      }
    });
  }

  setNewsEvents(events: NewsItem[]): void {
    this.newsEvents.set(events);
  }

  appendNewsEvents(events: NewsItem[]): void {
    const existing = this.newsEvents();
    const merged = [...events, ...existing].sort((a, b) => b.time - a.time);
    const deduped: NewsItem[] = [];
    const seen = new Set<string>();
    for (const item of merged) {
      if (!seen.has(item.id)) {
        deduped.push(item);
        seen.add(item.id);
      }
    }
    this.newsEvents.set(deduped.slice(0, 30));
  }
}

export interface DecisionValidationSummary {
  wins: number;
  losses: number;
  pending: number;
  winRate: number | null;
  lastOutcome: DecisionValidation['outcome'] | null;
  lastChangePct: number | null;
}

export interface DecisionValidationAnalytics {
  points: DecisionValidationPoint[];
  totalReturn: number;
  correlation: number | null;
}

export interface DecisionValidationPoint {
  index: number;
  time: number;
  expected: 1 | -1 | 0;
  actual: number;
  outcome: DecisionValidation['outcome'];
  cumulative: number;
}

export interface StrategyHealth {
  tradesEvaluated: number;
  expectancy: number;
  averageGain: number | null;
  averageLoss: number | null;
  profitFactor: number | null;
  maxDrawdown: number;
  bestWinStreak: number;
  bestLossStreak: number;
  lastOutcome: DecisionValidation['outcome'];
  lastReturn: number | null;
}

export interface PatternAnalytics {
  patterns: PatternInsight[];
  summary: PatternSummary | null;
}

export interface PatternInsight {
  label: string;
  type: SignalType;
  occurrences: number;
  averageReturn: number;
  winRate: number;
  bestReturn: number | null;
  worstReturn: number | null;
  riskReward: number | null;
}

export interface PatternSummary {
  dominantBias: 'BULL' | 'BEAR';
  meanAverageReturn: number;
  combinedWinRate: number;
}

function computeCorrelation(xValues: number[], yValues: number[]): number | null {
  const length = Math.min(xValues.length, yValues.length);
  if (length < 2) {
    return null;
  }

  let sumX = 0;
  let sumY = 0;
  for (let index = 0; index < length; index++) {
    sumX += xValues[index];
    sumY += yValues[index];
  }

  const meanX = sumX / length;
  const meanY = sumY / length;

  let numerator = 0;
  let sumXDiffSq = 0;
  let sumYDiffSq = 0;

  for (let index = 0; index < length; index++) {
    const xDiff = xValues[index] - meanX;
    const yDiff = yValues[index] - meanY;
    numerator += xDiff * yDiff;
    sumXDiffSq += xDiff * xDiff;
    sumYDiffSq += yDiff * yDiff;
  }

  const denominator = Math.sqrt(sumXDiffSq * sumYDiffSq);
  if (!Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}
