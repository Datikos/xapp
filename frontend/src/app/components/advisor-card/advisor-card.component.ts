import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import type { IncomeAdvice } from '../../lib/advisor';

@Component({
  selector: 'app-advisor-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (advice) {
      <section class="card advisor">
        <header class="card-heading">
          <h2>Income Action Advisor</h2>
          <span class="card-subtitle">Suggested moves to compound trading income.</span>
        </header>
        <div class="card-body">
          <div class="advisor-pills">
            @if (advice.tone === 'positive') {
              <span class="advisor-pill positive">Upside Bias</span>
            }
            @if (advice.tone === 'caution') {
              <span class="advisor-pill caution">Capital Protection</span>
            }
            @if (advice.tone === 'neutral') {
              <span class="advisor-pill neutral">Hold Fire</span>
            }
            <span class="advisor-pill">Confidence {{ advice.confidenceScore }}%</span>
            <span class="advisor-pill muted">Risk {{ advice.riskScore }}%</span>
          </div>
          <p class="advisor-headline" [class.positive]="advice.tone === 'positive'" [class.caution]="advice.tone === 'caution'">
            {{ advice.headline }}
          </p>
          <p class="advisor-rationale">{{ advice.rationale }}</p>
          <div class="advisor-metrics">
            @if (advice.metrics.volatilityPct !== null) {
              <div class="metric-card">
                <span class="metric-label">Realised Volatility</span>
                <span class="metric-value">{{ advice.metrics.volatilityPct | number: '1.1-1' }}%</span>
                <span class="metric-note">ATR₁₄ / Price</span>
              </div>
            }
            @if (advice.metrics.signalFreshnessMinutes !== null) {
              <div class="metric-card">
                <span class="metric-label">Last Signal Age</span>
                <span class="metric-value">{{ advice.metrics.signalFreshnessMinutes }}m</span>
                <span class="metric-note">Time since confluence trigger</span>
              </div>
            }
            @if (advice.metrics.momentumScore !== null) {
              <div class="metric-card">
                <span class="metric-label">Momentum Score</span>
                <span class="metric-value">{{ advice.metrics.momentumScore | number: '1.0-0' }}</span>
                <span class="metric-note">Blend of MACD • RSI • Price vs EMA</span>
              </div>
            }
          </div>
          <ul class="advisor-list">
            @for (item of advice.suggestions; track item) {
              <li>{{ item }}</li>
            }
          </ul>
        </div>
      </section>
    }
    `,
})
export class AdvisorCardComponent {
  @Input() advice: IncomeAdvice | null = null;
}
