import { Injectable, computed, effect, signal } from '@angular/core';

import { Candle } from '../models/candle.model';
import { generateSignals, NearMiss, Signal, StrategyDiagnostics, TrendDetails } from '../lib/strategy';

@Injectable({ providedIn: 'root' })
export class SignalsStore {
  readonly candles = signal<Candle[]>([]);
  readonly signals = signal<Signal[]>([]);
  readonly fastSignals = signal<Signal[]>([]);
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

  readonly nearMisses = computed<NearMiss[]>(() => this.diagnostics()?.nearMisses ?? []);

  constructor() {
    effect(() => {
      const data = this.candles();
      if (data.length) {
        const { signals, fastSignals, trend, trendDetails, diagnostics } = generateSignals(data);
        this.signals.set(signals);
        this.fastSignals.set(fastSignals);
        this.trend.set(trend);
        this.trendDetails.set(trendDetails);
        this.diagnostics.set(diagnostics);
        this.lastUpdated.set(Date.now());
      } else {
        this.signals.set([]);
        this.fastSignals.set([]);
        this.trend.set('NEUTRAL');
        this.trendDetails.set(null);
        this.diagnostics.set(null);
        this.lastUpdated.set(null);
      }
    });
  }
}
