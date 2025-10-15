import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { Candle, Interval } from '../models/candle.model';
import type { DataProvider } from '../models/provider.model';

interface CoinbaseGranularity {
  granularity: number;
  groupSize: number;
}

@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private readonly http = inject(HttpClient);
  private readonly binanceUrl = environment.marketData.binanceUrl;
  private readonly coinbaseUrl = environment.marketData.coinbaseUrl;
  private readonly nasdaqUrl = environment.marketData.nasdaqUrl;

  getKlines(
    symbol: string,
    interval: Interval = '1m',
    limit = 500,
    provider: DataProvider = 'binance',
  ): Observable<Candle[]> {
    if (provider === 'coinbase') {
      return this.fetchCoinbase(symbol, interval, limit);
    }
    if (provider === 'nasdaq') {
      return this.fetchNasdaq(symbol, interval, limit);
    }

    return this.fetchBinance(symbol, interval, limit);
  }

  private fetchBinance(symbol: string, interval: Interval, limit: number): Observable<Candle[]> {
    const params = { symbol, interval, limit: limit.toString() };
    return this.http.get<any[]>(this.binanceUrl, { params }).pipe(
      map((rows) =>
        rows.map(
          (row) =>
            ({
              openTime: row[0],
              open: Number(row[1]),
              high: Number(row[2]),
              low: Number(row[3]),
              close: Number(row[4]),
              volume: Number(row[5]),
              closeTime: row[6],
            }) as Candle,
        ),
      ),
    );
  }

  private fetchCoinbase(symbol: string, interval: Interval, limit: number): Observable<Candle[]> {
    const { granularity, groupSize } = this.resolveCoinbaseGranularity(interval);
    const params = { granularity: granularity.toString() };

    return this.http.get<number[][]>(`${this.coinbaseUrl}/${symbol}/candles`, { params }).pipe(
      map((rows) =>
        rows
          .map(
            (row) =>
              ({
                openTime: row[0] * 1000,
                open: Number(row[3]),
                high: Number(row[2]),
                low: Number(row[1]),
                close: Number(row[4]),
                volume: Number(row[5]),
                closeTime: row[0] * 1000 + granularity * 1000,
              }) as Candle,
          )
          .sort((a, b) => a.openTime - b.openTime),
      ),
      map((candles) => (groupSize > 1 ? aggregateCandles(candles, groupSize) : candles)),
      map((candles) => candles.slice(-limit)),
    );
  }

  private fetchNasdaq(symbol: string, interval: Interval, limit: number): Observable<Candle[]> {
    if (!this.nasdaqUrl) {
      return throwError(() => new Error('Nasdaq market data endpoint is not configured.'));
    }
    const params = { symbol, interval, limit: limit.toString() };
    return this.http.get<unknown>(this.nasdaqUrl, { params }).pipe(
      map((payload) => this.parseNasdaqPayload(payload, interval)),
      map((candles) => candles.slice(-limit)),
    );
  }

  private parseNasdaqPayload(payload: unknown, interval: Interval): Candle[] {
    const rows = this.extractNasdaqRows(payload);
    const intervalMs = this.intervalToMs(interval);
    return rows
      .map((row) => this.adaptNasdaqRow(row, intervalMs))
      .filter((candle): candle is Candle => Boolean(candle))
      .sort((a, b) => a.openTime - b.openTime);
  }

  private extractNasdaqRows(payload: unknown): unknown[] {
    if (!payload) {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload;
    }
    if (typeof payload === 'object' && payload !== null) {
      const record = payload as Record<string, unknown>;
      if (Array.isArray(record['candles'])) {
        return record['candles'];
      }
      if (Array.isArray(record['data'])) {
        return record['data'];
      }
      if (Array.isArray(record['results'])) {
        return record['results'];
      }
    }
    return [];
  }

  private adaptNasdaqRow(row: unknown, intervalMs: number): Candle | null {
    if (!row) {
      return null;
    }
    if (Array.isArray(row)) {
      const [time, open, high, low, close, volume, closeTime] = row as unknown[];
      return this.buildCandle(
        time,
        open,
        high,
        low,
        close,
        volume,
        intervalMs,
        closeTime,
      );
    }
    if (typeof row === 'object') {
      const record = row as Record<string, unknown>;
      const openTimeCandidate =
        record['openTime'] ?? record['startTime'] ?? record['time'] ?? record['t'] ?? record['timestamp'];
      const closeTimeCandidate =
        record['closeTime'] ?? record['endTime'] ?? record['t'] ?? record['time'];
      const open = record['open'] ?? record['o'];
      const high = record['high'] ?? record['h'];
      const low = record['low'] ?? record['l'];
      const close = record['close'] ?? record['c'];
      const volume = record['volume'] ?? record['v'];
      return this.buildCandle(
        openTimeCandidate,
        open,
        high,
        low,
        close,
        volume,
        intervalMs,
        closeTimeCandidate,
      );
    }
    return null;
  }

  private buildCandle(
    openTimeCandidate: unknown,
    openCandidate: unknown,
    highCandidate: unknown,
    lowCandidate: unknown,
    closeCandidate: unknown,
    volumeCandidate: unknown,
    intervalMs: number,
    closeTimeCandidate?: unknown,
  ): Candle | null {
    const openTime = this.ensureMillis(openTimeCandidate);
    const open = this.toNumeric(openCandidate);
    const high = this.toNumeric(highCandidate);
    const low = this.toNumeric(lowCandidate);
    const close = this.toNumeric(closeCandidate);
    const volume = this.toNumeric(volumeCandidate) ?? 0;
    const closeTimeProvided = this.ensureMillis(closeTimeCandidate);
    if (openTime === null || open === null || high === null || low === null || close === null) {
      return null;
    }
    const closeTime = closeTimeProvided ?? openTime + intervalMs;
    return {
      openTime,
      open,
      high,
      low,
      close,
      volume,
      closeTime,
    };
  }

  private ensureMillis(value: unknown): number | null {
    const numeric = this.toNumeric(value);
    if (numeric === null) {
      return null;
    }
    if (numeric > 1e12) {
      return Math.round(numeric);
    }
    if (numeric > 1e10) {
      return Math.round(numeric);
    }
    return Math.round(numeric * 1000);
  }

  private toNumeric(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private intervalToMs(interval: Interval): number {
    switch (interval) {
      case '1m':
        return 60_000;
      case '5m':
        return 5 * 60_000;
      case '15m':
        return 15 * 60_000;
      case '1h':
        return 60 * 60_000;
      case '4h':
        return 4 * 60 * 60_000;
      case '1d':
        return 24 * 60 * 60_000;
      default:
        return 60 * 60_000;
    }
  }

  private resolveCoinbaseGranularity(interval: Interval): CoinbaseGranularity {
    switch (interval) {
      case '1m':
        return { granularity: 60, groupSize: 1 };
      case '5m':
        return { granularity: 300, groupSize: 1 };
      case '15m':
        return { granularity: 900, groupSize: 1 };
      case '1h':
        return { granularity: 3600, groupSize: 1 };
      case '4h':
        return { granularity: 3600, groupSize: 4 };
      case '1d':
        return { granularity: 86400, groupSize: 1 };
      default:
        return { granularity: 3600, groupSize: 1 };
    }
  }
}

function aggregateCandles(source: Candle[], groupSize: number): Candle[] {
  if (groupSize <= 1) {
    return source;
  }

  const aggregated: Candle[] = [];
  for (let index = 0; index < source.length; index += groupSize) {
    const slice = source.slice(index, index + groupSize);
    if (slice.length < groupSize) {
      continue;
    }

    const first = slice[0];
    const last = slice[slice.length - 1];

    aggregated.push({
      openTime: first.openTime,
      open: first.open,
      high: Math.max(...slice.map((candle) => candle.high)),
      low: Math.min(...slice.map((candle) => candle.low)),
      close: last.close,
      volume: slice.reduce((acc, candle) => acc + candle.volume, 0),
      closeTime: last.closeTime,
    });
  }

  return aggregated;
}
