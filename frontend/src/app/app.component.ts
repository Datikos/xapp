import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { BinanceKlinesService } from './services/binance-klines.service';
import { SignalsStore } from './store/signals.store';
import { Interval } from './models/candle.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="app">
      <header class="hero">
        <h1>BTC/USDT Directional Playbook</h1>
        <p>Angular 17 signals-driven dashboard for EMA, MACD, and RSI confluence.</p>
      </header>

      <section class="card controls">
        <h2>Data Controls</h2>
        <div class="control-row">
          <label>
            Interval
            <select [(ngModel)]="interval" (change)="reload()">
              <option *ngFor="let option of intervals" [value]="option">{{ option }}</option>
            </select>
          </label>
          <button type="button" (click)="reload()" [disabled]="loading">{{ loading ? 'Loading…' : 'Reload now' }}</button>
          <button type="button" (click)="toggleAuto()">{{ auto ? 'Stop auto (30s)' : 'Auto refresh (30s)' }}</button>
          <span class="trend" [class.bullish]="store.trend() === 'BULL'" [class.bearish]="store.trend() === 'BEAR'">
            Trend: {{ store.trend() }}
          </span>
        </div>
        <p class="status" *ngIf="error">⚠️ {{ error }}</p>
        <p class="status" *ngIf="!error && loading">Fetching latest candles…</p>
        <p class="status" *ngIf="!loading && store.latestSignal()">
          Latest signal: <strong [class.long]="store.latestSignal()?.type === 'LONG'" [class.short]="store.latestSignal()?.type === 'SHORT'">
            {{ store.latestSignal()?.type }}
          </strong>
          @ {{ store.latestSignal()?.price | number: '1.0-0' }}
          on {{ store.latestSignal()?.time | date: 'yyyy-MM-dd HH:mm' }}
        </p>
      </section>

      <section class="card signals">
        <h2>Strategy Signals</h2>
        <p *ngIf="!store.signals().length">No signals yet — load more candles or wait for a MACD crossover.</p>
        <ul *ngIf="store.signals().length">
          <li *ngFor="let signal of store.signals().slice(-50); let last = last">
            <strong [class.long]="signal.type === 'LONG'" [class.short]="signal.type === 'SHORT'">{{ signal.type }}</strong>
            @ {{ signal.price | number: '1.0-0' }} — {{ signal.reason }} —
            <time>{{ signal.time | date: 'yyyy-MM-dd HH:mm' }}</time>
          </li>
        </ul>
      </section>

      <section class="card playbook">
        <h2>6-Step Market Framework</h2>
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

      .card {
        background: rgba(15, 23, 42, 0.75);
        border: 1px solid rgba(148, 163, 184, 0.12);
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
        backdrop-filter: blur(10px);
      }

      .hero {
        text-align: center;
        padding-bottom: 8px;
      }

      .hero h1 {
        margin: 0 0 8px;
        font-size: clamp(1.8rem, 4vw, 2.6rem);
        font-weight: 700;
      }

      .hero p {
        margin: 0;
        color: #94a3b8;
      }

      .controls .control-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }

      label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-weight: 600;
        color: #cbd5f5;
      }

      select,
      button {
        border-radius: 8px;
        border: 1px solid rgba(148, 163, 184, 0.25);
        padding: 8px 14px;
        background: rgba(15, 23, 42, 0.6);
        color: inherit;
        font-size: 0.95rem;
      }

      button {
        cursor: pointer;
        transition: transform 0.15s ease, background 0.15s ease;
      }

      button:hover {
        transform: translateY(-1px);
        background: rgba(59, 130, 246, 0.18);
      }

      button[disabled] {
        cursor: wait;
        opacity: 0.6;
      }

      .trend {
        padding: 6px 14px;
        border-radius: 999px;
        font-weight: 600;
        background: rgba(148, 163, 184, 0.2);
      }

      .trend.bullish {
        background: rgba(34, 197, 94, 0.16);
        color: #bbf7d0;
      }

      .trend.bearish {
        background: rgba(248, 113, 113, 0.16);
        color: #fecaca;
      }

      .status {
        margin: 12px 0 0;
        color: #94a3b8;
      }

      .signals ul {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 0;
        padding: 0;
        list-style: none;
        max-height: 340px;
        overflow-y: auto;
      }

      .signals li {
        padding: 12px 16px;
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.55);
        border: 1px solid rgba(148, 163, 184, 0.12);
      }

      .signals strong.long {
        color: #4ade80;
      }

      .signals strong.short {
        color: #f87171;
      }

      .signals time {
        color: #94a3b8;
        font-size: 0.85rem;
      }

      .playbook ol {
        margin: 0;
        padding-left: 20px;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .playbook h3 {
        margin: 0 0 10px;
        font-size: 1.1rem;
      }

      .playbook ul {
        margin: 0;
        padding-left: 18px;
        color: #cbd5f5;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      @media (max-width: 640px) {
        .controls .control-row {
          flex-direction: column;
          align-items: stretch;
        }

        select,
        button,
        .trend {
          width: 100%;
          text-align: center;
        }

        .signals ul {
          max-height: 440px;
        }
      }
    `,
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly api = inject(BinanceKlinesService);
  readonly store = inject(SignalsStore);

  readonly intervals: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

  interval: Interval = '1h';
  auto = false;
  loading = false;
  error: string | null = null;

  private pollHandle?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.stopAuto();
  }

  reload(): void {
    this.loading = true;
    this.error = null;

    this.api.getKlines('BTCUSDT', this.interval, 600).subscribe({
      next: (candles) => {
        this.store.candles.set(candles);
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load Binance klines', err);
        this.error = 'Failed to fetch market data. Please retry in a moment.';
        this.loading = false;
      },
    });
  }

  toggleAuto(): void {
    if (this.auto) {
      this.stopAuto();
    } else {
      this.startAuto();
    }
  }

  private startAuto(): void {
    this.auto = true;
    this.pollHandle = setInterval(() => this.reload(), 30_000);
  }

  private stopAuto(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = undefined;
    }
    this.auto = false;
  }
}
