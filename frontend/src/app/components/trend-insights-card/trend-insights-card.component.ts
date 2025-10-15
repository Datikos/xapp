import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import type { TrendDetails, TrendFactor } from '../../lib/strategy';
import { factorIntensity } from '../../lib/formatting';

export interface TrendFactorBuckets {
  tailwinds: TrendFactor[];
  headwinds: TrendFactor[];
  neutral: TrendFactor[];
}

@Component({
  selector: 'app-trend-insights-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card insights" *ngIf="trendDetails">
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
          <p class="trend-narrative">{{ narrative }}</p>
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

        <div class="trend-factor-groups" *ngIf="buckets">
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
                  <div class="factor-strength-fill" [style.width.%]="factorIntensityFn(factor)"></div>
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
                  <div class="factor-strength-fill" [style.width.%]="factorIntensityFn(factor)"></div>
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
  `,
})
export class TrendInsightsCardComponent {
  @Input() trendDetails: TrendDetails | null = null;
  @Input() narrative = '';
  @Input() buckets: TrendFactorBuckets | null = null;

  protected readonly factorIntensityFn = factorIntensity;
}
