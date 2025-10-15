import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { formatChange } from '../../lib/formatting';
import type { PatternInsight, PatternSummary } from '../../store/signals.store';

@Component({
  selector: 'app-pattern-research-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card pattern-card" *ngIf="patterns?.length || summary">
      <header class="card-heading card-heading--split">
        <div>
          <h2>Pattern Research</h2>
          <span class="card-subtitle">Average outcomes for recurring signal setups.</span>
        </div>
        <div class="pattern-summary" *ngIf="summary as snapshot">
          <span class="pattern-summary-bias" [class.long]="snapshot.dominantBias === 'BULL'" [class.short]="snapshot.dominantBias === 'BEAR'">
            {{ snapshot.dominantBias === 'BULL' ? 'Bullish skew' : 'Bearish skew' }}
          </span>
          <span class="pattern-summary-stat">Avg {{ formatChangeFn(snapshot.meanAverageReturn) }}</span>
          <span class="pattern-summary-stat">Win rate {{ snapshot.combinedWinRate }}%</span>
        </div>
      </header>
      <div class="card-body pattern-body">
        <ng-container *ngIf="patterns?.length; else patternEmpty">
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
                  <span class="pattern-metric-value">{{ formatChangeFn(pattern.averageReturn) }}</span>
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
                  <span class="pattern-metric-value">{{ pattern.riskReward !== null ? pattern.riskReward : 'n/a' }}</span>
                </div>
              </div>
              <div class="pattern-range">
                <span class="pattern-range-label">Range</span>
                <span class="pattern-range-value">
                  {{ pattern.bestReturn !== null ? formatChangeFn(pattern.bestReturn) : 'n/a' }} /
                  {{ pattern.worstReturn !== null ? formatChangeFn(pattern.worstReturn) : 'n/a' }}
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
  `,
})
export class PatternResearchCardComponent {
  @Input() patterns: PatternInsight[] | null = null;
  @Input() summary: PatternSummary | null = null;

  protected readonly formatChangeFn = formatChange;
}
