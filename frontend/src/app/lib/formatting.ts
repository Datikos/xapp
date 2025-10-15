import type { TrendFactor } from './strategy';

export function formatChange(change: number | null): string {
  if (change === null || !Number.isFinite(change)) {
    return 'n/a';
  }
  const magnitude = Math.abs(change);
  const precision = magnitude >= 10 ? 0 : 1;
  const rounded = change.toFixed(precision);
  const prefix = change > 0 ? '+' : '';
  return `${prefix}${rounded}%`;
}

export function formatProfitFactor(value: number | null): string {
  if (value === null) {
    return 'n/a';
  }
  if (!Number.isFinite(value)) {
    return '∞';
  }
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

export function formatCountdown(targetTime: number | null): string {
  if (targetTime === null || !Number.isFinite(targetTime)) {
    return 'n/a';
  }
  const diff = targetTime - Date.now();
  const absDiff = Math.abs(diff);
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;

  if (absDiff < minuteMs) {
    return diff >= 0 ? 'in <1m' : '<1m late';
  }

  const hours = Math.floor(absDiff / hourMs);
  const minutes = Math.floor((absDiff % hourMs) / minuteMs);
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (!parts.length) {
    parts.push('<1m');
  }

  const phrase = parts.join(' ');
  return diff >= 0 ? `in ${phrase}` : `${phrase} late`;
}

export function correlationDescriptor(value: number | null): string {
  if (value === null) {
    return 'Awaiting more closed trades';
  }
  if (value >= 0.65) {
    return 'Strong alignment with reality';
  }
  if (value >= 0.35) {
    return 'Moderate alignment';
  }
  if (value >= 0) {
    return 'Light positive alignment';
  }
  if (value >= -0.35) {
    return 'Slightly inverted';
  }
  return 'Inverted vs expectations';
}

export function predictionNarrative(
  totalReturn: number,
  hitRate: number | null,
  correlation: number | null,
  tradeCount: number,
): string {
  if (tradeCount === 0) {
    return 'Once a few trades settle we will surface how signals are tracking live outcomes.';
  }
  const returnTone =
    totalReturn > 0
      ? 'Net gains show the confluence is adding edge.'
      : totalReturn < 0
        ? 'Drawdown indicates the model is trailing live price action.'
        : 'Returns are flat versus expectations so far.';
  let alignmentTone: string;
  if (correlation === null) {
    alignmentTone = 'Need additional closed trades to gauge alignment.';
  } else if (correlation >= 0.65) {
    alignmentTone = 'Alignment is strong, so the directional bias can be trusted.';
  } else if (correlation >= 0.35) {
    alignmentTone = 'Alignment is decent but still warrants confirmation.';
  } else if (correlation >= 0) {
    alignmentTone = 'Alignment is light — blend in discretionary context.';
  } else {
    alignmentTone = 'Signals are inverted right now — lean on defensive positioning.';
  }
  let hitRateTone = '';
  if (hitRate !== null) {
    if (hitRate >= 60) {
      hitRateTone = ' Hit rate is solid and supports active follow-through.';
    } else if (hitRate >= 45) {
      hitRateTone = ' Hit rate sits near breakeven — be selective.';
    } else {
      hitRateTone = ' Hit rate is soft — focus on high conviction setups only.';
    }
  }
  return `${returnTone} ${alignmentTone}${hitRateTone}`.trim();
}

export function factorIntensity(factor: TrendFactor): number {
  const weight = factor.weight || 1;
  if (weight === 0) {
    return 0;
  }
  return Math.min(100, Math.round((Math.abs(factor.contribution) / weight) * 100));
}
