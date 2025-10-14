import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SignalsStore } from './store/signals.store';
import { Interval } from './models/candle.model';
import { DataProvider, MarketDataService } from './services/market-data.service';
import { TrendFactor } from './lib/strategy';
import { IncomeAdvice, generateIncomeAdvice } from './lib/advisor';

interface ProviderOption {
  id: DataProvider;
  label: string;
  symbol: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="app">
      <header class="hero">
        <h1>BTC/USDT Directional Playbook</h1>
        <p>Angular 17 signals-driven dashboard for EMA, MACD, and RSI confluence.</p>
      </header>

      <div class="layout-grid">
        <section class="card controls">
          <header class="card-heading">
            <h2>Data Controls</h2>
            <span class="card-subtitle">Choose your market feed and refresh cadence.</span>
          </header>
          <div class="card-body">
            <div class="control-row">
              <label>
                Provider
                <select [ngModel]="providerValue" (ngModelChange)="onProviderChange($event)">
                  <option *ngFor="let provider of providers" [value]="provider.id">{{ provider.label }}</option>
                </select>
              </label>
              <label>
                Interval
                <select [ngModel]="intervalValue" (ngModelChange)="onIntervalChange($event)">
                  <option *ngFor="let option of intervals" [value]="option">{{ option }}</option>
                </select>
              </label>
              <button type="button" (click)="reload()" [disabled]="loading()">{{ loading() ? 'Loading…' : 'Reload now' }}</button>
              <button type="button" (click)="toggleAuto()">{{ auto() ? 'Stop auto (30s)' : 'Auto refresh (30s)' }}</button>
              <span class="trend" [class.bullish]="store.trend() === 'BULL'" [class.bearish]="store.trend() === 'BEAR'">
                Trend: {{ store.trend() }}
              </span>
            </div>

            <div class="status-grid">
              <article class="status-card danger" *ngIf="error() as message">
                <h3>Data Error</h3>
                <p>{{ message }}</p>
              </article>

              <article class="status-card muted" *ngIf="!error() && loading()">
                <h3>Syncing</h3>
                <p>Fetching latest candles…</p>
              </article>

              <article class="status-card accent" *ngIf="!loading() && store.latestSignal() as signal">
                <h3>Latest Signal</h3>
                <p>
                  <span class="pill" [class.long-pill]="signal.type === 'LONG'" [class.short-pill]="signal.type === 'SHORT'">{{ signal.type }}</span>
                  @ {{ signal.price | number: '1.0-0' }}
                </p>
                <time>{{ signal.time | date: 'yyyy-MM-dd HH:mm' }}</time>
              </article>

              <article class="status-card highlight" *ngIf="!loading() && store.latestSignal() as decision">
                <h3>Last Decision</h3>
                <p>
                  <span class="pill" [class.long-pill]="decision.type === 'LONG'" [class.short-pill]="decision.type === 'SHORT'">{{ decision.type }}</span>
                  decided {{ decision.time | date: 'yyyy-MM-dd HH:mm' }}
                </p>
                <p class="signal-reason">{{ decision.reason }}</p>
                <ng-container *ngIf="store.latestValidation() as validation">
                  <p>
                    Outcome
                    <span class="outcome-pill" [class.outcome-win]="validation.outcome === 'WIN'" [class.outcome-loss]="validation.outcome === 'LOSS'" [class.outcome-pending]="validation.outcome === 'PENDING'">
                      {{ validation.outcome }}
                    </span>
                    <span *ngIf="validation.directionChangePct !== null">
                      — {{ formatChange(validation.directionChangePct) }} after {{ validation.actualHorizon ?? validation.horizonCandles }} bars
                    </span>
                  </p>
                  <p *ngIf="validation.evaluationTime">
                    Checked at {{ validation.evaluationTime | date: 'yyyy-MM-dd HH:mm' }}
                  </p>
                </ng-container>
                <p *ngIf="!store.latestValidation()">Outcome validation pending.</p>
              </article>

