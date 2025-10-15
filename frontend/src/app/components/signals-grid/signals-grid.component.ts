import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import type { DecisionValidation, NearMiss, Signal } from '../../lib/strategy';
import { formatChange } from '../../lib/formatting';

@Component({
  selector: 'app-signals-grid',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout-grid layout-grid--signals">
      <section class="card signals card-list">
        <header class="card-heading">
          <h2>Strategy Signals</h2>
          <span class="card-subtitle">Full confluence entries that align trend + momentum.</span>
        </header>
        <div class="card-body">
          <p class="empty-state" *ngIf="!signals.length">
            No signals yet — load more candles or watch for the next MACD crossover.
          </p>
          <ul *ngIf="signals.length">
            <li *ngFor="let signal of signals.slice(-30)">
              <div class="signal-meta">
                <span class="pill" [class.long-pill]="signal.type === 'LONG'" [class.short-pill]="signal.type === 'SHORT'">{{ signal.type }}</span>
                <span class="price">@ {{ signal.price | number: '1.0-0' }}</span>
                <time>{{ signal.time | date: 'yyyy-MM-dd HH:mm' }}</time>
              </div>
              <p class="signal-reason">{{ signal.reason }}</p>
            </li>
          </ul>
        </div>
      </section>

      <section class="card fast-signals card-list">
        <header class="card-heading">
          <h2>Momentum Scout Signals</h2>
          <span class="card-subtitle">Fast EMA9 / EMA21 crosses to flag early momentum shifts.</span>
        </header>
        <div class="card-body">
          <p class="empty-state" *ngIf="!fastSignals.length">
            No quick momentum signals yet — watching EMA9/EMA21 crosses.
          </p>
          <ul *ngIf="fastSignals.length">
            <li *ngFor="let signal of fastSignals.slice(-30)">
              <div class="signal-meta">
                <span class="pill" [class.long-pill]="signal.type === 'LONG'" [class.short-pill]="signal.type === 'SHORT'">{{ signal.type }}</span>
                <span class="price">@ {{ signal.price | number: '1.0-0' }}</span>
                <time>{{ signal.time | date: 'yyyy-MM-dd HH:mm' }}</time>
              </div>
              <p class="signal-reason">{{ signal.reason }}</p>
            </li>
          </ul>
        </div>
      </section>

      <section class="card validations card-list" *ngIf="hasValidations">
        <header class="card-heading">
          <h2>Decision Validation Log</h2>
          <span class="card-subtitle">Evaluated {{ validationHorizon }}-bar outcome horizon.</span>
        </header>
        <div class="card-body">
          <ul>
            <li *ngFor="let validation of validations.slice(-15)">
              <div class="signal-meta">
                <span class="pill" [class.long-pill]="validation.signalType === 'LONG'" [class.short-pill]="validation.signalType === 'SHORT'">{{ validation.signalType }}</span>
                <span class="price">@ {{ validation.entryPrice | number: '1.0-0' }}</span>
                <time>{{ validation.signalTime | date: 'yyyy-MM-dd HH:mm' }}</time>
              </div>
              <p class="signal-reason">
                Outcome
                <span class="outcome-pill" [class.outcome-win]="validation.outcome === 'WIN'" [class.outcome-loss]="validation.outcome === 'LOSS'" [class.outcome-pending]="validation.outcome === 'PENDING'">
                  {{ validation.outcome }}
                </span>
                <span *ngIf="validation.directionChangePct !== null">
                  {{ formatChangeFn(validation.directionChangePct) }} after
                  {{ validation.actualHorizon ?? validation.horizonCandles }} bars
                </span>
              </p>
              <p class="signal-reason" *ngIf="validation.evaluationTime">
                Checked at {{ validation.evaluationTime | date: 'yyyy-MM-dd HH:mm' }} · Exit @ {{ validation.exitPrice | number: '1.0-0' }}
              </p>
            </li>
          </ul>
        </div>
      </section>

      <section class="card diagnostics card-list" *ngIf="nearMisses.length">
        <header class="card-heading">
          <h2>Near Miss Monitor</h2>
          <span class="card-subtitle">Setups that missed by one criterion — watch for confirmation.</span>
        </header>
        <div class="card-body">
          <ul>
            <li *ngFor="let miss of nearMisses.slice(-10)">
              <div class="signal-meta">
                <span class="pill" [class.long-pill]="miss.bias === 'LONG'" [class.short-pill]="miss.bias === 'SHORT'">{{ miss.bias }}</span>
                <time>{{ miss.time | date: 'yyyy-MM-dd HH:mm' }}</time>
              </div>
              <p class="signal-reason">
                <strong>Satisfied:</strong> {{ miss.satisfied.join(', ') || 'none' }}
              </p>
              <p class="signal-reason">
                <strong>Missing:</strong> {{ miss.missing.join(', ') || 'none' }}
              </p>
            </li>
          </ul>
        </div>
      </section>
    </div>
  `,
})
export class SignalsGridComponent {
  @Input() signals: Signal[] = [];
  @Input() fastSignals: Signal[] = [];
  @Input() validations: DecisionValidation[] = [];
  @Input() nearMisses: NearMiss[] = [];
  @Input() hasValidations = false;
  @Input() validationHorizon: number | null = null;

  protected readonly formatChangeFn = formatChange;
}
