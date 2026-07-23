import { ChangeDetectionStrategy, Component, Input } from '@angular/core';


import type { DashboardTile } from '../../models/dashboard.model';

@Component({
  selector: 'app-snapshot-strip',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tiles.length) {
      <section class="insight-strip">
        @for (tile of tiles; track tile) {
          <article
            class="insight-chip"
            [class.insight-chip--bull]="tile.accent === 'bull'"
            [class.insight-chip--bear]="tile.accent === 'bear'"
            [class.insight-chip--info]="tile.accent === 'info'"
            [class.insight-chip--warn]="tile.accent === 'warn'"
            [class.insight-chip--neutral]="tile.accent === 'neutral'"
            >
            <header class="insight-chip-header">
              <span class="insight-chip-label">{{ tile.label }}</span>
              @if (tile.context) {
                <span class="insight-chip-context">{{ tile.context }}</span>
              }
            </header>
            <p class="insight-chip-value">{{ tile.value }}</p>
            @if (tile.subtext) {
              <span class="insight-chip-subtext">{{ tile.subtext }}</span>
            }
          </article>
        }
      </section>
    }
    `,
})
export class SnapshotStripComponent {
  @Input({ required: true }) tiles: DashboardTile[] = [];
}