              <article class="status-card" *ngIf="!loading() && store.latestFastSignal() as fast">
                <h3>Momentum Ping</h3>
                <p>
                  <span class="pill" [class.long-pill]="fast.type === 'LONG'" [class.short-pill]="fast.type === 'SHORT'">{{ fast.type }}</span>
                  @ {{ fast.price | number: '1.0-0' }}
                </p>
                <time>{{ fast.time | date: 'yyyy-MM-dd HH:mm' }}</time>
              </article>

              <article class="status-card" *ngIf="!loading() && !error() && store.lastCandle() as last">
                <h3>Market Clock</h3>
                <p>Last {{ intervalValue }} candle closed {{ last.closeTime | date: 'yyyy-MM-dd HH:mm' }}</p>
                <p *ngIf="store.lastUpdated() as updated">Refreshed {{ updated | date: 'yyyy-MM-dd HH:mm:ss' }}</p>
                <span class="meta">Source: {{ providerLabel() }}</span>
              </article>

              <article class="status-card warning" *ngIf="!loading() && !error() && staleSignal() && store.latestSignal()">
                <h3>Awaiting Confirmation</h3>
                <p>No new signals since {{ store.latestSignal()?.time | date: 'yyyy-MM-dd HH:mm' }}</p>
              </article>

              <article class="status-card" *ngIf="!loading() && !error() && latestNearMiss() as near">
                <h3>Closest Setup</h3>
                <p>{{ near.bias }} bias pending {{ near.missing.join(', ') }}</p>
                <time>{{ near.time | date: 'yyyy-MM-dd HH:mm' }}</time>
              </article>

              <article class="status-card" *ngIf="!loading() && !error() && store.validationSummary() as summary">
                <h3>Decision Scorecard</h3>
                <p>Win rate: {{ summary.winRate !== null ? (summary.winRate | number: '1.0-0') + '%' : 'n/a' }}</p>
                <p>Wins / Losses / Pending: {{ summary.wins }} / {{ summary.losses }} / {{ summary.pending }}</p>
                <p *ngIf="summary.lastOutcome">
                  Last outcome
                  <span class="outcome-pill" [class.outcome-win]="summary.lastOutcome === 'WIN'" [class.outcome-loss]="summary.lastOutcome === 'LOSS'" [class.outcome-pending]="summary.lastOutcome === 'PENDING'">
                    {{ summary.lastOutcome }}
                  </span>
                  <span *ngIf="summary.lastChangePct !== null">
                    ({{ formatChange(summary.lastChangePct) }})
                  </span>
                </p>
              </article>
            </div>
          </div>
        </section>

