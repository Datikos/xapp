import { Injectable, computed, effect, signal } from '@angular/core';

import { Candle } from '../models/candle.model';
import {
  DecisionValidation,
  generateSignals,
  NearMiss,
  Signal,
  StrategyDiagnostics,
  TrendDetails,
} from '../lib/strategy';

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
}

export interface DecisionValidationSummary {
  wins: number;
  losses: number;
  pending: number;
  winRate: number | null;
  lastOutcome: DecisionValidation['outcome'] | null;
  lastChangePct: number | null;
}
