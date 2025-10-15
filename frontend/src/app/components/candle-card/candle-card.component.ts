import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';

import type { CandleChartConfig } from '../../models/dashboard.model';
import { formatChange } from '../../lib/formatting';

@Component({
  selector: 'app-candle-card',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card chart-card candle-card">
      <header class="card-heading card-heading--split">
        <div>
          <h2>Candlestick View</h2>
          <span class="card-subtitle">OHLC structure for the last {{ config.rangeLabel }}.</span>
        </div>
        <div
          class="candle-chip"
          [class.candle-chip--up]="config.latestCandle.changePct >= 0"
          [class.candle-chip--down]="config.latestCandle.changePct < 0"
        >
          <span class="candle-chip-label">
            {{ config.latestCandle.changePct >= 0 ? 'Up candle' : 'Down candle' }}
          </span>
          <span class="candle-chip-value">{{ formatChangeFn(config.latestCandle.changePct) }}</span>
          <span class="candle-chip-note">Close {{ config.latestCandle.close | number: '1.2-2' }}</span>
        </div>
      </header>
      <div class="card-body candle-card-body">
        <div class="candle-chart">
          <apx-chart
            [series]="config.chartSeries"
            [chart]="config.chartOptions.chart"
            [xaxis]="config.chartOptions.xaxis"
            [yaxis]="config.chartOptions.yaxis"
            [grid]="config.chartOptions.grid"
            [tooltip]="config.chartOptions.tooltip"
            [plotOptions]="config.chartOptions.plotOptions"
            [stroke]="config.chartOptions.stroke"
            [dataLabels]="config.chartOptions.dataLabels"
          ></apx-chart>
        </div>
        <div class="candle-metrics">
          <div class="candle-metric">
            <span class="candle-metric-label">Open</span>
            <span class="candle-metric-value">{{ config.latestCandle.open | number: '1.2-2' }}</span>
          </div>
          <div class="candle-metric">
            <span class="candle-metric-label">High</span>
            <span class="candle-metric-value">{{ config.latestCandle.high | number: '1.2-2' }}</span>
          </div>
          <div class="candle-metric">
            <span class="candle-metric-label">Low</span>
            <span class="candle-metric-value">{{ config.latestCandle.low | number: '1.2-2' }}</span>
          </div>
          <div class="candle-metric">
            <span class="candle-metric-label">Range</span>
            <span class="candle-metric-value">{{ config.latestCandle.range | number: '1.2-2' }}</span>
            <span class="candle-metric-note">Body {{ config.latestCandle.body | number: '1.2-2' }}</span>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class CandleCardComponent {
  @Input({ required: true }) config!: CandleChartConfig;

  protected readonly formatChangeFn = formatChange;
}
