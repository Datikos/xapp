export function ema(values: number[], period: number): number[] {
  if (values.length === 0) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  const result: number[] = [];

  const seed = values.slice(0, period).reduce((acc, value) => acc + value, 0) / period;
  result[period - 1] = seed;

  let previous = seed;
  for (let i = period; i < values.length; i++) {
    previous = values[i] * multiplier + previous * (1 - multiplier);
    result[i] = previous;
  }

  return result;
}

export function rsi(values: number[], period = 14): number[] {
  if (values.length <= period) {
    return [];
  }

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gains[i] = Math.max(0, change);
    losses[i] = Math.max(0, -change);
  }

  const rollingAverage = (source: number[], index: number) =>
    source.slice(index - period + 1, index + 1).reduce((acc, value) => acc + value, 0) / period;

  const output: number[] = [];
  for (let i = period; i < values.length; i++) {
    const avgGain = rollingAverage(gains, i);
    const avgLoss = rollingAverage(losses, i);
    const relativeStrength = avgLoss === 0 ? 100 : avgGain / avgLoss;
    output[i] = 100 - 100 / (1 + relativeStrength);
  }

  return output;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);

  const macdLine = values.map((_, index) => (fastEma[index] ?? NaN) - (slowEma[index] ?? NaN));
  const signalLine = ema(macdLine.map((value) => (Number.isFinite(value) ? value : 0)), signal);
  const histogram = macdLine.map((value, index) => value - (signalLine[index] ?? 0));

  return { macdLine, signalLine, histogram };
}
