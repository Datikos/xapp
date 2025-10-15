export type NewsSentiment = 'positive' | 'negative' | 'neutral';
export type NewsImpactArea = 'macro' | 'regulation' | 'onchain' | 'adoption' | 'liquidity';
export type NewsReach = 'global' | 'regional' | 'local';

export interface NewsItem {
  id: string;
  time: number;
  headline: string;
  summary: string;
  sentiment: NewsSentiment;
  sentimentScore: number; // -1 to 1
  confidence: number; // 0-100
  impactArea: NewsImpactArea;
  reach: NewsReach;
  source: string;
  url?: string;
}

export interface NewsDriver {
  id: string;
  headline: string;
  sentiment: NewsSentiment;
  score: number;
  weight: number;
  source: string;
  time: number;
}

export interface NewsPrediction {
  bias: 'BULL' | 'BEAR' | 'NEUTRAL';
  expectedMovePct: number;
  confidence: number;
  horizonHours: number;
  narrative: string;
  drivers: NewsDriver[];
}

interface BuildNewsPredictionParams {
  news: NewsItem[];
  trendBias: 'BULL' | 'BEAR' | 'NEUTRAL';
  trendConfidence: number;
  expectancy: number | null;
  now?: number;
}

export function buildNewsPrediction({
  news,
  trendBias,
  trendConfidence,
  expectancy,
  now = Date.now(),
}: BuildNewsPredictionParams): NewsPrediction | null {
  if (!news.length) {
    return null;
  }

  const events = news
    .filter((item) => Number.isFinite(item.time) && item.confidence > 20)
    .sort((a, b) => b.time - a.time);

  if (!events.length) {
    return null;
  }

  let totalWeight = 0;
  let weightedScore = 0;
  const drivers: NewsDriver[] = [];

  for (const item of events) {
    const hoursAgo = Math.max(0, (now - item.time) / 3_600_000);
    const freshness = Math.max(0.2, 1 - hoursAgo / 72);
    const reachFactor = item.reach === 'global' ? 1 : item.reach === 'regional' ? 0.7 : 0.45;
    const areaFactor =
      item.impactArea === 'macro'
        ? 1
        : item.impactArea === 'liquidity'
          ? 0.85
          : item.impactArea === 'regulation'
            ? 0.95
            : 0.75;
    const weight = freshness * (item.confidence / 100) * reachFactor * areaFactor;
    totalWeight += weight;
    const sentimentScalar =
      item.sentiment === 'positive' ? 1 : item.sentiment === 'negative' ? -1 : 0;
    const score = clamp(item.sentimentScore * sentimentScalar, -1, 1);
    weightedScore += score * weight;
    drivers.push({
      id: item.id,
      headline: item.headline,
      sentiment: item.sentiment,
      score,
      weight,
      source: item.source,
      time: item.time,
    });
  }

  if (!totalWeight || !Number.isFinite(weightedScore)) {
    return null;
  }

  const netSentiment = weightedScore / totalWeight;
  const bias: NewsPrediction['bias'] =
    netSentiment > 0.12 ? 'BULL' : netSentiment < -0.12 ? 'BEAR' : 'NEUTRAL';

  const expectancyAbs = expectancy !== null ? Math.abs(expectancy) : 0;
  const expectancyFactor = clamp(expectancyAbs / 2, 0, 1.2);
  const baseMove = 0.6 + expectancyFactor;
  const expectedMovePct = clamp(netSentiment * baseMove * 3, -4, 4);

  const confidenceFromNews = clamp((Math.abs(netSentiment) * 100) + Math.min(40, totalWeight * 45), 0, 95);
  const horizonHours = clamp(12 + totalWeight * 36, 6, 72);

  const trendAlignment =
    trendBias === 'NEUTRAL'
      ? 'with no dominant technical bias yet'
      : `while the technical bias leans ${trendBias === 'BULL' ? 'bullish' : 'bearish'} (${trendConfidence}% confidence)`;

  const tone =
    bias === 'BULL'
      ? 'News flow favours risk-on behaviour'
      : bias === 'BEAR'
        ? 'News catalysts lean risk-off'
        : 'Headline mix is balanced';

  const magnitudeDescriptor =
    Math.abs(expectedMovePct) >= 2.5 ? 'expect outsized volatility' : Math.abs(expectedMovePct) >= 1 ? 'watch for a measurable push' : 'look for modest noise';

  const narrative = `${tone}; ${magnitudeDescriptor} ${trendAlignment}.`;

  const topDrivers = drivers
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((driver) => ({
      ...driver,
      score: Math.round(driver.score * 100) / 100,
      weight: Math.round(driver.weight * 100) / 100,
    }));

  return {
    bias,
    expectedMovePct: Math.round(expectedMovePct * 10) / 10,
    confidence: Math.round(confidenceFromNews),
    horizonHours: Math.round(horizonHours),
    narrative,
    drivers: topDrivers,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

