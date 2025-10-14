import { Injectable, computed, effect, signal } from '@angular/core';

import { Candle } from '../models/candle.model';
import { generateSignals, Signal } from '../lib/strategy';

@Injectable({ providedIn: 'root' })
export class SignalsStore {
  readonly candles = signal<Candle[]>([]);
  readonly signals = signal<Signal[]>([]);
  readonly trend = signal<'BULL' | 'BEAR' | 'NEUTRAL'>('NEUTRAL');

  readonly latestSignal = computed(() => {
    const items = this.signals();
    return items.length ? items[items.length - 1] : null;
  });

  constructor() {
    effect(() => {
      const data = this.candles();
      if (data.length) {
        const { signals, trend } = generateSignals(data);
        this.signals.set(signals);
        this.trend.set(trend);
      } else {
        this.signals.set([]);
        this.trend.set('NEUTRAL');
      }
    });
  }
}
