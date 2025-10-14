export interface Candle {
  openTime: number; // milliseconds since epoch
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number; // milliseconds since epoch
}

export type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