        <section class="card insights" *ngIf="store.trendDetails() as trendDetails">
          <header class="card-heading">
            <h2>Trend Confidence</h2>
            <span class="card-subtitle">EMA, MACD, and RSI blend for current bias.</span>
          </header>
          <div class="card-body trend-body">
            <div class="trend-metrics">
              <div class="metric">
                <span class="metric-label">Bias</span>
                <span class="metric-value" [class.long]="trendDetails.direction === 'BULL'" [class.short]="trendDetails.direction === 'BEAR'">
                  {{ trendDetails.direction }}
                </span>
                <span class="metric-note">{{ trendNarrative() }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Confidence</span>
                <span class="metric-value">{{ trendDetails.confidence }}%</span>
                <div class="metric-bar">
                  <div class="metric-bar-fill" [style.width.%]="trendDetails.confidence"></div>
                </div>
              </div>
              <div class="metric">
                <span class="metric-label">Score</span>
                <span class="metric-value">{{ trendDetails.score }}</span>
                <span class="metric-note">Range −4 to +4</span>
              </div>
            </div>

            <ul class="factor-list">
              <li *ngFor="let factor of trendDetails.factors" [class.bullish]="factor.direction === 'BULL'" [class.bearish]="factor.direction === 'BEAR'">
                <div class="factor-row">
                  <span class="pill small" [class.long-pill]="factor.direction === 'BULL'" [class.short-pill]="factor.direction === 'BEAR'">
                    {{ factor.direction }}
                  </span>
                  <span class="factor-label">{{ factor.label }}</span>
                  <span class="factor-weight">w{{ factor.weight }}</span>
                </div>
                <div class="factor-bar" [class.positive]="factor.contribution > 0" [class.negative]="factor.contribution < 0">
                  <div class="factor-bar-fill" [style.width.%]="factorIntensity(factor)"></div>
                </div>
                <p class="factor-detail">{{ factor.detail }}</p>
              </li>
            </ul>
          </div>
        </section>

        <section class="card advisor" *ngIf="incomeAdvice() as advice">
          <header class="card-heading">
            <h2>Income Action Advisor</h2>
            <span class="card-subtitle">Suggested moves to compound trading income.</span>
          </header>
          <div class="card-body">
            <div class="advisor-pills">
              <span class="advisor-pill positive" *ngIf="advice.tone === 'positive'">Upside Bias</span>
              <span class="advisor-pill caution" *ngIf="advice.tone === 'caution'">Capital Protection</span>
              <span class="advisor-pill neutral" *ngIf="advice.tone === 'neutral'">Hold Fire</span>
              <span class="advisor-pill">Confidence {{ advice.confidenceScore }}%</span>
              <span class="advisor-pill muted">Risk {{ advice.riskScore }}%</span>
            </div>
            <p class="advisor-headline" [class.positive]="advice.tone === 'positive'" [class.caution]="advice.tone === 'caution'">
              {{ advice.headline }}
            </p>
            <p class="advisor-rationale">{{ advice.rationale }}</p>
            <div class="advisor-metrics">
              <div class="metric-card" *ngIf="advice.metrics.volatilityPct !== null">
                <span class="metric-label">Realised Volatility</span>
                <span class="metric-value">{{ advice.metrics.volatilityPct | number: '1.1-1' }}%</span>
                <span class="metric-note">ATR₁₄ / Price</span>
              </div>
              <div class="metric-card" *ngIf="advice.metrics.signalFreshnessMinutes !== null">
                <span class="metric-label">Last Signal Age</span>
                <span class="metric-value">{{ advice.metrics.signalFreshnessMinutes }}m</span>
                <span class="metric-note">Time since confluence trigger</span>
              </div>
              <div class="metric-card" *ngIf="advice.metrics.momentumScore !== null">
                <span class="metric-label">Momentum Score</span>
                <span class="metric-value">{{ advice.metrics.momentumScore | number: '1.0-0' }}</span>
                <span class="metric-note">Blend of MACD • RSI • Price vs EMA</span>
              </div>
            </div>
            <ul class="advisor-list">
              <li *ngFor="let item of advice.suggestions">{{ item }}</li>
            </ul>
          </div>
        </section>
      </div>

      <div class="layout-grid layout-grid--signals">
        <section class="card signals card-list">
          <header class="card-heading">
            <h2>Strategy Signals</h2>
            <span class="card-subtitle">Full confluence entries that align trend + momentum.</span>
          </header>
          <div class="card-body">
            <p class="empty-state" *ngIf="!store.signals().length">No signals yet — load more candles or watch for the next MACD crossover.</p>
            <ul *ngIf="store.signals().length">
              <li *ngFor="let signal of store.signals().slice(-50)">
                <div class="signal-meta">
                  <span class="pill" [class.long-pill]="signal.type === 'LONG'" [class.short-pill]="signal.type === 'SHORT'">{{ signal.type }}</span>
                  <span class="price">@ {{ signal.price | number: '1.0-0' }}</span>
                  <time>{{ signal.time | date: 'yyyy-MM-dd HH:mm' }}</time>
                </div>
                <p class="signal-reason">{{ signal.reason }}</p>
              </li>
            </ul>
          </div>
        </section>

        <section class="card fast-signals card-list">
          <header class="card-heading">
            <h2>Momentum Scout Signals</h2>
            <span class="card-subtitle">Fast EMA9 / EMA21 crosses to flag early momentum shifts.</span>
          </header>
          <div class="card-body">
            <p class="empty-state" *ngIf="!store.fastSignals().length">No quick momentum signals yet — watching EMA9/EMA21 crosses.</p>
            <ul *ngIf="store.fastSignals().length">
              <li *ngFor="let signal of store.fastSignals().slice(-50)">
                <div class="signal-meta">
                  <span class="pill" [class.long-pill]="signal.type === 'LONG'" [class.short-pill]="signal.type === 'SHORT'">{{ signal.type }}</span>
                  <span class="price">@ {{ signal.price | number: '1.0-0' }}</span>
                  <time>{{ signal.time | date: 'yyyy-MM-dd HH:mm' }}</time>
                </div>
                <p class="signal-reason">{{ signal.reason }}</p>
              </li>
            </ul>
          </div>
        </section>

        <section class="card validations card-list" *ngIf="hasValidations()">
          <header class="card-heading">
            <h2>Decision Validation Log</h2>
            <span class="card-subtitle">Evaluated {{ validationHorizon() }}-bar outcome horizon.</span>
          </header>
          <div class="card-body">
            <ul>
              <li *ngFor="let validation of store.decisionValidations().slice(-20)">
                <div class="signal-meta">
                  <span class="pill" [class.long-pill]="validation.signalType === 'LONG'" [class.short-pill]="validation.signalType === 'SHORT'">{{ validation.signalType }}</span>
                  <span class="price">@ {{ validation.entryPrice | number: '1.0-0' }}</span>
                  <time>{{ validation.signalTime | date: 'yyyy-MM-dd HH:mm' }}</time>
                </div>
                <p class="signal-reason">
                  Outcome
                  <span class="outcome-pill" [class.outcome-win]="validation.outcome === 'WIN'" [class.outcome-loss]="validation.outcome === 'LOSS'" [class.outcome-pending]="validation.outcome === 'PENDING'">
                    {{ validation.outcome }}
                  </span>
                  <span *ngIf="validation.directionChangePct !== null">
                    {{ formatChange(validation.directionChangePct) }} after {{ validation.actualHorizon ?? validation.horizonCandles }} bars
                  </span>
                </p>
                <p class="signal-reason" *ngIf="validation.evaluationTime">
                  Checked at {{ validation.evaluationTime | date: 'yyyy-MM-dd HH:mm' }} · Exit @ {{ validation.exitPrice | number: '1.0-0' }}
                </p>
              </li>
            </ul>
          </div>
        </section>

        <section class="card diagnostics card-list" *ngIf="store.nearMisses().length">
          <header class="card-heading">
            <h2>Near Miss Monitor</h2>
            <span class="card-subtitle">Setups that missed by one criterion — watch for confirmation.</span>
          </header>
          <div class="card-body">
            <ul>
              <li *ngFor="let miss of store.nearMisses().slice(-10)">
                <div class="signal-meta">
                  <span class="pill" [class.long-pill]="miss.bias === 'LONG'" [class.short-pill]="miss.bias === 'SHORT'">{{ miss.bias }}</span>
                  <time>{{ miss.time | date: 'yyyy-MM-dd HH:mm' }}</time>
                </div>
                <p class="signal-reason">
                  <strong>Satisfied:</strong> {{ miss.satisfied.join(', ') || 'none' }}
                </p>
                <p class="signal-reason">
                  <strong>Missing:</strong> {{ miss.missing.join(', ') || 'none' }}
                </p>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <section class="card playbook">
        <header class="card-heading">
          <h2>6-Step Market Framework</h2>
          <span class="card-subtitle">Checklist before committing capital.</span>
        </header>
        <div class="card-body">
          <ol>
            <li>
              <h3>1. Check Market Trend (Macro Direction)</h3>
              <ul>
                <li>Focus on 4H, 1D, and 1W candles to understand the dominant direction.</li>
                <li>Price above the 200 EMA ⇒ bullish bias, prioritise long setups.</li>
              <li>Price below the 200 EMA ⇒ bearish bias, prioritise short setups.</li>
              <li>Validate with market structure: higher highs & higher lows for bulls, or lower highs & lower lows for bears.</li>
            </ul>
          </li>
          <li>
            <h3>2. Identify Key Levels</h3>
            <ul>
              <li>Mark major support and resistance zones on the 1H–4H charts.</li>
              <li>For longs, wait for confirmation around strong support; for shorts, look for rejection at resistance.</li>
              <li>Watch volume spikes or liquidity sweeps that trap traders before entering in the opposite direction.</li>
            </ul>
          </li>
          <li>
            <h3>3. Confirm With Indicators</h3>
            <ul>
              <li>RSI &lt; 30 can highlight oversold conditions for potential longs; RSI &gt; 70 can flag overbought zones for shorts.</li>
              <li>Use MACD crossovers, Stochastic RSI, or EMA crosses to confirm momentum shifts.</li>
              <li>Monitor funding rates—extreme positive values often precede contrarian short opportunities.</li>
            </ul>
          </li>
          <li>
            <h3>4. Watch BTC Dominance &amp; USDT.D</h3>
            <ul>
              <li>Rising BTC dominance implies capital rotation into BTC—consider favouring BTC longs over altcoins.</li>
              <li>Increasing USDT dominance signals risk-off behaviour and a bearish environment.</li>
            </ul>
          </li>
          <li>
            <h3>5. Use Sentiment &amp; News</h3>
            <ul>
              <li>Extreme greed in the Fear &amp; Greed Index suggests trimming longs or preparing for shorts.</li>
              <li>Extreme fear can offer asymmetric long entries.</li>
              <li>Track major macro events (Fed decisions, CPI prints, ETF headlines) that often catalyse reversals.</li>
            </ul>
          </li>
          <li>
            <h3>6. Risk Management &amp; Confirmation</h3>
            <ul>
              <li>Wait for candle closes or retests before committing to a position.</li>
              <li>Place stop-losses beyond the most recent swing and risk only 1–2% of capital per trade.</li>
              <li>Avoid chasing moves after large impulsive candles—let the market confirm strength.</li>
            </ul>
            </li>
          </ol>
        </div>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: radial-gradient(circle at top, #101828, #0b1120 55%, #020617);
        color: #e2e8f0;
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        padding: 24px 12px 48px;
      }

      .app {
        margin: 0 auto;
        max-width: 960px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
    `,
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly api = inject(MarketDataService);
  readonly store = inject(SignalsStore);

  readonly intervals: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
  readonly providers: ProviderOption[] = [
    { id: 'binance', label: 'Binance (Spot)', symbol: 'BTCUSDT' },
    { id: 'coinbase', label: 'Coinbase Advanced', symbol: 'BTC-USD' },
  ];

  private readonly intervalSignal = signal<Interval>('1m');
  private readonly providerSignal = signal<DataProvider>('binance');
  readonly auto = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly staleSignal = computed(() => {
    const latest = this.store.latestSignal();
    const lastCandle = this.store.lastCandle();
    const interval = this.intervalSignal();
    if (!latest || !lastCandle) {
      return false;
    }
    const diff = lastCandle.closeTime - latest.time;
    return diff >= this.intervalToMs(interval);
  });
  readonly providerLabel = computed(() => {
    const option = this.providers.find((item) => item.id === this.providerSignal());
    return option?.label ?? 'Binance (Spot)';
  });
  readonly trendNarrative = computed(() => {
    const details = this.store.trendDetails();
    if (!details) {
      return 'Awaiting indicator alignment.';
    }
    const { direction, confidence, score } = details;
    if (direction === 'NEUTRAL') {
      return confidence >= 45 ? 'Mixed structure — watch for breakout.' : 'No dominant bias yet.';
    }
    const tone = confidence >= 75 ? 'Strong' : confidence >= 55 ? 'Building' : 'Fragile';
    const bias = direction === 'BULL' ? 'bullish' : 'bearish';
    const alignment = Math.abs(score) >= 3 ? 'with clear confluence' : Math.abs(score) >= 2 ? 'with supportive signals' : 'but still tentative';
    return `${tone} ${bias} bias ${alignment}`;
  });
  readonly latestNearMiss = computed(() => {
    const misses = this.store.nearMisses();
    return misses.length ? misses[misses.length - 1] : null;
  });
  readonly incomeAdvice = computed<IncomeAdvice>(() =>
    generateIncomeAdvice({
      trendDetails: this.store.trendDetails(),
      latestSignal: this.store.latestSignal(),
      latestFastSignal: this.store.latestFastSignal(),
      nearMiss: this.latestNearMiss(),
      candles: this.store.candles(),
      intervalMs: this.intervalToMs(this.intervalSignal()),
      fetchError: this.error(),
      lastCandleTime: this.store.lastCandle()?.closeTime ?? null,
    }),
  );
  readonly hasValidations = computed(() => this.store.decisionValidations().length > 0);
  readonly validationHorizon = computed(() => {
    const validations = this.store.decisionValidations();
    if (!validations.length) {
      return null;
    }
    return validations[validations.length - 1].horizonCandles;
  });

  get intervalValue(): Interval {
    return this.intervalSignal();
  }

  set intervalValue(value: Interval) {
    this.intervalSignal.set(value);
  }

  get providerValue(): DataProvider {
    return this.providerSignal();
  }

  set providerValue(value: DataProvider) {
    this.providerSignal.set(value);
  }

  formatChange(change: number | null): string {
    if (change === null || !Number.isFinite(change)) {
      return 'n/a';
    }
    const magnitude = Math.abs(change);
    const precision = magnitude >= 10 ? 0 : 1;
    const rounded = change.toFixed(precision);
    const prefix = change > 0 ? '+' : '';
    return `${prefix}${rounded}%`;
  }

  factorIntensity(factor: TrendFactor): number {
    const weight = factor.weight || 1;
    if (weight === 0) {
      return 0;
    }
    return Math.min(100, Math.round((Math.abs(factor.contribution) / weight) * 100));
  }

  onIntervalChange(value: Interval): void {
    if (value === this.intervalSignal()) {
      return;
    }
    this.intervalValue = value;
    this.reload();
  }

  onProviderChange(value: DataProvider): void {
    if (value === this.providerSignal()) {
      return;
    }
    this.providerValue = value;
    this.reload();
  }

  private pollHandle?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.stopAuto();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getKlines(this.activeSymbol(), this.intervalSignal(), 600, this.providerSignal()).subscribe({
      next: (candles) => {
        this.store.candles.set(candles);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load Binance klines', err);
        this.error.set('Failed to fetch market data. Please retry in a moment.');
        this.loading.set(false);
      },
    });
  }

  toggleAuto(): void {
    if (this.auto()) {
      this.stopAuto();
    } else {
      this.startAuto();
    }
  }

  private startAuto(): void {
    this.auto.set(true);
    this.pollHandle = setInterval(() => this.reload(), 30_000);
  }

  private stopAuto(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = undefined;
    }
    this.auto.set(false);
  }

  private intervalToMs(interval: Interval): number {
    switch (interval) {
      case '1m':
        return 60_000;
      case '5m':
        return 5 * 60_000;
      case '15m':
        return 15 * 60_000;
      case '1h':
        return 60 * 60_000;
      case '4h':
        return 4 * 60 * 60_000;
      case '1d':
        return 24 * 60 * 60_000;
      default:
        return 60 * 60_000;
    }
  }

  private activeSymbol(): string {
    const provider = this.providerSignal();
    const option = this.providers.find((item) => item.id === provider);
    return option?.symbol ?? 'BTCUSDT';
  }

}
