import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { Candle, Interval } from '../models/candle.model';

export type DataProvider = 'binance' | 'coinbase';

interface CoinbaseGranularity {
  granularity: number;
  groupSize: number;
}

@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private readonly http = inject(HttpClient);
  private readonly binanceUrl = 'https://api.binance.com/api/v3/klines';
  private readonly coinbaseUrl = 'https://api.exchange.coinbase.com/products';

  getKlines(
    symbol: string,
    interval: Interval = '1h',
    limit = 500,
    provider: DataProvider = 'binance',
  ): Observable<Candle[]> {
    if (provider === 'coinbase') {
      return this.fetchCoinbase(symbol, interval, limit);
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
