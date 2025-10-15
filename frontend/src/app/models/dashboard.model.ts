import type {
  ApexAnnotations,
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexMarkers,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';
import type { SignalType } from '../lib/strategy';
import type { AdvisorTone } from '../lib/advisor';

export type ExpectedLane = 1 | 0 | -1;

export interface QuadrantChartPoint {
  x: number;
  y: ExpectedLane;
  fillColor: string;
  strokeColor: string;
  meta: {
    outcome: 'WIN' | 'LOSS' | 'PENDING';
    expected: ExpectedLane;
    actual: number;
    aligned: boolean;
    time: number;
    label: string | null;
  };
}

export interface DashboardTile {
  id: string;
  label: string;
  value: string;
  context?: string | null;
  subtext?: string | null;
  accent: 'bull' | 'bear' | 'info' | 'warn' | 'neutral';
}

export interface PredictionReviewWindow {
  status: 'pending' | 'overdue' | 'completed';
  dueTime: number | null;
  evaluationTime: number | null;
  horizonBars: number;
}

export interface PriceChangeChartConfig {
  chartSeries: ApexAxisChartSeries;
  chartOptions: {
    chart: ApexChart;
    xaxis: ApexXAxis;
    yaxis: ApexYAxis;
    stroke: ApexStroke;
    fill: ApexFill;
    markers: ApexMarkers;
    grid: ApexGrid;
    tooltip: ApexTooltip;
    annotations: ApexAnnotations;
    dataLabels: ApexDataLabels;
  };
  latestPrice: number;
  latestChangePct: number;
  baselinePrice: number;
  rangeLabel: string;
  lastUpdated: number;
}

export interface CandleChartConfig {
  chartSeries: ApexAxisChartSeries;
  chartOptions: {
    chart: ApexChart;
    xaxis: ApexXAxis;
    yaxis: ApexYAxis;
    grid: ApexGrid;
    tooltip: ApexTooltip;
    plotOptions: ApexPlotOptions;
    stroke: ApexStroke;
    dataLabels: ApexDataLabels;
  };
  latestCandle: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    changePct: number;
    body: number;
    range: number;
  };
  rangeLabel: string;
}

export interface PredictionActivity {
  id: string;
  band: 'primary' | 'fast';
  type: SignalType;
  time: number;
  price: number;
  reason: string;
}

export interface LiveRecommendationSummary {
  direction: 'BULL' | 'BEAR' | 'NEUTRAL';
  confidence: number;
  score: number;
  headline: string;
  tone: AdvisorTone;
  rationale: string | null;
  time: number | null;
}

export interface NewsPredictionSeries {
  chartSeries: ApexAxisChartSeries;
  chartOptions: {
    chart: ApexChart;
    xaxis: ApexXAxis;
    yaxis: ApexYAxis;
    stroke: ApexStroke;
    markers: ApexMarkers;
    dataLabels: ApexDataLabels;
    grid: ApexGrid;
    tooltip: ApexTooltip;
    annotations: ApexAnnotations;
    legend: ApexLegend;
    colors: string[];
  };
  resolvedCount: number;
  pending: number;
  hitRate: number | null;
  averageError: number | null;
}

export interface PredictionLaneSummary {
  label: string;
  total: number;
  alignmentRate: number | null;
  averageReturn: number | null;
  wins: number;
  losses: number;
  pending: number;
}

export interface PredictionChartView {
  quadrantSeries: ApexAxisChartSeries;
  quadrantOptions: {
    chart: ApexChart;
    xaxis: ApexXAxis;
    yaxis: ApexYAxis;
    markers: ApexMarkers;
    dataLabels: ApexDataLabels;
    grid: ApexGrid;
    tooltip: ApexTooltip;
    annotations: ApexAnnotations;
    fill: ApexFill;
    stroke: ApexStroke;
    legend: ApexLegend;
  };
  wins: number;
  losses: number;
  tradeCount: number;
  hitRate: number | null;
  averageReturn: number | null;
  totalReturn: number;
  correlation: number | null;
  laneSummaries: PredictionLaneSummary[];
}
