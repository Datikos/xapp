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

      <section class="card activity-card" *ngIf="predictionActivities() as activities">
        <header class="card-heading">
          <h2>Live Directional Guidance</h2>
          <span class="card-subtitle">Current bias with recent long / short triggers.</span>
        </header>
        <div class="card-body">
          <div class="activity-live" *ngIf="liveRecommendation() as live">
            <div class="activity-live-header">
              <span class="activity-bias" [class.long]="live.direction === 'BULL'" [class.short]="live.direction === 'BEAR'">
                {{ live.direction === 'BULL' ? 'Long bias' : live.direction === 'BEAR' ? 'Short bias' : 'Neutral stance' }}
              </span>
              <span class="activity-confidence">{{ live.confidence }}% confidence · Score {{ live.score }}</span>
            </div>
            <p class="activity-live-headline" [class.positive]="live.tone === 'positive'" [class.caution]="live.tone === 'caution'">
              {{ live.headline }}
            </p>
            <p class="activity-live-meta">
              <ng-container *ngIf="live.time; else activityNow">
                Updated {{ live.time | date: 'HH:mm' }} · {{ live.time | date: 'MMM d' }}
              </ng-container>
              <ng-template #activityNow>Updated moments ago</ng-template>
              <span *ngIf="live.rationale"> · {{ live.rationale }}</span>
            </p>
          </div>
          <ng-container *ngIf="activities.length; else activityEmpty">
            <ul class="activity-list">
              <li *ngFor="let item of activities">
                <div class="activity-marker" [class.long]="item.type === 'LONG'" [class.short]="item.type === 'SHORT'">
                  <span>{{ item.type }}</span>
                </div>
                <div class="activity-content">
                  <div class="activity-headline">
                    <span class="activity-source" [class.primary]="item.band === 'primary'" [class.fast]="item.band === 'fast'">
                      {{ item.band === 'primary' ? 'Primary' : 'Fast' }}
                    </span>
                    <span class="activity-reason">{{ item.reason }}</span>
                  </div>
                  <div class="activity-meta">
                    <span>{{ item.time | date: 'HH:mm' }} · {{ item.time | date: 'MMM d' }}</span>
                    <span>Entry @ {{ item.price | number: '1.2-2' }}</span>
                  </div>
                </div>
              </li>
            </ul>
          </ng-container>
          <ng-template #activityEmpty>
            <p class="activity-empty">Signals will appear here once enough confluence is captured.</p>
          </ng-template>
        </div>
      </section>

      <section class="card chart-card" *ngIf="predictionChart() as chart">
        <header class="card-heading card-heading--split">
          <div>
            <h2>Prediction vs Reality</h2>
            <span class="card-subtitle">How realised returns lined up against directional calls.</span>
          </div>
          <div class="chart-legend">
            <span class="chart-legend-item">
              <span class="legend-swatch legend-swatch--line"></span>
              Cumulative return
            </span>
            <span class="chart-legend-item">
              <span class="legend-swatch legend-swatch--win"></span>
              Winning trade
            </span>
            <span class="chart-legend-item">
              <span class="legend-swatch legend-swatch--loss"></span>
              Losing trade
            </span>
          </div>
        </header>
        <div class="card-body chart-body">
          <div class="chart-overview">
            <div class="chart-stats">
              <div class="chart-stat">
                <span class="chart-stat-label">Hit rate</span>
                <span class="chart-stat-value">
                  {{ chart.hitRate !== null ? chart.hitRate + '%' : 'n/a' }}
                </span>
                <span class="chart-stat-note">{{ chart.wins }} wins · {{ chart.losses }} losses</span>
              </div>
              <div class="chart-stat">
                <span class="chart-stat-label">Cumulative return</span>
                <span class="chart-stat-value">{{ formatChange(chart.totalReturn) }}</span>
                <span class="chart-stat-note">Avg trade {{ formatChange(chart.averageReturn) }}</span>
              </div>
              <div class="chart-stat">
                <span class="chart-stat-label">Signal alignment</span>
                <span class="chart-stat-value">
                  {{ chart.correlation !== null ? (chart.correlation | number: '1.2-2') : 'n/a' }}
                </span>
                <span class="chart-stat-note">{{ correlationDescriptor(chart.correlation) }}</span>
              </div>
            </div>
            <p class="chart-remark">
              {{ predictionNarrative(chart.totalReturn, chart.hitRate, chart.correlation, chart.wins + chart.losses) }}
            </p>
          </div>
          <div class="prediction-chart outcome-quadrant">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <rect class="chart-panel" x="0" y="0" width="100" height="100"></rect>
              <g class="quadrant-lanes">
                <ng-container *ngFor="let lane of chart.lanes">
                  <rect
                    class="lane-band"
                    [class.lane-positive]="lane.expected === 1"
                    [class.lane-negative]="lane.expected === -1"
                    [class.lane-neutral]="lane.expected === 0"
                    [attr.x]="chart.bounds.left"
                    [attr.y]="lane.bandY"
                    [attr.width]="chart.bounds.width"
                    [attr.height]="lane.bandHeight"
                  ></rect>
                  <rect
                    class="lane-alignment"
                    *ngIf="lane.alignmentRect"
                    [attr.x]="lane.alignmentRect.x"
                    [attr.y]="lane.bandY"
                    [attr.width]="lane.alignmentRect.width"
                    [attr.height]="lane.bandHeight"
                  ></rect>
                  <text class="lane-label" [attr.x]="lane.labelX" [attr.y]="lane.labelY">
                    {{ lane.label }}
                  </text>
                </ng-container>
              </g>
              <line
                class="quadrant-axis"
                [attr.x1]="chart.zeroX"
                [attr.y1]="chart.bounds.top"
                [attr.x2]="chart.zeroX"
                [attr.y2]="chart.bounds.bottom"
              ></line>
              <g class="quadrant-ticks">
                <ng-container *ngFor="let tick of chart.ticks">
                  <line
                    class="quadrant-tick"
                    [attr.x1]="tick.x"
                    [attr.x2]="tick.x"
                    [attr.y1]="chart.bounds.top"
                    [attr.y2]="chart.bounds.bottom"
                  ></line>
                  <text class="quadrant-tick-label" [attr.x]="tick.x" [attr.y]="chart.bounds.bottom + 6">
                    {{ formatChange(tick.value) }}
                  </text>
                </ng-container>
              </g>
              <g class="quadrant-points">
                <g
                  *ngFor="let point of chart.points"
                  class="quadrant-point"
                  [class.point-win]="point.outcome === 'WIN'"
                  [class.point-loss]="point.outcome === 'LOSS'"
                  [class.point-pending]="point.outcome === 'PENDING'"
                  [class.point-aligned]="point.aligned"
                >
                  <circle [attr.cx]="point.x" [attr.cy]="point.y" [attr.r]="point.radius"></circle>
                  <text
                    *ngIf="point.showLabel"
                    class="quadrant-point-label"
                    [attr.x]="point.labelX"
                    [attr.y]="point.labelY"
                  >
                    {{ formatChange(point.actual) }}
                  </text>
                  <title>
                    {{ point.outcome }} {{ formatChange(point.actual) }} ({{ point.expected === 1 ? 'LONG' : point.expected === -1 ? 'SHORT' : 'FLAT' }})
                    · {{ point.time | date: 'yyyy-MM-dd HH:mm' }}
                  </title>
                </g>
              </g>
            </svg>
            <div class="lane-summaries">
              <article class="lane-card" *ngFor="let lane of chart.laneSummaries">
                <header>
                  <span class="lane-card-label">{{ lane.label }}</span>
                  <span class="lane-card-total">{{ lane.total }} trades</span>
                </header>
                <p class="lane-card-metric">
                  Alignment
                  <span class="lane-card-value">
                    {{ lane.alignmentRate !== null ? lane.alignmentRate + '%' : 'n/a' }}
                  </span>
                </p>
                <p class="lane-card-metric">
                  Avg return
                  <span class="lane-card-value">{{ lane.averageReturn !== null ? formatChange(lane.averageReturn) : 'n/a' }}</span>
                </p>
                <p class="lane-card-meta">
                  Wins {{ lane.wins }} · Losses {{ lane.losses }} · Pending {{ lane.pending }}
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section class="card pattern-card" *ngIf="patternInsights() as patterns">
        <header class="card-heading card-heading--split">
          <div>
            <h2>Pattern Research</h2>
            <span class="card-subtitle">Average outcomes for recurring signal setups.</span>
          </div>
          <div class="pattern-summary" *ngIf="patternSummary() as summary">
            <span class="pattern-summary-bias" [class.long]="summary.dominantBias === 'BULL'" [class.short]="summary.dominantBias === 'BEAR'">
              {{ summary.dominantBias === 'BULL' ? 'Bullish skew' : 'Bearish skew' }}
            </span>
            <span class="pattern-summary-stat">Avg {{ formatChange(summary.meanAverageReturn) }}</span>
            <span class="pattern-summary-stat">Win rate {{ summary.combinedWinRate }}%</span>
          </div>
        </header>
        <div class="card-body pattern-body">
          <ng-container *ngIf="patterns.length; else patternEmpty">
            <ul class="pattern-list">
              <li *ngFor="let pattern of patterns">
                <div class="pattern-header">
                  <span class="pattern-label">{{ pattern.label }}</span>
                  <span class="pattern-pill" [class.long-pill]="pattern.type === 'LONG'" [class.short-pill]="pattern.type === 'SHORT'">
                    {{ pattern.type }}
                  </span>
                </div>
                <div class="pattern-metrics">
                  <div>
                    <span class="pattern-metric-label">Avg Return</span>
                    <span class="pattern-metric-value">{{ formatChange(pattern.averageReturn) }}</span>
                  </div>
                  <div>
                    <span class="pattern-metric-label">Win Rate</span>
                    <span class="pattern-metric-value">{{ pattern.winRate }}%</span>
                  </div>
                  <div>
                    <span class="pattern-metric-label">Sample Size</span>
                    <span class="pattern-metric-value">{{ pattern.occurrences }}</span>
                  </div>
                  <div>
                    <span class="pattern-metric-label">Risk / Reward</span>
                    <span class="pattern-metric-value">
                      {{ pattern.riskReward !== null ? pattern.riskReward : 'n/a' }}
                    </span>
                  </div>
                </div>
                <div class="pattern-range">
                  <span class="pattern-range-label">Range</span>
                  <span class="pattern-range-value">
                    {{ pattern.bestReturn !== null ? formatChange(pattern.bestReturn) : 'n/a' }} /
                    {{ pattern.worstReturn !== null ? formatChange(pattern.worstReturn) : 'n/a' }}
                  </span>
                </div>
              </li>
            </ul>
          </ng-container>
          <ng-template #patternEmpty>
            <p class="pattern-empty">Not enough completed trades to surface pattern insights yet.</p>
          </ng-template>
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
          <header class="card-heading card-heading--split">
            <div>
              <h2>Trend Confidence</h2>
              <span class="card-subtitle">EMA, MACD, and RSI blend for current bias.</span>
            </div>
            <div class="trend-heading-pill">
              <span class="trend-badge" [class.long]="trendDetails.direction === 'BULL'" [class.short]="trendDetails.direction === 'BEAR'">
                {{ trendDetails.direction }} · {{ trendDetails.confidence }}%
              </span>
              <span class="trend-score">Score {{ trendDetails.score }}</span>
            </div>
          </header>
          <div class="card-body trend-body">
            <div class="trend-overview">
              <p class="trend-narrative">{{ trendNarrative() }}</p>
              <div class="confidence-meter">
                <div class="confidence-meter-track">
                  <div
                    class="confidence-meter-fill"
                    [style.width.%]="trendDetails.confidence"
                    [class.confidence-strong]="trendDetails.confidence >= 65"
                    [class.confidence-medium]="trendDetails.confidence >= 45 && trendDetails.confidence < 65"
                  ></div>
                </div>
                <div class="confidence-meter-meta">
                  <span>0%</span>
                  <span>{{ trendDetails.confidence }}%</span>
                  <span>100%</span>
                </div>
              </div>
              <div class="trend-mini-metrics">
                <div class="mini-metric">
                  <span class="mini-label">Bias</span>
                  <span class="mini-value" [class.long]="trendDetails.direction === 'BULL'" [class.short]="trendDetails.direction === 'BEAR'">
                    {{ trendDetails.direction }}
                  </span>
                </div>
                <div class="mini-metric">
                  <span class="mini-label">Confidence</span>
                  <span class="mini-value">{{ trendDetails.confidence }}%</span>
                </div>
                <div class="mini-metric">
                  <span class="mini-label">Score</span>
                  <span class="mini-value">{{ trendDetails.score }}</span>
                </div>
              </div>
            </div>

            <div class="trend-factor-groups" *ngIf="groupedTrendFactors() as buckets">
              <div class="factor-column">
                <h3>Tailwinds</h3>
                <ng-container *ngIf="buckets.tailwinds.length; else tailwindEmpty">
                  <article class="factor-card bullish" *ngFor="let factor of buckets.tailwinds">
                    <header class="factor-card-header">
                      <span class="pill small long-pill">Bullish</span>
                      <span class="factor-label">{{ factor.label }}</span>
                      <span class="factor-weight">w{{ factor.weight }}</span>
                    </header>
                    <div class="factor-strength">
                      <div class="factor-strength-fill" [style.width.%]="factorIntensity(factor)"></div>
                    </div>
                    <p class="factor-detail">{{ factor.detail }}</p>
                  </article>
                </ng-container>
                <ng-template #tailwindEmpty>
                  <p class="factor-empty">No bullish support right now.</p>
                </ng-template>
              </div>

              <div class="factor-column">
                <h3>Headwinds</h3>
                <ng-container *ngIf="buckets.headwinds.length; else headwindEmpty">
                  <article class="factor-card bearish" *ngFor="let factor of buckets.headwinds">
                    <header class="factor-card-header">
                      <span class="pill small short-pill">Bearish</span>
                      <span class="factor-label">{{ factor.label }}</span>
                      <span class="factor-weight">w{{ factor.weight }}</span>
                    </header>
                    <div class="factor-strength negative">
                      <div class="factor-strength-fill" [style.width.%]="factorIntensity(factor)"></div>
                    </div>
                    <p class="factor-detail">{{ factor.detail }}</p>
                  </article>
                </ng-container>
                <ng-template #headwindEmpty>
                  <p class="factor-empty">No bearish pressure detected.</p>
                </ng-template>
              </div>

              <div class="factor-column neutral" *ngIf="buckets.neutral.length">
                <h3>Neutral Reads</h3>
                <article class="factor-card neutral" *ngFor="let factor of buckets.neutral">
                  <header class="factor-card-header">
                    <span class="pill small">Neutral</span>
                    <span class="factor-label">{{ factor.label }}</span>
                    <span class="factor-weight">w{{ factor.weight }}</span>
                  </header>
                  <p class="factor-detail">{{ factor.detail }}</p>
                </article>
              </div>
            </div>
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
  readonly predictionActivities = computed(() => {
    const primarySignals = this.store.signals();
    const fastSignals = this.store.fastSignals();
    if (!primarySignals.length && !fastSignals.length) {
      return [];
    }

    const primaryFeed = primarySignals.map((signal) => ({
      id: `primary-${signal.time}`,
      band: 'primary' as const,
      type: signal.type,
      time: signal.time,
      price: signal.price,
      reason: signal.reason,
    }));
    const fastFeed = fastSignals.map((signal) => ({
      id: `fast-${signal.time}`,
      band: 'fast' as const,
      type: signal.type,
      time: signal.time,
      price: signal.price,
      reason: signal.reason,
    }));

    return [...primaryFeed, ...fastFeed]
      .filter((item) => Number.isFinite(item.time))
      .sort((a, b) => b.time - a.time)
      .slice(0, 8);
  });
  readonly patternInsights = computed(() => this.store.patternAnalytics().patterns);
  readonly patternSummary = computed(() => this.store.patternAnalytics().summary);
  readonly liveRecommendation = computed(() => {
    const trend = this.store.trendDetails();
    if (!trend) {
      return null;
    }
    const advice = this.incomeAdvice();
    const lastTime = this.store.lastCandle()?.closeTime ?? null;
    return {
      direction: trend.direction,
      confidence: trend.confidence,
      score: trend.score,
      headline: advice?.headline ?? (trend.direction === 'NEUTRAL' ? 'Standby — no dominant edge right now.' : 'Maintain bias, watch execution.'),
      tone: advice?.tone ?? 'neutral',
      rationale: advice?.rationale ?? null,
      time: lastTime,
    };
  });
  readonly groupedTrendFactors = computed(() => {
    const details = this.store.trendDetails();
    if (!details) {
      return {
        tailwinds: [] as TrendFactor[],
        headwinds: [] as TrendFactor[],
        neutral: [] as TrendFactor[],
      };
    }
    const tailwinds = details.factors.filter((factor) => factor.direction === 'BULL');
    const headwinds = details.factors.filter((factor) => factor.direction === 'BEAR');
    const neutral = details.factors.filter((factor) => factor.direction === 'NEUTRAL');
    return { tailwinds, headwinds, neutral };
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

    const rawPoints = analytics.points;
    const allActuals = rawPoints.map((point) => point.actual);
    const minActual = Math.min(0, ...allActuals);
    const maxActual = Math.max(0, ...allActuals);
    const maxAbsActual = Math.max(Math.abs(minActual), Math.abs(maxActual), 0.5);
    const xMin = -maxAbsActual;
    const xMax = maxAbsActual;

    const marginLeft = 12;
    const marginRight = 10;
    const marginTop = 12;
    const marginBottom = 12;
    const bounds = {
      left: marginLeft,
      right: 100 - marginRight,
      top: marginTop,
      bottom: 100 - marginBottom,
    };
    const boundsWidth = bounds.right - bounds.left;
    const boundsHeight = bounds.bottom - bounds.top;
    const scaleX = (value: number) => {
      if (xMax - xMin === 0) {
        return bounds.left + boundsWidth / 2;
      }
      return bounds.left + ((value - xMin) / (xMax - xMin)) * boundsWidth;
    };
    const zeroX = scaleX(0);

    const laneHeight = 20;
    const laneGap = 8;
    const laneDefinitions = [
      { expected: 1 as const, label: 'Long calls', tone: 'positive' as const },
      { expected: 0 as const, label: 'Flat guidance', tone: 'neutral' as const },
      { expected: -1 as const, label: 'Short calls', tone: 'negative' as const },
    ];
    const lanes = laneDefinitions.map((definition, index) => {
      const bandY = marginTop + index * (laneHeight + laneGap);
      const bandHeight = laneHeight;
      const center = bandY + bandHeight / 2;
      const labelX = Math.max(2, marginLeft - 4);
      const labelY = Math.min(98, center + 1.8);
      let alignmentRect: { x: number; width: number } | null = null;
      if (definition.expected === 1) {
        const width = Math.max(0, bounds.right - zeroX);
        if (width > 0.5) {
          alignmentRect = { x: zeroX, width };
        }
      } else if (definition.expected === -1) {
        const width = Math.max(0, zeroX - bounds.left);
        if (width > 0.5) {
          alignmentRect = { x: bounds.left, width };
        }
      } else {
        const tolerance = Math.max(0.2, maxAbsActual * 0.15);
        const left = scaleX(-tolerance);
        const right = scaleX(tolerance);
        const width = Math.max(0, right - left);
        if (width > 0.5) {
          alignmentRect = { x: left, width };
        }
      }
      return {
        ...definition,
        bandY,
        bandHeight,
        center,
        labelX,
        labelY,
        alignmentRect,
      };
    });
    const laneMap = new Map(lanes.map((lane) => [lane.expected, lane]));
    const laneCounters = new Map<number, number>();

    const magnitudeRanking = rawPoints
      .map((point, index) => ({ index, magnitude: Math.abs(point.actual) }))
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, Math.min(4, rawPoints.length))
      .map((entry) => entry.index);
    const labelledSet = new Set(magnitudeRanking);

    const points = rawPoints.map((point, index) => {
      const lane = laneMap.get(point.expected) ?? laneMap.get(0)!;
      const laneCount = laneCounters.get(lane.expected) ?? 0;
      laneCounters.set(lane.expected, laneCount + 1);
      const jitter = ((laneCount % 3) - 1) * 2.4;
      const y = Math.min(bounds.bottom - 2, Math.max(bounds.top + 2, lane.center + jitter));
      const x = scaleX(point.actual);
      const magnitudeRatio = Math.min(Math.abs(point.actual), maxAbsActual) / maxAbsActual;
      const radius = 2.2 + magnitudeRatio * 4;
      const aligned =
        lane.expected === 1
          ? point.actual > 0
          : lane.expected === -1
            ? point.actual < 0
            : Math.abs(point.actual) <= Math.max(0.1, maxAbsActual * 0.05);
      const showLabel = labelledSet.has(index);
      const labelOffset = point.actual >= 0 ? 4 : -4;
      const labelX = Math.min(bounds.right - 1, Math.max(bounds.left + 1, x + labelOffset));
      const labelY = Math.max(bounds.top + 4, Math.min(bounds.bottom - 1, y - 3));

      return {
        ...point,
        x,
        y,
        radius,
        aligned,
        showLabel,
        labelX,
        labelY,
      };
    });

    const wins = points.filter((point) => point.outcome === 'WIN').length;
    const losses = points.filter((point) => point.outcome === 'LOSS').length;
    const tradeCount = wins + losses;
    const totalActual = points.reduce((acc, point) => acc + point.actual, 0);
    const averageReturn = tradeCount ? totalActual / tradeCount : null;
    const hitRate = tradeCount ? Math.round((wins / tradeCount) * 100) : null;

    const laneSummaries = lanes.map((lane) => {
      const lanePoints = points.filter((point) => point.expected === lane.expected);
      const laneWins = lanePoints.filter((point) => point.outcome === 'WIN').length;
      const laneLosses = lanePoints.filter((point) => point.outcome === 'LOSS').length;
      const lanePending = lanePoints.filter((point) => point.outcome === 'PENDING').length;
      const laneAlignment =
        lanePoints.length ? Math.round((lanePoints.filter((point) => point.aligned).length / lanePoints.length) * 100) : null;
      const laneAverage = lanePoints.length
        ? lanePoints.reduce((acc, point) => acc + point.actual, 0) / lanePoints.length
        : null;
      return {
        label: lane.label,
        expected: lane.expected,
        total: lanePoints.length,
        wins: laneWins,
        losses: laneLosses,
        pending: lanePending,
        alignmentRate: laneAlignment,
        averageReturn: laneAverage,
      };
    });

    const ticks = Array.from({ length: 5 }, (_, idx) => {
      const value = xMin + ((xMax - xMin) * idx) / 4;
      return { value, x: scaleX(value) };
    });

    return {
      lanes,
      points,
      zeroX,
      bounds: {
        ...bounds,
        width: boundsWidth,
        height: boundsHeight,
      },
      ticks,
      wins,
      losses,
      tradeCount,
      hitRate,
      averageReturn,
      totalReturn: analytics.totalReturn,
      correlation: analytics.correlation,
      laneSummaries,
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

  correlationDescriptor(value: number | null): string {
    if (value === null) {
      return 'Awaiting more closed trades';
    }
    if (value >= 0.65) {
      return 'Strong alignment with reality';
    }
    if (value >= 0.35) {
      return 'Moderate alignment';
    }
    if (value >= 0) {
      return 'Light positive alignment';
    }
    if (value >= -0.35) {
      return 'Slightly inverted';
    }
    return 'Inverted vs expectations';
  }

  predictionNarrative(
    totalReturn: number,
    hitRate: number | null,
    correlation: number | null,
    tradeCount: number,
  ): string {
    if (tradeCount === 0) {
      return 'Once a few trades settle we will surface how signals are tracking live outcomes.';
    }
    const returnTone =
      totalReturn > 0
        ? 'Net gains show the confluence is adding edge.'
        : totalReturn < 0
          ? 'Drawdown indicates the model is trailing live price action.'
          : 'Returns are flat versus expectations so far.';
    let alignmentTone: string;
    if (correlation === null) {
      alignmentTone = 'Need additional closed trades to gauge alignment.';
    } else if (correlation >= 0.65) {
      alignmentTone = 'Alignment is strong, so the directional bias can be trusted.';
    } else if (correlation >= 0.35) {
      alignmentTone = 'Alignment is decent but still warrants confirmation.';
    } else if (correlation >= 0) {
      alignmentTone = 'Alignment is light — blend in discretionary context.';
    } else {
      alignmentTone = 'Signals are inverted right now — lean on defensive positioning.';
    }
    let hitRateTone = '';
    if (hitRate !== null) {
      if (hitRate >= 60) {
        hitRateTone = ' Hit rate is solid and supports active follow-through.';
      } else if (hitRate >= 45) {
        hitRateTone = ' Hit rate sits near breakeven — be selective.';
      } else {
        hitRateTone = ' Hit rate is soft — focus on high conviction setups only.';
      }
    }
    return `${returnTone} ${alignmentTone}${hitRateTone}`.trim();
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
