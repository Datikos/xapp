import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import type { NewsPrediction } from '../../lib/news';

@Component({
  selector: 'app-news-impact-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card news-card" *ngIf="news">
      <header class="card-heading card-heading--split">
        <div>
          <h2>News Impact Lens</h2>
          <span class="card-subtitle">Weighted sentiment forecast from recent catalysts.</span>
        </div>
        <div class="news-summary-badge" [class.long]="news.bias === 'BULL'" [class.short]="news.bias === 'BEAR'">
          {{ news.bias === 'BULL' ? 'Bullish skew' : news.bias === 'BEAR' ? 'Bearish skew' : 'Neutral mix' }}
        </div>
      </header>
      <div class="card-body news-body">
        <div class="news-summary">
          <div class="news-metric">
            <span class="news-metric-label">Expected Move</span>
            <span class="news-metric-value">{{ news.expectedMovePct | number: '1.1-1' }}%</span>
          </div>
          <div class="news-metric">
            <span class="news-metric-label">Confidence</span>
            <span class="news-metric-value">{{ news.confidence }}%</span>
          </div>
          <div class="news-metric">
            <span class="news-metric-label">Horizon</span>
            <span class="news-metric-value">~{{ news.horizonHours }}h</span>
          </div>
        </div>
        <p class="news-narrative">{{ news.narrative }}</p>
        <div class="news-drivers" *ngIf="news.drivers.length; else newsDriversEmpty">
          <article class="news-driver" *ngFor="let driver of news.drivers">
            <header>
              <span class="news-driver-headline">{{ driver.headline }}</span>
              <span class="news-driver-meta">{{ driver.source }} · {{ driver.time | date: 'HH:mm' }}</span>
            </header>
            <p class="news-driver-detail">
              Sentiment {{ driver.sentiment }} · Score {{ driver.score | number: '1.1-2' }} · Weight
              {{ driver.weight | number: '1.1-2' }}
            </p>
          </article>
        </div>
        <ng-template #newsDriversEmpty>
          <p class="news-empty">News items captured but none met confidence thresholds.</p>
        </ng-template>
      </div>
    </section>
  `,
})
export class NewsImpactCardComponent {
  @Input() news: NewsPrediction | null = null;
}
