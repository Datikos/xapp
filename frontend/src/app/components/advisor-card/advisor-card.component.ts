import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import type { IncomeAdvice } from '../../lib/advisor';

@Component({
  selector: 'app-advisor-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card advisor" *ngIf="advice">
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
  `,
})
export class AdvisorCardComponent {
  @Input() advice: IncomeAdvice | null = null;
}
