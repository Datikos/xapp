require('dotenv').config();

const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || '';
const TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com/time_series';

const INTERVAL_MAP = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '1h': '1h',
  '4h': '4h',
  '1d': '1day',
};

const app = express();
app.use(cors());

app.get('/api/nasdaq/candles', async (req, res) => {
  const symbol = typeof req.query.symbol === 'string' ? req.query.symbol.trim() : '';
  const intervalParam = typeof req.query.interval === 'string' ? req.query.interval : '1m';
  const limitParam = Number(req.query.limit);

  if (!symbol) {
    return res.status(400).json({ error: 'Query parameter "symbol" is required.' });
  }

  const twelveInterval = INTERVAL_MAP[intervalParam];
  if (!twelveInterval) {
    return res.status(400).json({
      error: `Unsupported interval "${intervalParam}". Expected one of: ${Object.keys(INTERVAL_MAP).join(', ')}.`,
    });
  }

  if (!TWELVE_DATA_API_KEY) {
    return res.status(500).json({
      error: 'TWELVE_DATA_API_KEY is not configured on the server. Set it in server/.env.',
    });
  }

  const outputsize = Number.isFinite(limitParam) ? Math.min(Math.max(Math.round(limitParam), 1), 5000) : 500;

  const url = new URL(TWELVE_DATA_BASE_URL);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', twelveInterval);
  url.searchParams.set('outputsize', String(outputsize));
  url.searchParams.set('timezone', 'UTC');
  url.searchParams.set('apikey', TWELVE_DATA_API_KEY);

  try {
    const upstreamResponse = await fetch(url);
    const payload = await upstreamResponse.json();

    if (!upstreamResponse.ok || payload.status === 'error') {
      const message = payload?.message || `Twelve Data request failed with status ${upstreamResponse.status}.`;
      return res.status(502).json({ error: message });
    }

    const values = Array.isArray(payload.values) ? payload.values : [];
    const candles = values
      .map((value) => {
        const rawDatetime = typeof value.datetime === 'string' ? value.datetime : '';
        const isoDatetime = rawDatetime.includes(' ')
          ? `${rawDatetime.replace(' ', 'T')}Z`
          : `${rawDatetime}T00:00:00Z`;
        const openTime = Date.parse(isoDatetime);
        const open = Number(value.open);
        const high = Number(value.high);
        const low = Number(value.low);
        const close = Number(value.close);
        const volume = Number(value.volume ?? 0);
        if (!Number.isFinite(openTime) || [open, high, low, close].some((n) => !Number.isFinite(n))) {
          return null;
        }
        return { openTime, open, high, low, close, volume };
      })
      .filter(Boolean)
      .sort((a, b) => a.openTime - b.openTime);

    return res.json({ candles });
  } catch (err) {
    console.error('Failed to fetch Nasdaq candles from Twelve Data', err);
    return res.status(502).json({ error: 'Failed to reach Twelve Data upstream API.' });
  }
});

app.listen(PORT, () => {
  console.log(`xapp backend proxy listening on http://localhost:${PORT}`);
});
