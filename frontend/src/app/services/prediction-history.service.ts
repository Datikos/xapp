import { Injectable, signal } from '@angular/core';

import { Candle } from '../models/candle.model';
import { NewsPrediction } from '../lib/news';

const STORAGE_KEY = 'newsPredictionHistory';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface NewsPredictionRecord {
  id: string;
  createdAt: number;
  candleTime: number;
  price: number;
  bias: NewsPrediction['bias'];
  expectedMovePct: number;
  horizonMs: number;
  confidence: number;
}

export interface ResolvedNewsPredictionRecord extends NewsPredictionRecord {
  resolvedAt: number | null;
  actualMovePct: number | null;
  outcome: 'HIT' | 'MISS' | 'PENDING';
}

@Injectable({ providedIn: 'root' })
export class PredictionHistoryService {
  private readonly recordsSignal = signal<NewsPredictionRecord[]>(this.loadRecords());

  records(): NewsPredictionRecord[] {
    return this.recordsSignal();
  }

  recordNewsPrediction(prediction: NewsPrediction, candle: Candle): void {
    if (!Number.isFinite(candle.close) || !Number.isFinite(candle.closeTime)) {
      return;
    }

    const now = Date.now();
    const horizonMs = Math.max(1, Math.round(prediction.horizonHours * 60 * 60 * 1000));
    const recordId = `news-${candle.closeTime}`;

    const existing = this.recordsSignal();
    const alreadyLogged = existing.some((record) => record.id === recordId);
    if (alreadyLogged) {
      return;
    }

    const record: NewsPredictionRecord = {
      id: recordId,
      createdAt: now,
      candleTime: candle.closeTime,
      price: candle.close,
      bias: prediction.bias,
      expectedMovePct: prediction.expectedMovePct,
      horizonMs,
      confidence: prediction.confidence,
    };

    const cutoff = now - THIRTY_DAYS_MS;
    const nextRecords = [record, ...existing.filter((item) => item.createdAt >= cutoff)];
    this.recordsSignal.set(nextRecords);
    this.saveRecords(nextRecords);
  }

  resolveRecords(candles: Candle[]): ResolvedNewsPredictionRecord[] {
    const sortedCandles = [...candles].sort((a, b) => a.closeTime - b.closeTime);
    return this.records()
      .map((record) => this.resolveRecord(record, sortedCandles))
      .filter((item) => item !== null) as ResolvedNewsPredictionRecord[];
  }

  private resolveRecord(record: NewsPredictionRecord, candles: Candle[]): ResolvedNewsPredictionRecord | null {
    const targetTime = record.candleTime + record.horizonMs;
    let nearest: Candle | null = null;
    for (const candle of candles) {
      if (candle.closeTime >= targetTime) {
        nearest = candle;
        break;
      }
    }
    if (!nearest && candles.length) {
      nearest = candles[candles.length - 1];
    }

    if (!nearest || !Number.isFinite(nearest.close)) {
      return {
        ...record,
        resolvedAt: null,
        actualMovePct: null,
        outcome: 'PENDING',
      };
    }

    const actualMove = ((nearest.close - record.price) / record.price) * 100;
    const resolvedAt = nearest.closeTime;
    const outcome =
      Math.sign(actualMove) === Math.sign(record.expectedMovePct) && actualMove !== 0
        ? 'HIT'
        : Math.sign(actualMove) !== 0 && Math.sign(actualMove) !== Math.sign(record.expectedMovePct)
          ? 'MISS'
          : 'PENDING';

    return {
      ...record,
      resolvedAt,
      actualMovePct: Math.round(actualMove * 10) / 10,
      outcome,
    };
  }

  private loadRecords(): NewsPredictionRecord[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as NewsPredictionRecord[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      const cutoff = Date.now() - THIRTY_DAYS_MS;
      return parsed.filter((item) => typeof item === 'object' && item.createdAt >= cutoff);
    } catch {
      return [];
    }
  }

  private saveRecords(records: NewsPredictionRecord[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // ignore storage errors
    }
  }
}

