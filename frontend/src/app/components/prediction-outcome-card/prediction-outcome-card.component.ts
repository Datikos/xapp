import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';

import type { PredictionChartView } from '../../models/dashboard.model';
import { correlationDescriptor, formatChange, predictionNarrative } from '../../lib/formatting';

@Component({
  selector: 'app-prediction-outcome-card',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card chart-card" *ngIf="chart">
      <header class="card-heading card-heading--split">
        <div>
          <h2>Prediction vs Reality</h2>
          <span class="card-subtitle">How realised returns lined up against directional calls.</span>
        </div>
        <div class="chart-legend">
          <span class="chart-legend-item">
            <span class="legend-swatch legend-swatch--win"></span>
            Winning trade
          </span>
          <span class="chart-legend-item">
            <span class="legend-swatch legend-swatch--loss"></span>
            Losing trade
          </span>
          <span class="chart-legend-item">
            <span class="legend-swatch legend-swatch--pending"></span>
            Neutral outcome
          </span>
        </div>
      </header>
      <div class="card-body chart-body">
        <div class="chart-overview">
          <div class="chart-stats">
            <div class="chart-stat">
              <span class="chart-stat-label">Hit rate</span>
              <span class="chart-stat-value">{{ chart.hitRate !== null ? chart.hitRate + '%' : 'n/a' }}</span>
              <span class="chart-stat-note">{{ chart.wins }} wins · {{ chart.losses }} losses</span>
            </div>
            <div class="chart-stat">
              <span class="chart-stat-label">Cumulative return</span>
              <span class="chart-stat-value">{{ formatChangeFn(chart.totalReturn) }}</span>
              <span class="chart-stat-note">Avg trade {{ formatChangeFn(chart.averageReturn) }}</span>
            </div>
            <div class="chart-stat">
              <span class="chart-stat-label">Signal alignment</span>
              <span class="chart-stat-value">
                {{ chart.correlation !== null ? (chart.correlation | number: '1.2-2') : 'n/a' }}
              </span>
              <span class="chart-stat-note">{{ correlationDescriptorFn(chart.correlation) }}</span>
            </div>
          </div>
          <p class="chart-remark">
            {{ predictionNarrativeFn(chart.totalReturn, chart.hitRate, chart.correlation, chart.wins + chart.losses) }}
          </p>
        </div>
        <div class="prediction-chart outcome-quadrant">
          <div class="quadrant-chart">
            <apx-chart
              [series]="chart.quadrantSeries"
              [chart]="chart.quadrantOptions.chart"
              [xaxis]="chart.quadrantOptions.xaxis"
              [yaxis]="chart.quadrantOptions.yaxis"
              [markers]="chart.quadrantOptions.markers"
              [dataLabels]="chart.quadrantOptions.dataLabels"
              [grid]="chart.quadrantOptions.grid"
              [tooltip]="chart.quadrantOptions.tooltip"
              [annotations]="chart.quadrantOptions.annotations"
              [fill]="chart.quadrantOptions.fill"
              [stroke]="chart.quadrantOptions.stroke"
              [legend]="chart.quadrantOptions.legend"
            ></apx-chart>
          </div>
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
                <span class="lane-card-value">
                  {{ lane.averageReturn !== null ? formatChangeFn(lane.averageReturn) : 'n/a' }}
                </span>
              </p>
              <p class="lane-card-meta">
                Wins {{ lane.wins }} · Losses {{ lane.losses }} · Pending {{ lane.pending }}
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class PredictionOutcomeCardComponent {
  @Input() chart: PredictionChartView | null = null;

  protected readonly formatChangeFn = formatChange;
  protected readonly correlationDescriptorFn = correlationDescriptor;
  protected readonly predictionNarrativeFn = predictionNarrative;
}
