import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type {
  ApexAnnotations,
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexMarkers,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';

import { SignalsStore } from './store/signals.store';
import type { PatternInsight, PatternSummary } from './store/signals.store';
import { Interval } from './models/candle.model';
import type { AssetOption } from './models/asset.model';
import { MarketDataService } from './services/market-data.service';
import { TrendFactor } from './lib/strategy';
import { IncomeAdvice, generateIncomeAdvice } from './lib/advisor';
import { NewsDataService, NewsFilter } from './services/news-data.service';
import { PredictionHistoryService } from './services/prediction-history.service';
import { formatChange, formatCountdown, formatProfitFactor } from './lib/formatting';
import { environment } from '../environments/environment';
import type { DataProvider, ProviderOption } from './models/provider.model';
import type {
  CandleChartConfig,
  DashboardTile,
  ExpectedLane,
  LiveRecommendationSummary,
  NewsPredictionSeries,
  PredictionReviewWindow,
  PredictionActivity,
  PriceChangeChartConfig,
  QuadrantChartPoint,
  PredictionChartView,
} from './models/dashboard.model';
import { PriceCardComponent } from './components/price-card/price-card.component';
import { CandleCardComponent } from './components/candle-card/candle-card.component';
import { SnapshotStripComponent } from './components/snapshot-strip/snapshot-strip.component';
import { ActivityCardComponent } from './components/activity-card/activity-card.component';
import { NewsImpactCardComponent } from './components/news-impact-card/news-impact-card.component';
import { NewsHistoryCardComponent } from './components/news-history-card/news-history-card.component';
import { PredictionOutcomeCardComponent } from './components/prediction-outcome-card/prediction-outcome-card.component';
import { PatternResearchCardComponent } from './components/pattern-research-card/pattern-research-card.component';
import {
  TrendInsightsCardComponent,
  TrendFactorBuckets,
} from './components/trend-insights-card/trend-insights-card.component';
import { AdvisorCardComponent } from './components/advisor-card/advisor-card.component';
import { SignalsGridComponent } from './components/signals-grid/signals-grid.component';
import { PlaybookCardComponent } from './components/playbook-card/playbook-card.component';

type MarketSegment = 'crypto' | 'equities';

interface SegmentConfig {
  id: MarketSegment;
  label: string;
  providerIds: DataProvider[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PriceCardComponent,
    CandleCardComponent,
    SnapshotStripComponent,
    ActivityCardComponent,
    NewsImpactCardComponent,
    NewsHistoryCardComponent,
    PredictionOutcomeCardComponent,
    PatternResearchCardComponent,
    TrendInsightsCardComponent,
    AdvisorCardComponent,
    SignalsGridComponent,
    PlaybookCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="app">
      <header class="hero">
        <h1>{{ currentSegmentLabel() }} · {{ assetPairLabel() }}</h1>
        <p>Angular 17 signals-driven dashboard for EMA, MACD, and RSI confluence.</p>
      </header>
      <nav class="segment-nav">
        <button
          type="button"
          *ngFor="let option of marketSegments"
          (click)="onSegmentChange(option.id)"
          [class.segment-nav__button--active]="option.id === segmentValue"
        >
          {{ option.label }}
        </button>
      </nav>

      <section class="card control-hub">
        <header class="control-hub-header">
          <div>
            <h2>Data Controls</h2>
            <span class="control-hub-subtitle">Choose your market feed and refresh cadence.</span>
          </div>
          <span
            class="trend-chip"
            [class.trend-chip--bull]="store.trend() === 'BULL'"
            [class.trend-chip--bear]="store.trend() === 'BEAR'"
          >
            Trend: {{ store.trend() }}
          </span>
        </header>
        <div class="control-hub-body">
          <div class="control-hub-actions">
            <label class="control-field">
              <span class="control-field-label">Provider</span>
              <select [ngModel]="providerValue" (ngModelChange)="onProviderChange($event)">
                <option *ngFor="let provider of visibleProviders()" [value]="provider.id">
                  {{ provider.label }}
                </option>
              </select>
            </label>
            <label class="control-field">
              <span class="control-field-label">Asset</span>
              <select [ngModel]="assetValue" (ngModelChange)="onAssetChange($event)">
                <option *ngFor="let asset of visibleAssets()" [value]="asset.id">
                  {{ asset.base }}/{{ asset.quote }} · {{ asset.name }}
                </option>
              </select>
            </label>
            <label class="control-field">
              <span class="control-field-label">Interval</span>
              <select [ngModel]="intervalValue" (ngModelChange)="onIntervalChange($event)">
                <option *ngFor="let option of intervals" [value]="option">{{ option }}</option>
              </select>
            </label>
            <div class="control-hub-buttons">
              <button type="button" (click)="reload()" [disabled]="loading()">{{ loading() ? 'Loading…' : 'Reload now' }}</button>
              <button type="button" (click)="toggleAuto()">{{ auto() ? autoStopLabel : autoStartLabel }}</button>
            </div>
          </div>
          <div class="control-hub-meta">
            <div class="control-stat">
              <span class="control-stat-label">Auto mode</span>
              <span class="control-stat-value">{{ auto() ? autoEnabledLabel : 'Manual' }}</span>
            </div>
            <div
              class="control-stat"
              *ngIf="predictionReviewWindow() as review"
              [class.control-stat--alert]="review.status === 'overdue'"
            >
              <span class="control-stat-label">Review window</span>
              <span class="control-stat-value" [ngSwitch]="review.status">
                <ng-container *ngSwitchCase="'pending'">
                  {{ review.dueTime | date: 'HH:mm' }} · {{ formatCountdown(review.dueTime) }}
                </ng-container>
                <ng-container *ngSwitchCase="'overdue'">
                  Overdue · {{ formatCountdown(review.dueTime) }}
                </ng-container>
                <ng-container *ngSwitchDefault>
                  Reviewed {{ review.evaluationTime ? (review.evaluationTime | date: 'HH:mm') : 'n/a' }}
                </ng-container>
              </span>
              <span class="control-stat-note">Horizon {{ review.horizonBars }} bars</span>
            </div>
            <div class="control-stat" *ngIf="store.lastUpdated() as updated">
              <span class="control-stat-label">Last refresh</span>
              <span class="control-stat-value">{{ updated | date: 'HH:mm:ss' }}</span>
            </div>
            <div class="control-stat" *ngIf="store.lastCandle() as last">
              <span class="control-stat-label">Last {{ intervalValue }} close</span>
              <span class="control-stat-value">{{ last.closeTime | date: 'MMM d · HH:mm' }}</span>
            </div>
            <div class="control-stat">
              <span class="control-stat-label">Feed</span>
              <span class="control-stat-value">{{ providerLabel() }} · {{ assetPairLabel() }}</span>
            </div>
          </div>
        </div>
        <div class="control-hub-status status-grid">
          <article class="status-card danger" *ngIf="error() as message">
            <h3>Data Error</h3>
            <p>{{ message }}</p>
          </article>

          <article class="status-card muted" *ngIf="!error() && loading()">
            <h3>Syncing</h3>
            <p>Fetching latest candles…</p>
          </article>

          <article class="status-card" *ngIf="!loading() && !error() && recentFastSignal() as fast">
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

          <article
            class="status-card warning"
            *ngIf="!loading() && !error() && primarySignalStale() && store.latestSignal() as primary"
          >
            <h3>Awaiting Confirmation</h3>
            <p>No new primary signals since {{ primary.time | date: 'yyyy-MM-dd HH:mm' }}</p>
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
      </section>

      <section
        class="card decision-brief"
        *ngIf="
          !loading() &&
          !error() &&
          (store.trendDetails() || store.strategyHealth() || store.validationSummary() || predictionReviewWindow())
        "
      >
        <header class="decision-brief-header">
          <div>
            <h2>Decision Brief</h2>
            <span class="decision-brief-subtitle">Condensed readout before you commit.</span>
          </div>
        </header>
        <div class="insight-strip">
          <article
            class="insight-chip"
            *ngIf="store.trendDetails() as trend"
            [class.insight-chip--bull]="trend.direction === 'BULL'"
            [class.insight-chip--bear]="trend.direction === 'BEAR'"
            [class.insight-chip--neutral]="trend.direction === 'NEUTRAL'"
          >
            <div class="insight-chip-header">
              <span class="insight-chip-label">Trend Bias</span>
              <span class="insight-chip-context">
                {{ trend.confidence !== null && trend.confidence !== undefined ? (trend.confidence | number: '1.0-0') + '%' : 'n/a' }}
              </span>
            </div>
            <p class="insight-chip-value">{{ trend.direction | titlecase }}</p>
            <p class="insight-chip-subtext">{{ trendNarrative() }}</p>
          </article>
          <article class="insight-chip insight-chip--info" *ngIf="store.strategyHealth() as health">
            <div class="insight-chip-header">
              <span class="insight-chip-label">Strategy Health</span>
              <span class="insight-chip-context">PF {{ formatProfitFactor(health.profitFactor) }}</span>
            </div>
            <p class="insight-chip-value">{{ formatChange(health.expectancy) }}</p>
            <p class="insight-chip-subtext">
              Drawdown {{ formatChange(health.maxDrawdown) }} · Avg win {{ formatChange(health.averageGain) }}
            </p>
          </article>
          <article class="insight-chip insight-chip--warn" *ngIf="store.validationSummary() as summary">
            <div class="insight-chip-header">
              <span class="insight-chip-label">Decision Score</span>
              <span class="insight-chip-context">Pending {{ summary.pending }}</span>
            </div>
            <p class="insight-chip-value">
              {{ summary.winRate !== null ? (summary.winRate | number: '1.0-0') + '%' : 'n/a' }}
            </p>
            <p class="insight-chip-subtext">
              Wins {{ summary.wins }} · Losses {{ summary.losses }}
            </p>
          </article>
          <article class="insight-chip insight-chip--neutral" *ngIf="predictionReviewWindow() as review">
            <div class="insight-chip-header">
              <span class="insight-chip-label">Review Window</span>
              <span class="insight-chip-context">Horizon {{ review.horizonBars ?? 'n/a' }}</span>
            </div>
            <p class="insight-chip-value">{{ review.status | titlecase }}</p>
            <p class="insight-chip-subtext">
              {{
                review.dueTime
                  ? (review.dueTime | date: 'HH:mm') + ' · ' + formatCountdown(review.dueTime)
                  : 'Evaluation synced'
              }}
            </p>
          </article>
        </div>
      </section>

      <div class="dashboard-grid">
        <app-price-card
          class="tile tile--wide tile--highlight"
          *ngIf="priceChangeChart() as price"
          [config]="price"
        ></app-price-card>

        <app-activity-card
          class="tile"
          *ngIf="predictionActivities() as activities"
          [activities]="activities"
          [live]="liveRecommendation()"
        ></app-activity-card>

        <app-candle-card
          class="tile"
          *ngIf="candleChart() as candle"
          [config]="candle"
        ></app-candle-card>

        <app-snapshot-strip
          class="tile tile--insights"
          *ngIf="snapshotTiles() as tiles"
          [tiles]="tiles"
        ></app-snapshot-strip>

        <app-signals-grid
          class="tile tile--full tile--panel"
          [signals]="store.signals()"
          [fastSignals]="store.fastSignals()"
          [validations]="store.decisionValidations()"
          [nearMisses]="store.nearMisses()"
          [hasValidations]="hasValidations()"
          [validationHorizon]="validationHorizon()"
        ></app-signals-grid>

        <app-news-impact-card class="tile" [news]="store.newsPrediction()"></app-news-impact-card>

        <app-news-history-card
          class="tile"
          [series]="newsPredictionSeries()"
        ></app-news-history-card>

        <app-prediction-outcome-card
          class="tile"
          [chart]="predictionChart()"
        ></app-prediction-outcome-card>

        <app-pattern-research-card
          class="tile"
          [patterns]="patternInsights()"
          [summary]="patternSummary()"
        ></app-pattern-research-card>

        <app-trend-insights-card
          class="tile"
          [trendDetails]="store.trendDetails()"
          [narrative]="trendNarrative()"
          [buckets]="groupedTrendFactors()"
        ></app-trend-insights-card>

        <app-advisor-card class="tile" [advice]="incomeAdvice()"></app-advisor-card>

        <app-playbook-card class="tile"></app-playbook-card>
      </div>
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
        max-width: 1120px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .segment-nav {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 8px;
      }

      .segment-nav button {
        background: rgba(148, 163, 184, 0.18);
        border: 1px solid rgba(148, 163, 184, 0.24);
        border-radius: 999px;
        color: #e2e8f0;
        padding: 6px 18px;
        font-size: 0.85rem;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
      }

      .segment-nav button:hover {
        background: rgba(148, 163, 184, 0.32);
        border-color: rgba(148, 163, 184, 0.4);
      }

      .segment-nav__button--active {
        background: linear-gradient(135deg, #2563eb, #38bdf8);
        border-color: transparent;
        color: #f8fafc;
        box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35);
        transform: translateY(-1px);
      }
    `,
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly api = inject(MarketDataService);
  private readonly newsService = inject(NewsDataService);
  private readonly predictionHistory = inject(PredictionHistoryService);
  readonly store = inject(SignalsStore);

  readonly intervals: Interval[] = environment.intervals;
  readonly providers: ProviderOption[] = environment.providers;
  readonly assets: AssetOption[] = environment.assets;
  private readonly segmentConfigs: SegmentConfig[] = [
    { id: 'crypto', label: 'Crypto Markets', providerIds: ['binance', 'coinbase'] },
    { id: 'equities', label: 'Equities (Nasdaq)', providerIds: ['nasdaq'] },
  ];
  readonly marketSegments = this.segmentConfigs;
  private readonly defaultProviderLabel = this.providers[0]?.label ?? 'Primary feed';
  readonly formatChange = formatChange;
  readonly formatProfitFactor = formatProfitFactor;
  readonly formatCountdown = formatCountdown;
  private readonly autoRefreshMs = environment.dashboard.autoRefreshMs;
  private readonly priceWindowSize = environment.dashboard.priceWindowSize;
  private readonly candleWindowSize = environment.dashboard.candleWindowSize;
  private readonly newsHistoryDays = environment.dashboard.newsHistoryDays;
  private readonly validationLabelCount = environment.dashboard.validationLabelCount;
  private readonly autoRefreshSeconds = Math.max(1, Math.round(this.autoRefreshMs / 1000));
  readonly autoStartLabel = `Auto refresh (${this.autoRefreshSeconds}s)`;
  readonly autoStopLabel = `Stop auto (${this.autoRefreshSeconds}s)`;
  readonly autoEnabledLabel = `Enabled · ${this.autoRefreshSeconds}s`;
  private readonly defaultAssetId =
    environment.defaultAssetId ?? (this.assets[0]?.id ?? 'btc');
  private readonly intervalSignal = signal<Interval>(environment.defaultInterval);
  private readonly segmentSignal = signal<MarketSegment>(this.resolveInitialSegment());
  private readonly providerSignal = signal<DataProvider>(
    (this.providers[0]?.id ?? 'binance') as DataProvider,
  );
  private readonly assetSignal = signal<string>(this.defaultAssetId);
  private readonly segmentProviderIds = computed(() => {
    const current = this.segmentSignal();
    return this.segmentConfigs.find((item) => item.id === current)?.providerIds ??
      this.segmentConfigs[0]?.providerIds ??
      [];
  });
  readonly visibleProviders = computed(() =>
    this.providers.filter((provider) => this.segmentProviderIds().includes(provider.id)),
  );
  readonly visibleAssets = computed(() =>
    this.assets.filter((asset) =>
      this.segmentProviderIds().some((providerId) => this.assetSupportsProvider(asset, providerId)),
    ),
  );
  readonly currentSegmentLabel = computed(() => {
    const segment = this.segmentSignal();
    return this.segmentConfigs.find((item) => item.id === segment)?.label ?? this.segmentConfigs[0]?.label ?? 'Dashboard';
  });
  readonly auto = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly recentPrimarySignal = computed(() => {
    const latest = this.store.latestSignal();
    if (!latest) {
      return null;
    }
    return this.isSignalFresh(latest.time) ? latest : null;
  });
  readonly recentFastSignal = computed(() => {
    const fast = this.store.latestFastSignal();
    if (!fast) {
      return null;
    }
    return this.isSignalFresh(fast.time) ? fast : null;
  });
  readonly primarySignalStale = computed(() => {
    const latest = this.store.latestSignal();
    if (!latest) {
      return false;
    }
    return !this.isSignalFresh(latest.time);
  });
  readonly providerLabel = computed(() => {
    const option = this.providers.find((item) => item.id === this.providerSignal());
    return option?.label ?? this.defaultProviderLabel;
  });
  readonly activeAsset = computed<AssetOption | null>(() => {
    if (!this.assets.length) {
      return null;
    }
    const assetId = this.assetSignal();
    return this.assets.find((asset) => asset.id === assetId) ?? this.assets[0];
  });
  readonly assetPairLabel = computed(() => {
    const asset = this.activeAsset();
    if (!asset) {
      return 'BTC/USDT';
    }
    return `${asset.base}/${asset.quote}`;
  });
  private readonly newsFilter = computed<NewsFilter>(() => {
    const asset = this.activeAsset();
    if (!asset) {
      return { codes: ['BTC'], keywords: ['bitcoin', 'btc'] };
    }
    const codes = asset.newsCodes.length ? [...asset.newsCodes] : ['BTC'];
    const keywords = asset.newsKeywords.length ? [...asset.newsKeywords] : ['bitcoin', 'btc'];
    return { codes, keywords };
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
  readonly predictionActivities = computed<PredictionActivity[]>(() => {
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
  readonly patternInsights = computed<PatternInsight[]>(() => this.store.patternAnalytics().patterns);
  readonly patternSummary = computed<PatternSummary | null>(() => this.store.patternAnalytics().summary);
  readonly liveRecommendation = computed<LiveRecommendationSummary | null>(() => {
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
  readonly snapshotTiles = computed<DashboardTile[]>(() => {
    const tiles: DashboardTile[] = [];

    const live = this.liveRecommendation();
    if (live) {
      tiles.push({
        id: 'direction',
        label: 'Directional bias',
        value:
          live.direction === 'BULL'
            ? 'Long leaning'
            : live.direction === 'BEAR'
              ? 'Short leaning'
              : 'Neutral stance',
        context: `${live.confidence}% · Score ${live.score}`,
        subtext: live.rationale,
        accent:
          live.direction === 'BULL'
            ? 'bull'
            : live.direction === 'BEAR'
              ? 'bear'
              : 'neutral',
      });
    }

    const news = this.store.newsPrediction();
    if (news) {
      tiles.push({
        id: 'news',
        label: 'News skew',
        value:
          news.bias === 'BULL'
            ? 'Bullish catalysts'
            : news.bias === 'BEAR'
              ? 'Bearish catalysts'
              : 'Balanced flow',
        context: `${this.formatChange(news.expectedMovePct)} · ~${news.horizonHours}h`,
        subtext: `Confidence ${news.confidence}%`,
        accent:
          news.bias === 'BULL'
            ? 'bull'
            : news.bias === 'BEAR'
              ? 'bear'
              : 'info',
      });
    }

    const health = this.store.strategyHealth();
    if (health) {
      tiles.push({
        id: 'health',
        label: 'Strategy health',
        value: this.formatChange(health.expectancy),
        context: `PF ${this.formatProfitFactor(health.profitFactor)}`,
        subtext:
          health.maxDrawdown !== null
            ? `Drawdown ${this.formatChange(health.maxDrawdown)}`
            : null,
        accent: health.expectancy > 0 ? 'bull' : health.expectancy < 0 ? 'bear' : 'neutral',
      });
    }

    const chart = this.predictionChart();
    if (chart && chart.tradeCount) {
      const hitRate = chart.hitRate;
      let accent: DashboardTile['accent'] = 'info';
      if (hitRate !== null) {
        if (hitRate >= 60) {
          accent = 'bull';
        } else if (hitRate <= 40) {
          accent = 'bear';
        } else {
          accent = 'warn';
        }
      }
      tiles.push({
        id: 'validation',
        label: 'Validation track',
        value: hitRate !== null ? `${hitRate}% hit rate` : 'Awaiting data',
        context: `${chart.tradeCount} trades assessed`,
        subtext:
          chart.averageReturn !== null ? `Avg ${this.formatChange(chart.averageReturn)}` : null,
        accent,
      });
    }

    const patternSummary = this.patternSummary();
    if (patternSummary) {
      const avgReturn = patternSummary.meanAverageReturn;
      tiles.push({
        id: 'patterns',
        label: 'Pattern bias',
        value:
          patternSummary.dominantBias === 'BULL'
            ? 'Bullish setups'
            : patternSummary.dominantBias === 'BEAR'
              ? 'Bearish setups'
              : 'Mixed setups',
        context:
          patternSummary.combinedWinRate !== null
            ? `Win ${patternSummary.combinedWinRate}%`
            : 'Win rate n/a',
        subtext: avgReturn !== null ? `Avg ${this.formatChange(avgReturn)}` : null,
        accent:
          patternSummary.dominantBias === 'BULL'
            ? 'bull'
            : patternSummary.dominantBias === 'BEAR'
              ? 'bear'
              : 'neutral',
      });
    }

    return tiles.slice(0, 5);
  });
  readonly groupedTrendFactors = computed<TrendFactorBuckets>(() => {
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
  readonly predictionReviewWindow = computed<PredictionReviewWindow | null>(() => {
    const validations = this.store.decisionValidations();
    if (!validations.length) {
      return null;
    }

    const latest = validations[validations.length - 1];
    if (!Number.isFinite(latest.signalTime)) {
      return null;
    }

    const horizonCandidate = (latest.actualHorizon ?? latest.horizonCandles) ?? latest.horizonCandles;
    const horizonBars = typeof horizonCandidate === 'number' ? horizonCandidate : latest.horizonCandles;
    const intervalMs = this.intervalToMs(this.intervalSignal());
    const dueTime =
      Number.isFinite(horizonBars)
        ? latest.signalTime + horizonBars * intervalMs
        : null;
    const evaluationTime = latest.evaluationTime;
    const now = Date.now();

    let status: PredictionReviewWindow['status'] = 'completed';
    if (latest.outcome === 'PENDING') {
      status = dueTime !== null && now > dueTime ? 'overdue' : 'pending';
    }

    return {
      status,
      dueTime,
      evaluationTime,
      horizonBars,
    };
  });
  readonly priceChangeChart = computed<PriceChangeChartConfig | null>(() => {
    const candles = this.store.candles();
    if (candles.length < 2) {
      return null;
    }

    const windowSize = Math.min(this.priceWindowSize, candles.length);
    const recent = candles.slice(-windowSize);
    const baseline = recent[0].close;
    const latest = recent[recent.length - 1];

    if (!Number.isFinite(baseline) || baseline === 0 || !Number.isFinite(latest.close)) {
      return null;
    }

    const seriesData = recent.map((candle) => ({
      x: candle.closeTime,
      y: Number((((candle.close - baseline) / baseline) * 100).toFixed(2)),
    }));

    const chartSeries: ApexAxisChartSeries = [
      {
        name: 'Change %',
        data: seriesData,
      },
    ];

    const chart: ApexChart = {
      type: 'area',
      height: 240,
      background: 'transparent',
      foreColor: '#cbd5f5',
      toolbar: {
        show: false,
      },
      animations: {
        enabled: true,
        speed: 350,
        animateGradually: {
          enabled: true,
          delay: 30,
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350,
        },
      },
      zoom: {
        enabled: false,
      },
    };

    const xAxis: ApexXAxis = {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
        style: {
          colors: '#94a3b8',
        },
      },
      axisTicks: {
        show: false,
      },
      axisBorder: {
        show: false,
      },
      crosshairs: {
        show: false,
      },
    };

    const yAxis: ApexYAxis = {
      tickAmount: 5,
      labels: {
        formatter: (value: number) => {
          const numeric = Number.isFinite(value) ? value : Number(value);
          if (!Number.isFinite(numeric)) {
            return String(value);
          }
          const prefix = numeric > 0 ? '+' : '';
          return `${prefix}${numeric.toFixed(1)}%`;
        },
        style: {
          colors: '#94a3b8',
        },
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    };

    const stroke: ApexStroke = {
      curve: 'smooth',
      width: 3,
    };

    const fill: ApexFill = {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'vertical',
        shadeIntensity: 0.4,
        gradientToColors: ['#22c55e'],
        inverseColors: false,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 95, 100],
      },
    };

    const markers: ApexMarkers = {
      size: 0,
      hover: {
        size: 6,
        sizeOffset: 3,
      },
    };

    const grid: ApexGrid = {
      borderColor: 'rgba(148,163,184,0.18)',
      strokeDashArray: 4,
    };

    const tooltip: ApexTooltip = {
      theme: 'dark',
      shared: true,
      x: {
        format: 'MMM d · HH:mm',
      },
      y: {
        formatter: (value: number) => {
          if (!Number.isFinite(value)) {
            return 'n/a';
          }
          const prefix = value > 0 ? '+' : '';
          return `${prefix}${value.toFixed(2)}%`;
        },
      },
    };

    const annotations: ApexAnnotations = {
      yaxis: [
        {
          y: 0,
          borderColor: 'rgba(148,163,184,0.35)',
          strokeDashArray: 4,
        },
      ],
    };

    const dataLabels: ApexDataLabels = {
      enabled: false,
    };

    const latestChangePct = Number((((latest.close - baseline) / baseline) * 100).toFixed(2));
    const rangeLabel = `${recent.length} bars · ${this.intervalSignal()}`;
    const lastUpdated = latest.closeTime;

    return {
      chartSeries,
      chartOptions: {
        chart,
        xaxis: xAxis,
        yaxis: yAxis,
        stroke,
        fill,
        markers,
        grid,
        tooltip,
        annotations,
        dataLabels,
      },
      latestPrice: latest.close,
      latestChangePct,
      baselinePrice: baseline,
      rangeLabel,
      lastUpdated,
    };
  });
  readonly candleChart = computed<CandleChartConfig | null>(() => {
    const candles = this.store.candles();
    if (!candles.length) {
      return null;
    }

    const windowSize = Math.min(this.candleWindowSize, candles.length);
    const recent = candles.slice(-windowSize);
    const round = (value: number) => Number.isFinite(value) ? Number(value.toFixed(2)) : value;
    const seriesData = recent.map((candle) => ({
      x: candle.closeTime,
      y: [
        round(candle.open),
        round(candle.high),
        round(candle.low),
        round(candle.close),
      ],
    }));

    const chartSeries: ApexAxisChartSeries = [
      {
        name: 'Price',
        data: seriesData,
      },
    ];

    const chart: ApexChart = {
      type: 'candlestick',
      height: 280,
      background: 'transparent',
      foreColor: '#cbd5f5',
      toolbar: {
        show: false,
      },
      animations: {
        enabled: true,
        speed: 350,
        animateGradually: {
          enabled: true,
          delay: 35,
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350,
        },
      },
      zoom: {
        enabled: false,
      },
    };

    const plotOptions: ApexPlotOptions = {
      candlestick: {
        colors: {
          upward: '#22c55e',
          downward: '#ef4444',
        },
        wick: {
          useFillColor: true,
        },
      },
    };

    const xAxis: ApexXAxis = {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
        style: {
          colors: '#94a3b8',
        },
      },
      axisBorder: {
        color: 'rgba(148,163,184,0.25)',
      },
      axisTicks: {
        color: 'rgba(148,163,184,0.25)',
      },
    };

    const yAxis: ApexYAxis = {
      tooltip: {
        enabled: true,
      },
      labels: {
        formatter: (value: number) => {
          const numeric = Number.isFinite(value) ? value : Number(value);
          if (!Number.isFinite(numeric)) {
            return String(value);
          }
          return numeric >= 1000 ? numeric.toFixed(0) : numeric.toFixed(2);
        },
        style: {
          colors: '#94a3b8',
        },
      },
    };

    const grid: ApexGrid = {
      borderColor: 'rgba(148,163,184,0.18)',
      strokeDashArray: 4,
    };

    const tooltip: ApexTooltip = {
      theme: 'dark',
      shared: false,
      x: {
        format: 'MMM d · HH:mm',
      },
      y: {
        formatter: (value: number) => {
          if (!Number.isFinite(value)) {
            return 'n/a';
          }
          return value >= 1000 ? value.toFixed(0) : value.toFixed(2);
        },
      },
    };

    const stroke: ApexStroke = {
      width: 1,
    };

    const dataLabels: ApexDataLabels = {
      enabled: false,
    };

    const latest = recent[recent.length - 1];
    const body = Number.isFinite(latest.close - latest.open) ? Number((latest.close - latest.open).toFixed(2)) : 0;
    const range =
      Number.isFinite(latest.high - latest.low) ? Number((latest.high - latest.low).toFixed(2)) : 0;
    const changePct =
      latest.open !== 0 && Number.isFinite(latest.open)
        ? Number((((latest.close - latest.open) / latest.open) * 100).toFixed(2))
        : 0;
    const rangeLabel = `${recent.length} bars · ${this.intervalSignal()}`;

    return {
      chartSeries,
      chartOptions: {
        chart,
        xaxis: xAxis,
        yaxis: yAxis,
        grid,
        tooltip,
        plotOptions,
        stroke,
        dataLabels,
      },
      latestCandle: {
        time: latest.closeTime,
        open: latest.open,
        high: latest.high,
        low: latest.low,
        close: latest.close,
        changePct,
        body,
        range,
      },
      rangeLabel,
    };
  });
  readonly predictionChart = computed<PredictionChartView | null>(() => {
    const analytics = this.store.validationAnalytics();
    if (!analytics || !analytics.points.length) {
      return null;
    }

    const rawPoints = analytics.points;
    const wins = rawPoints.filter((point) => point.outcome === 'WIN').length;
    const losses = rawPoints.filter((point) => point.outcome === 'LOSS').length;
    const tradeCount = wins + losses;
    const totalActual = rawPoints.reduce((acc, point) => acc + point.actual, 0);
    const averageReturn = tradeCount ? totalActual / tradeCount : null;
    const hitRate = tradeCount ? Math.round((wins / tradeCount) * 100) : null;

    const maxAbsActual = Math.max(...rawPoints.map((point) => Math.abs(point.actual)), 0.5);
    const xPadding = Math.max(0.5, maxAbsActual * 0.15);
    const tolerance = Math.max(0.2, maxAbsActual * 0.15);

    const magnitudeRanking = rawPoints
      .map((point, index) => ({ index, magnitude: Math.abs(point.actual) }))
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, Math.min(this.validationLabelCount, rawPoints.length))
      .map((entry) => entry.index);
    const labelledSet = new Set(magnitudeRanking);

    const scatterPoints: QuadrantChartPoint[] = rawPoints.map((point, index) => {
      const expected = (point.expected ?? 0) as ExpectedLane;
      const actual = Number(point.actual.toFixed(2));
      const outcome = point.outcome;
      const aligned =
        expected === 1 ? actual > 0 : expected === -1 ? actual < 0 : Math.abs(actual) <= tolerance;
      const fillColor = outcome === 'WIN' ? '#22c55e' : outcome === 'LOSS' ? '#f87171' : '#94a3b8';
      const strokeColor = aligned ? '#38bdf8' : '#0f172a';

      return {
        x: actual,
        y: expected,
        fillColor,
        strokeColor,
        meta: {
          outcome,
          expected,
          actual,
          aligned,
          time: point.time,
          label: labelledSet.has(index) ? this.formatChange(actual) : null,
        },
      };
    });

    const laneDefinitions = [
      { expected: 1 as ExpectedLane, label: 'Long calls' },
      { expected: 0 as ExpectedLane, label: 'Flat guidance' },
      { expected: -1 as ExpectedLane, label: 'Short calls' },
    ];

    const laneSummaries = laneDefinitions.map((lane) => {
      const lanePoints = scatterPoints.filter((point) => point.meta.expected === lane.expected);
      const laneWins = lanePoints.filter((point) => point.meta.outcome === 'WIN').length;
      const laneLosses = lanePoints.filter((point) => point.meta.outcome === 'LOSS').length;
      const lanePending = lanePoints.length - laneWins - laneLosses;
      const laneAlignment = lanePoints.length
        ? Math.round((lanePoints.filter((point) => point.meta.aligned).length / lanePoints.length) * 100)
        : null;
      const laneAverage = lanePoints.length
        ? lanePoints.reduce((acc, point) => acc + point.meta.actual, 0) / lanePoints.length
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

    const yAxis: ApexYAxis = {
      min: -1.4,
      max: 1.4,
      tickAmount: 3,
      labels: {
        formatter: (value: number) => {
          if (value > 0.5) {
            return 'Long calls';
          }
          if (value < -0.5) {
            return 'Short calls';
          }
          return 'Flat guidance';
        },
        style: {
          colors: '#94a3b8',
        },
      },
      axisTicks: {
        show: false,
      },
      axisBorder: {
        show: false,
      },
    };

    const xAxis: ApexXAxis = {
      min: -(maxAbsActual + xPadding),
      max: maxAbsActual + xPadding,
      tickAmount: 5,
      labels: {
        formatter: (value: string) => {
          const numeric = Number.parseFloat(value);
          return Number.isFinite(numeric) ? this.formatChange(numeric) : value;
        },
        style: {
          colors: '#94a3b8',
        },
      },
      axisBorder: {
        color: 'rgba(148,163,184,0.28)',
      },
      axisTicks: {
        color: 'rgba(148,163,184,0.28)',
      },
      title: {
        text: 'Realised move (%)',
        style: {
          color: '#cbd5f5',
        },
      },
      crosshairs: {
        show: false,
      },
    };

    const annotations: ApexAnnotations = {
      xaxis: [
        {
          x: 0,
          borderColor: 'rgba(148,163,184,0.4)',
          strokeDashArray: 4,
        },
      ],
      yaxis: laneDefinitions.map((lane) => ({
        y: lane.expected - 0.45,
        y2: lane.expected + 0.45,
        fillColor:
          lane.expected === 1
            ? 'rgba(34,197,94,0.12)'
            : lane.expected === -1
              ? 'rgba(248,113,113,0.12)'
              : 'rgba(148,163,184,0.12)',
        borderColor: 'transparent',
      })),
    };

    const discreteMarkers = scatterPoints.map((point, index) => ({
      seriesIndex: 0,
      dataPointIndex: index,
      size: point.meta.aligned ? 11 : 9,
      fillColor: point.fillColor,
      strokeColor: point.strokeColor,
      strokeWidth: point.meta.aligned ? 3 : 2,
    }));

    const markers: ApexMarkers = {
      size: 9,
      strokeColors: '#0f172a',
      strokeWidth: 2,
      discrete: discreteMarkers,
      hover: {
        sizeOffset: 3,
      },
    };

    const dataLabels: ApexDataLabels = {
      enabled: true,
      formatter: (_value: string | number, opts) => {
        const point = opts.w.config.series?.[opts.seriesIndex]?.data?.[opts.dataPointIndex] as QuadrantChartPoint | undefined;
        return point?.meta?.label ?? '';
      },
      style: {
        colors: ['#0f172a'],
        fontSize: '11px',
        fontWeight: 600,
      },
      background: {
        enabled: true,
        borderRadius: 12,
        padding: 6,
        foreColor: '#0f172a',
        opacity: 0.92,
      },
      offsetY: -12,
    };

    const tooltip: ApexTooltip = {
      shared: false,
      intersect: true,
      theme: 'dark',
      custom: ({ w, seriesIndex, dataPointIndex }) => {
        const point = w.config.series?.[seriesIndex]?.data?.[dataPointIndex] as QuadrantChartPoint | undefined;
        if (!point) {
          return '';
        }
        const direction = point.meta.expected === 1 ? 'Long' : point.meta.expected === -1 ? 'Short' : 'Flat';
        const outcome = point.meta.outcome;
        const actual = this.formatChange(point.meta.actual);
        const alignment = point.meta.aligned ? 'Aligned' : 'Opposite';
        const time = Number.isFinite(point.meta.time) ? new Date(point.meta.time).toLocaleString() : 'n/a';
        return `
          <div class="quadrant-tooltip">
            <div class="quadrant-tooltip__headline">${direction} call · ${outcome}</div>
            <div class="quadrant-tooltip__stat">Return ${actual}</div>
            <div class="quadrant-tooltip__stat">${alignment} outcome</div>
            <div class="quadrant-tooltip__meta">${time}</div>
          </div>
        `;
      },
    };

    const grid: ApexGrid = {
      borderColor: 'rgba(148,163,184,0.18)',
      strokeDashArray: 3,
      xaxis: {
        lines: {
          show: true,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
    };

    const fill: ApexFill = {
      opacity: 1,
    };

    const stroke: ApexStroke = {
      width: 0,
    };

    const legend: ApexLegend = {
      show: false,
    };

    const quadrantSeries: ApexAxisChartSeries = [
      {
        name: 'Trades',
        type: 'scatter',
        data: scatterPoints,
      },
    ];

    const quadrantChart: ApexChart = {
      type: 'scatter',
      height: 320,
      background: 'transparent',
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
      foreColor: '#cbd5f5',
    };

    return {
      quadrantSeries,
      quadrantOptions: {
        chart: quadrantChart,
        xaxis: xAxis,
        yaxis: yAxis,
        markers,
        dataLabels,
        grid,
        tooltip,
        annotations,
        fill,
        stroke,
        legend,
      },
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

  readonly newsPredictionSeries = computed<NewsPredictionSeries | null>(() => {
    const candles = this.store.candles();
    const resolved = this.predictionHistory.resolveRecords(candles);
    if (!resolved.length) {
      return null;
    }

    const cutoff = Date.now() - this.newsHistoryDays * 24 * 60 * 60 * 1000;
    const records = resolved
      .filter((item) => item.createdAt >= cutoff)
      .sort((a, b) => a.candleTime - b.candleTime);

    if (!records.length) {
      return null;
    }

    const predictedValues = records.map((item) => item.expectedMovePct);
    const actualValues = records
      .filter((item) => item.actualMovePct !== null)
      .map((item) => item.actualMovePct as number);
    const domainValues = [...predictedValues, ...(actualValues.length ? actualValues : [0]), 0];
    let minValue = Math.min(...domainValues);
    let maxValue = Math.max(...domainValues);
    if (Math.abs(maxValue - minValue) < 1e-3) {
      minValue -= 1;
      maxValue += 1;
    }

    const yPadding = Math.max(0.5, (maxValue - minValue) * 0.15);

    const predictedSeries = records.map((record) => ({
      x: record.candleTime,
      y: Number(record.expectedMovePct.toFixed(2)),
    }));

    const actualSeries = records.map((record) => ({
      x: record.candleTime,
      y: record.actualMovePct !== null ? Number((record.actualMovePct as number).toFixed(2)) : null,
    }));

    const chartSeries: ApexAxisChartSeries = [
      {
        name: 'Predicted move',
        type: 'line',
        data: predictedSeries,
      },
      {
        name: 'Realised move',
        type: 'line',
        data: actualSeries,
      },
    ];

    const yAxis: ApexYAxis = {
      min: minValue - yPadding,
      max: maxValue + yPadding,
      tickAmount: 5,
      labels: {
        formatter: (value: number) => this.formatChange(value),
        style: {
          colors: '#94a3b8',
        },
      },
      axisBorder: {
        color: 'rgba(148,163,184,0.18)',
      },
      axisTicks: {
        color: 'rgba(148,163,184,0.18)',
      },
    };

    const xAxis: ApexXAxis = {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
        format: 'MM/dd',
        style: {
          colors: '#94a3b8',
        },
      },
    };

    const stroke: ApexStroke = {
      width: [3, 2],
      curve: 'smooth',
      dashArray: [0, 6],
    };

    const markers: ApexMarkers = {
      size: 4,
      strokeColors: '#0f172a',
      strokeWidth: 2,
      hover: {
        sizeOffset: 2,
      },
    };

    const dataLabels: ApexDataLabels = {
      enabled: false,
    };

    const tooltip: ApexTooltip = {
      shared: true,
      intersect: false,
      theme: 'dark',
      x: {
        format: 'MMM dd, HH:mm',
      },
      y: {
        formatter: (value: number | null) => (value === null ? 'n/a' : this.formatChange(value)),
      },
    };

    const grid: ApexGrid = {
      borderColor: 'rgba(148,163,184,0.16)',
      strokeDashArray: 3,
      yaxis: {
        lines: {
          show: true,
        },
      },
    };

    const annotations: ApexAnnotations = {
      yaxis: [
        {
          y: 0,
          borderColor: 'rgba(148,163,184,0.35)',
          strokeDashArray: 4,
        },
      ],
    };

    const legend: ApexLegend = {
      show: false,
    };

    const colors = ['#38bdf8', '#22c55e'];

    const chart: ApexChart = {
      type: 'line',
      height: 240,
      background: 'transparent',
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
      foreColor: '#cbd5f5',
    };

    const resolvedCount = records.filter((item) => item.actualMovePct !== null).length;
    const hits = records.filter((item) => item.outcome === 'HIT').length;
    const hitRate = resolvedCount ? Math.round((hits / resolvedCount) * 100) : null;
    const averageError =
      resolvedCount > 0
        ? Math.round(
            (records
              .filter((item) => item.actualMovePct !== null)
              .reduce((acc, item) => acc + Math.abs((item.actualMovePct as number) - item.expectedMovePct), 0) /
              resolvedCount) *
              10,
          ) / 10
        : null;
    const pending = records.length - resolvedCount;

    return {
      chartSeries,
      chartOptions: {
        chart,
        xaxis: xAxis,
        yaxis: yAxis,
        stroke,
        markers,
        dataLabels,
        grid,
        tooltip,
        annotations,
        legend,
        colors,
      },
      resolvedCount,
      hitRate,
      averageError,
      pending,
    };
  });

  private readonly captureNewsPrediction = effect(() => {
    const prediction = this.store.newsPrediction();
    const candle = this.store.lastCandle();
    if (prediction && candle) {
      this.predictionHistory.recordNewsPrediction(prediction, candle);
    }
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

  get assetValue(): string {
    return this.assetSignal();
  }

  set assetValue(value: string) {
    this.assetSignal.set(value);
  }

  get segmentValue(): MarketSegment {
    return this.segmentSignal();
  }

  onSegmentChange(segment: MarketSegment): void {
    if (segment === this.segmentSignal()) {
      return;
    }
    this.segmentSignal.set(segment);

    const allowedProviders = this.segmentProviderIds();
    const currentProvider = this.providerSignal();
    if (!allowedProviders.includes(currentProvider)) {
      const fallbackProvider =
        allowedProviders[0] ?? (this.providers[0]?.id as DataProvider | undefined);
      if (fallbackProvider) {
        this.providerValue = fallbackProvider;
      }
    }

    const currentAsset = this.activeAsset();
    const assets = this.visibleAssets();
    if (!currentAsset || !this.assetSupportsProvider(currentAsset, this.providerSignal())) {
      const fallbackAsset = assets.find((asset) =>
        this.assetSupportsProvider(asset, this.providerSignal()),
      );
      if (fallbackAsset) {
        this.assetValue = fallbackAsset.id;
      } else if (assets[0]) {
        this.assetValue = assets[0].id;
        const providerFallback = this.findFirstProviderForAsset(assets[0]);
        if (providerFallback) {
          this.providerValue = providerFallback;
        }
      }
    }

    this.store.setNewsEvents([]);
    this.reload();
    this.fetchNewsForAsset();
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
    const previousAssetId = this.assetSignal();
    this.providerValue = value;

    let assetAdjusted = false;
    if (!this.assetSupportsProvider(this.activeAsset(), value)) {
      const fallback = this.findFirstAssetForProvider(value);
      if (fallback) {
        this.assetValue = fallback.id;
        assetAdjusted = fallback.id !== previousAssetId;
      }
    }

    this.reload();

    if (assetAdjusted) {
      this.store.setNewsEvents([]);
      this.fetchNewsForAsset();
    }
  }

  onAssetChange(value: string): void {
    if (value === this.assetSignal()) {
      return;
    }
    const asset = this.assets.find((item) => item.id === value);
    if (!asset) {
      return;
    }
    const previousProvider = this.providerSignal();
    this.assetValue = asset.id;
    if (!this.assetSupportsProvider(asset, previousProvider)) {
      const fallbackProvider = this.findFirstProviderForAsset(asset);
      if (fallbackProvider && fallbackProvider !== previousProvider) {
        this.providerValue = fallbackProvider;
      }
    }
    this.store.setNewsEvents([]);
    this.reload();
    this.fetchNewsForAsset();
  }

  private pollHandle?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.reload();
    this.fetchNewsForAsset();
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
        console.error('Failed to load market data', err);
        this.error.set('Failed to fetch market data. Please retry in a moment.');
        this.loading.set(false);
      },
    });
  }

  private fetchNewsForAsset(): void {
    const filter = this.newsFilter();
    this.newsService
      .getLatestNews(filter)
      .pipe(take(1))
      .subscribe((events) => this.store.setNewsEvents(events));
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
    this.pollHandle = setInterval(() => this.reload(), this.autoRefreshMs);
  }

  private stopAuto(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = undefined;
    }
    this.auto.set(false);
  }

  private resolveInitialSegment(): MarketSegment {
    const primaryProvider = this.providers[0]?.id;
    if (primaryProvider) {
      const matching = this.segmentConfigs.find((segment) =>
        segment.providerIds.includes(primaryProvider),
      );
      if (matching) {
        return matching.id;
      }
    }
    return this.segmentConfigs[0]?.id ?? 'crypto';
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

  private signalFreshThresholdMs(interval: Interval): number {
    const base = this.intervalToMs(interval);
    return Math.max(base, 60_000) * 3;
  }

  private isSignalFresh(signalTime: number | null | undefined): boolean {
    if (!Number.isFinite(signalTime)) {
      return false;
    }
    const reference = this.store.lastCandle()?.closeTime ?? Date.now();
    const threshold = this.signalFreshThresholdMs(this.intervalSignal());
    return reference - (signalTime as number) <= threshold;
  }

  private activeSymbol(): string {
    const provider = this.providerSignal();
    const asset = this.activeAsset();
    if (asset) {
      const assetSymbol = asset.providerSymbols[provider];
      if (assetSymbol) {
        return assetSymbol;
      }
      const fallbackProvider = this.findFirstProviderForAsset(asset);
      if (fallbackProvider) {
        const fallbackSymbol = asset.providerSymbols[fallbackProvider];
        if (fallbackSymbol) {
          return fallbackSymbol;
        }
      }
    }

    const providerOption = this.providers.find((item) => item.id === provider);
    if (providerOption?.symbol) {
      return providerOption.symbol;
    }

    return this.providers[0]?.symbol ?? 'BTCUSDT';
  }

  private assetSupportsProvider(asset: AssetOption | null, provider: DataProvider): boolean {
    if (!asset) {
      return false;
    }
    const symbol = asset.providerSymbols[provider];
    return Boolean(symbol);
  }

  private findFirstProviderForAsset(asset: AssetOption | null): DataProvider | null {
    if (!asset) {
      return null;
    }
    const preferredProviders = this.visibleProviders();
    for (const option of preferredProviders) {
      const candidate = asset.providerSymbols[option.id];
      if (candidate) {
        return option.id;
      }
    }
    for (const option of this.providers) {
      const candidate = asset.providerSymbols[option.id];
      if (candidate) {
        return option.id;
      }
    }
    const providerKeys = Object.keys(asset.providerSymbols) as DataProvider[];
    for (const key of providerKeys) {
      const candidate = asset.providerSymbols[key];
      if (candidate) {
        return key;
      }
    }
    return null;
  }

  private findFirstAssetForProvider(provider: DataProvider): AssetOption | null {
    const preferredAssets = this.visibleAssets();
    const firstVisible = preferredAssets.find((asset) => this.assetSupportsProvider(asset, provider));
    if (firstVisible) {
      return firstVisible;
    }
    return this.assets.find((asset) => this.assetSupportsProvider(asset, provider)) ?? null;
  }

}
