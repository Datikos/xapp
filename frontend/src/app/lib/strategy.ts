import { Candle } from '../models/candle.model';
import { ema, rsi, macd } from './indicators';

export type SignalType = 'LONG' | 'SHORT' | 'FLAT';

export interface Signal {
  time: number;
  price: number;
  type: SignalType;
  reason: string;
}

export interface StrategyResult {
  signals: Signal[];
  trend: 'BULL' | 'BEAR' | 'NEUTRAL';
}

export function generateSignals(candles: Candle[]): StrategyResult {
  if (!candles.length) {
    return { signals: [], trend: 'NEUTRAL' };
  }

  const closes = candles.map((candle) => candle.close);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const rsi14 = rsi(closes, 14);
  const { macdLine, signalLine } = macd(closes);

  const signals: Signal[] = [];

  for (let index = 200; index < candles.length; index++) {
    const price = closes[index];
    const ema50Value = ema50[index] ?? 0;
    const ema200Value = ema200[index] ?? 0;

    const bullishTrend = ema50Value > ema200Value;
    const bearishTrend = ema50Value < ema200Value;
    const macdBullishCross =
      (macdLine[index - 1] ?? 0) <= (signalLine[index - 1] ?? 0) && (macdLine[index] ?? 0) > (signalLine[index] ?? 0);
    const macdBearishCross =
      (macdLine[index - 1] ?? 0) >= (signalLine[index - 1] ?? 0) && (macdLine[index] ?? 0) < (signalLine[index] ?? 0);

    const rsiValue = rsi14[index] ?? 50;
    const rsiSupportsLong = rsiValue < 60;
    const rsiSupportsShort = rsiValue > 40;

    if (bullishTrend && macdBullishCross && rsiSupportsLong && price > ema50Value) {
      signals.push({
        time: candles[index].closeTime,
        price,
        type: 'LONG',
        reason: 'EMA50 > EMA200 • MACD cross up • RSI < 60 • price > EMA50',
      });
    } else if (bearishTrend && macdBearishCross && rsiSupportsShort && price < ema50Value) {
      signals.push({
        time: candles[index].closeTime,
        price,
        type: 'SHORT',
        reason: 'EMA50 < EMA200 • MACD cross down • RSI > 40 • price < EMA50',
      });
    }
  }

  const lastIndex = candles.length - 1;
  const trend = ema50[lastIndex] > ema200[lastIndex] ? 'BULL' : ema50[lastIndex] < ema200[lastIndex] ? 'BEAR' : 'NEUTRAL';

  return { signals, trend };
}
