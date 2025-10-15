import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';

import type { NewsPredictionSeries } from '../../models/dashboard.model';

@Component({
  selector: 'app-news-history-card',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card chart-card news-history-card" *ngIf="series">
      <header class="card-heading card-heading--split">
        <div>
          <h2>30-Day News Prediction Scorecard</h2>
          <span class="card-subtitle">Expected move vs realised change from news model.</span>
        </div>
        <div class="chart-legend">
          <span class="chart-legend-item">
            <span class="legend-swatch legend-swatch--line news-predicted"></span>
            Predicted move
          </span>
          <span class="chart-legend-item">
            <span class="legend-swatch legend-swatch--line news-actual"></span>
            Realised move
          </span>
        </div>
      </header>
      <div class="card-body news-history-body">
        <div class="news-history-chart">
          <apx-chart
            [series]="series.chartSeries"
            [chart]="series.chartOptions.chart"
            [xaxis]="series.chartOptions.xaxis"
            [yaxis]="series.chartOptions.yaxis"
            [stroke]="series.chartOptions.stroke"
            [markers]="series.chartOptions.markers"
            [dataLabels]="series.chartOptions.dataLabels"
            [grid]="series.chartOptions.grid"
            [tooltip]="series.chartOptions.tooltip"
            [annotations]="series.chartOptions.annotations"
            [legend]="series.chartOptions.legend"
            [colors]="series.chartOptions.colors"
          ></apx-chart>
        </div>
        <div class="news-history-metrics">
          <div>
            <span class="news-metric-label">Resolved</span>
            <span class="news-metric-value">{{ series.resolvedCount }}</span>
          </div>
          <div>
            <span class="news-metric-label">Pending</span>
            <span class="news-metric-value">{{ series.pending }}</span>
          </div>
          <div>
            <span class="news-metric-label">Hit Rate</span>
            <span class="news-metric-value">{{ series.hitRate !== null ? series.hitRate + '%' : 'n/a' }}</span>
          </div>
          <div>
            <span class="news-metric-label">Avg Error</span>
            <span class="news-metric-value">{{ series.averageError !== null ? series.averageError + '%' : 'n/a' }}</span>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class NewsHistoryCardComponent {
  @Input() series: NewsPredictionSeries | null = null;
}
