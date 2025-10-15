import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import type { LiveRecommendationSummary, PredictionActivity } from '../../models/dashboard.model';

@Component({
  selector: 'app-activity-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card activity-card" *ngIf="activities.length || live">
      <header class="card-heading">
        <h2>Live Directional Guidance</h2>
        <span class="card-subtitle">Current bias with recent long / short triggers.</span>
      </header>
      <div class="card-body">
        <div class="activity-live" *ngIf="live as current">
          <div class="activity-live-header">
            <span class="activity-bias" [class.long]="current.direction === 'BULL'" [class.short]="current.direction === 'BEAR'">
              {{ current.direction === 'BULL' ? 'Long bias' : current.direction === 'BEAR' ? 'Short bias' : 'Neutral stance' }}
            </span>
            <span class="activity-confidence">{{ current.confidence }}% confidence · Score {{ current.score }}</span>
          </div>
          <p class="activity-live-headline" [class.positive]="current.tone === 'positive'" [class.caution]="current.tone === 'caution'">
            {{ current.headline }}
          </p>
          <p class="activity-live-meta">
            <ng-container *ngIf="current.time; else activityNow">
              Updated {{ current.time | date: 'HH:mm' }} · {{ current.time | date: 'MMM d' }}
            </ng-container>
            <ng-template #activityNow>Updated moments ago</ng-template>
            <span *ngIf="current.rationale"> · {{ current.rationale }}</span>
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
  `,
})
export class ActivityCardComponent {
  @Input({ required: true }) activities: PredictionActivity[] = [];
  @Input() live: LiveRecommendationSummary | null = null;
}
