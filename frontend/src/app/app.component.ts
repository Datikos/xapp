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

      <section class="card chart-card" *ngIf="predictionChart() as chart">
        <header class="card-heading">
          <h2>Prediction vs Reality</h2>
          <span class="card-subtitle">Cumulative return path and realised outcomes.</span>
        </header>
        <div class="card-body chart-body">
          <div class="prediction-chart">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="rgba(56,189,248,0.55)"></stop>
                  <stop offset="100%" stop-color="rgba(56,189,248,0)"></stop>
                </linearGradient>
              </defs>
              <rect class="chart-panel" x="0" y="0" width="100" height="100"></rect>
              <g class="chart-grid">
                <ng-container *ngFor="let tick of chart.yTicks">
                  <line class="chart-grid-line" x1="0" [attr.y1]="tick.y" x2="100" [attr.y2]="tick.y"></line>
                </ng-container>
              </g>
              <g class="chart-y-labels">
                <ng-container *ngFor="let tick of chart.yTicks">
                  <text class="chart-tick-label" x="1.6" [attr.y]="tick.y - 1.2">{{ formatChange(tick.value) }}</text>
                </ng-container>
              </g>
              <path class="chart-area" [attr.d]="chart.areaPath" fill="url(#chartAreaGradient)"></path>
              <path class="chart-line" [attr.d]="chart.linePath"></path>
              <line class="chart-zero-line" x1="0" [attr.y1]="chart.zeroLine" x2="100" [attr.y2]="chart.zeroLine"></line>
              <g class="chart-bars">
                <ng-container *ngFor="let bar of chart.bars">
                  <rect
                    class="chart-bar"
                    [class.bar-positive]="bar.positive"
                    [class.bar-negative]="!bar.positive"
                    [attr.x]="bar.x"
                    [attr.y]="bar.y"
                    [attr.width]="bar.width"
                    [attr.height]="bar.height"
                  >
                    <title>
                      {{ formatChange(bar.actual) }} outcome: {{ bar.outcome }} (expected
                      {{ bar.expected === 1 ? 'LONG' : bar.expected === -1 ? 'SHORT' : 'FLAT' }})
                    </title>
                  </rect>
                  <line
                    *ngIf="bar.expected === 1"
                    class="expected-marker expected-up"
                    [attr.x1]="bar.center"
                    [attr.x2]="bar.center"
                    [attr.y1]="bar.y - 1.5"
                    [attr.y2]="bar.y - 5"
                  ></line>
                  <line
                    *ngIf="bar.expected === -1"
                    class="expected-marker expected-down"
                    [attr.x1]="bar.center"
                    [attr.x2]="bar.center"
                    [attr.y1]="chart.baselineY + 1"
                    [attr.y2]="chart.baselineY + 5"
                  ></line>
                  <circle
                    *ngIf="bar.expected === 0"
                    class="expected-marker expected-flat"
                    [attr.cx]="bar.center"
                    [attr.cy]="chart.baselineY + 1.8"
                    r="1.1"
                  ></circle>
                </ng-container>
              </g>
              <g class="chart-points">
                <circle
                  *ngFor="let point of chart.scatter"
                  class="chart-point"
                  [class.point-win]="point.outcome === 'WIN'"
                  [class.point-loss]="point.outcome === 'LOSS'"
                  [class.point-pending]="point.outcome === 'PENDING'"
                  [attr.cx]="point.x"
                  [attr.cy]="point.y"
                  r="2.2"
                >
                  <title>
                    {{ point.outcome }} {{ formatChange(point.actual) }} ({{ point.expected === 1 ? 'LONG' : point.expected === -1 ? 'SHORT' : 'FLAT' }})
                    · {{ point.time | date: 'yyyy-MM-dd HH:mm' }}
                  </title>
                </circle>
              </g>
              <line class="chart-x-axis" x1="0" [attr.y1]="chart.xAxisY" x2="100" [attr.y2]="chart.xAxisY"></line>
              <g class="chart-x-labels">
                <ng-container *ngFor="let label of chart.xLabels">
                  <text class="chart-x-label" [attr.x]="label.x" [attr.y]="chart.xAxisY + 6">{{ label.time | date: 'MM-dd' }}</text>
                </ng-container>
              </g>
            </svg>
          </div>
          <dl class="chart-summary">
            <div>
              <dt>Correlation</dt>
              <dd>{{ chart.correlation !== null ? (chart.correlation | number: '1.2-2') : 'n/a' }}</dd>
            </div>
            <div>
              <dt>Generated Return</dt>
              <dd>{{ formatChange(chart.totalReturn) }}</dd>
            </div>
            <div>
              <dt>Evaluated Trades</dt>
              <dd>{{ chart.scatter.length }}</dd>
            </div>
          </dl>
        </div>
      </section>

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

              <article class="status-card health-card" *ngIf="!loading() && !error() && store.strategyHealth() as health">
                <h3>Strategy Health</h3>
                <div class="health-metrics">
                  <div>
                    <span class="metric-label">Expectancy</span>
                    <span class="metric-value">{{ formatChange(health.expectancy) }}</span>
                  </div>
                  <div>
                    <span class="metric-label">Profit Factor</span>
                    <span class="metric-value">{{ formatProfitFactor(health.profitFactor) }}</span>
                  </div>
                  <div>
                    <span class="metric-label">Max Drawdown</span>
                    <span class="metric-value drawdown">{{ formatChange(health.maxDrawdown) }}</span>
                  </div>
                </div>
                <p class="health-summary">
                  Avg win {{ formatChange(health.averageGain) }} · Avg loss {{ formatChange(health.averageLoss) }} · Win streak {{ health.bestWinStreak }} / Loss streak
                  {{ health.bestLossStreak }}
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
              <li *ngFor="let signal of store.signals().slice(-30)">
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
              <li *ngFor="let signal of store.fastSignals().slice(-30)">
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
              <li *ngFor="let validation of store.decisionValidations().slice(-15)">
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
        padding: 20px 12px 36px;
      }

      .app {
        margin: 0 auto;
        max-width: 940px;
        display: flex;
        flex-direction: column;
        gap: 18px;
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
  readonly predictionChart = computed(() => {
    const analytics = this.store.validationAnalytics();
    if (!analytics || !analytics.points.length) {
      return null;
    }

    const points = analytics.points;
    const domainIndices = Math.max(points.length - 1, 1);
    const xAt = (index: number) => (points.length === 1 ? 50 : (index / domainIndices) * 100);
    const columnWidth = points.length ? 100 / points.length : 100;
    const effectiveWidth = Math.min(12, Math.max(4, columnWidth * 0.6));

    const marginTop = 8;
    const lineHeight = 42;
    const baselineY = marginTop + lineHeight;
    const barMaxHeight = 24;
    const xAxisY = baselineY + barMaxHeight + 4;

    const allActuals = points.map((point) => point.actual);
    const allCumulative = points.map((point) => point.cumulative);
    let minValue = Math.min(0, ...allActuals, ...allCumulative);
    let maxValue = Math.max(0, ...allActuals, ...allCumulative);
    if (Math.abs(maxValue - minValue) < 1e-6) {
      const pad = Math.max(Math.abs(maxValue) || 1, 1);
      minValue -= pad / 2;
      maxValue += pad / 2;
    }
    const range = maxValue - minValue || 1;
    const yAt = (value: number) => {
      const clamped = (value - minValue) / range;
      return marginTop + (1 - clamped) * lineHeight;
    };

    const linePath = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(3)},${yAt(point.cumulative).toFixed(3)}`)
      .join(' ');

    const zeroLine = yAt(0);
    const areaPathParts: string[] = [];
    const firstX = xAt(0).toFixed(3);
    const lastX = xAt(points.length - 1).toFixed(3);
    areaPathParts.push(`M${firstX},${zeroLine.toFixed(3)}`);
    points.forEach((point, index) => {
      areaPathParts.push(`L${xAt(index).toFixed(3)},${yAt(point.cumulative).toFixed(3)}`);
    });
    areaPathParts.push(`L${lastX},${zeroLine.toFixed(3)}`);
    areaPathParts.push('Z');
    const areaPath = areaPathParts.join(' ');

    const maxAbsActual = Math.max(...allActuals.map((value) => Math.abs(value)), 0.5);
    const bars = points.map((point, index) => {
      const center = points.length === 1 ? 50 : (index + 0.5) * columnWidth;
      const width = effectiveWidth;
      const x = Math.min(Math.max(0, center - width / 2), 100 - width);
      const barMagnitude = (Math.abs(point.actual) / maxAbsActual) * barMaxHeight;
      const height = Math.max(barMagnitude, 0.6);
      const positive = point.actual >= 0;
      const y = positive ? baselineY - height : baselineY;

      return {
        x,
        y,
        width,
        height,
        center,
        positive,
        expected: point.expected,
        time: point.time,
        actual: point.actual,
        outcome: point.outcome,
      };
    });

    const scatter = points.map((point, index) => ({
      x: xAt(index),
      y: yAt(point.cumulative),
      outcome: point.outcome,
      expected: point.expected,
      actual: point.actual,
      time: point.time,
    }));

    const tickCount = 5;
    const yTicks = Array.from({ length: tickCount }, (_, idx) => {
      const value = minValue + (range * idx) / (tickCount - 1);
      return {
        value,
        y: yAt(value),
      };
    });

    const labelIndices = Array.from(
      new Set([0, Math.floor(points.length / 2), points.length - 1].filter((idx) => idx >= 0)),
    ).sort((a, b) => a - b);
    const xLabels = labelIndices.map((index) => ({
      x: points.length === 1 ? 50 : (index / domainIndices) * 100,
      time: points[index]?.time ?? null,
    }));

    return {
      linePath,
      areaPath,
      scatter,
      zeroLine,
      bars,
      minValue,
      maxValue,
      totalReturn: analytics.totalReturn,
      correlation: analytics.correlation,
      yTicks,
      xLabels,
      baselineY,
      xAxisY,
    };
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

  formatProfitFactor(value: number | null): string {
    if (value === null) {
      return 'n/a';
    }
    if (!Number.isFinite(value)) {
      return '∞';
    }
    return value >= 10 ? value.toFixed(1) : value.toFixed(2);
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
