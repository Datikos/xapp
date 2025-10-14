import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { Candle, Interval } from '../models/candle.model';

@Injectable({ providedIn: 'root' })
export class BinanceKlinesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://api.binance.com/api/v3/klines';

  getKlines(symbol = 'BTCUSDT', interval: Interval = '1h', limit = 500): Observable<Candle[]> {
    const params = { symbol, interval, limit: limit.toString() };
    return this.http.get<any[]>(this.baseUrl, { params }).pipe(
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
}
