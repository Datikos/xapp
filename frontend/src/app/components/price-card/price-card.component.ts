import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';

import type { PriceChangeChartConfig } from '../../models/dashboard.model';
import { formatChange } from '../../lib/formatting';

@Component({
  selector: 'app-price-card',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card chart-card price-card">
      <header class="card-heading card-heading--split">
        <div>
          <h2>Real-Time Price Drift</h2>
          <span class="card-subtitle">Close-to-close change across the latest {{ config.rangeLabel }}.</span>
        </div>
        <div
          class="price-chip"
          [class.price-chip--up]="config.latestChangePct >= 0"
          [class.price-chip--down]="config.latestChangePct < 0"
        >
          <span class="price-chip-label">Last price</span>
          <span class="price-chip-value">{{ config.latestPrice | number: '1.2-2' }}</span>
          <span class="price-chip-change">{{ formatChangeFn(config.latestChangePct) }}</span>
        </div>
      </header>
      <div class="card-body price-card-body">
        <div class="price-chart">
          <apx-chart
            [series]="config.chartSeries"
            [chart]="config.chartOptions.chart"
            [xaxis]="config.chartOptions.xaxis"
            [yaxis]="config.chartOptions.yaxis"
            [stroke]="config.chartOptions.stroke"
            [fill]="config.chartOptions.fill"
            [markers]="config.chartOptions.markers"
            [grid]="config.chartOptions.grid"
            [tooltip]="config.chartOptions.tooltip"
            [annotations]="config.chartOptions.annotations"
            [dataLabels]="config.chartOptions.dataLabels"
          ></apx-chart>
        </div>
        <div class="price-metrics">
          <div class="price-metric">
            <span class="price-metric-label">Window</span>
            <span class="price-metric-value">{{ config.rangeLabel }}</span>
            <span class="price-metric-note">Bars plotted</span>
          </div>
          <div class="price-metric">
            <span class="price-metric-label">Range anchor</span>
            <span class="price-metric-value">{{ config.baselinePrice | number: '1.2-2' }}</span>
            <span class="price-metric-note">First close in view</span>
          </div>
          <div class="price-metric">
            <span class="price-metric-label">Net change</span>
            <span
              class="price-metric-value"
              [class.positive]="config.latestChangePct >= 0"
              [class.negative]="config.latestChangePct < 0"
            >
              {{ formatChangeFn(config.latestChangePct) }}
            </span>
            <span class="price-metric-note">vs start of window</span>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class PriceCardComponent {
  @Input({ required: true }) config!: PriceChangeChartConfig;

  protected readonly formatChangeFn = formatChange;
}
