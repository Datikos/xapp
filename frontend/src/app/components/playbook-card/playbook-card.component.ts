import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-playbook-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card playbook">
      <header class="card-heading">
        <h2>6-Step Market Framework</h2>
        <span class="card-subtitle">Checklist before committing capital.</span>
      </header>
      <div class="card-body">
        <ol>
          <li>
            <h3>1. Check Market Trend (Macro Direction)</h3>
            <ul>
              <li>Focus on 4H, 1D, and 1W candles to understand the dominant direction.</li>
              <li>Price above the 200 EMA ⇒ bullish bias, prioritise long setups.</li>
              <li>Price below the 200 EMA ⇒ bearish bias, prioritise short setups.</li>
              <li>Validate with market structure: higher highs & higher lows for bulls, or lower highs & lower lows for bears.</li>
            </ul>
          </li>
          <li>
            <h3>2. Identify Key Levels</h3>
            <ul>
              <li>Mark major support and resistance zones on the 1H–4H charts.</li>
              <li>For longs, wait for confirmation around strong support; for shorts, look for rejection at resistance.</li>
              <li>Watch volume spikes or liquidity sweeps that trap traders before entering in the opposite direction.</li>
            </ul>
          </li>
          <li>
            <h3>3. Confirm With Indicators</h3>
            <ul>
              <li>RSI &lt; 30 can highlight oversold conditions for potential longs; RSI &gt; 70 can flag overbought zones for shorts.</li>
              <li>Use MACD crossovers, Stochastic RSI, or EMA crosses to confirm momentum shifts.</li>
              <li>Monitor funding rates—extreme positive values often precede contrarian short opportunities.</li>
            </ul>
          </li>
          <li>
            <h3>4. Watch BTC Dominance &amp; USDT.D</h3>
            <ul>
              <li>Rising BTC dominance implies capital rotation into BTC—consider favouring BTC longs over altcoins.</li>
              <li>Increasing USDT dominance signals risk-off behaviour and a bearish environment.</li>
            </ul>
          </li>
          <li>
            <h3>5. Use Sentiment &amp; News</h3>
            <ul>
              <li>Extreme greed in the Fear &amp; Greed Index suggests trimming longs or preparing for shorts.</li>
              <li>Extreme fear can offer asymmetric long entries.</li>
              <li>Track major macro events (Fed decisions, CPI prints, ETF headlines) that often catalyse reversals.</li>
            </ul>
          </li>
          <li>
            <h3>6. Risk Management &amp; Confirmation</h3>
            <ul>
              <li>Wait for candle closes or retests before committing to a position.</li>
              <li>Place stop-losses beyond the most recent swing and risk only 1–2% of capital per trade.</li>
              <li>Avoid chasing moves after large impulsive candles—let the market confirm strength.</li>
            </ul>
          </li>
        </ol>
      </div>
    </section>
  `,
})
export class PlaybookCardComponent {}
