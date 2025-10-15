import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import type { DashboardTile } from '../../models/dashboard.model';

@Component({
  selector: 'app-snapshot-strip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="insight-strip" *ngIf="tiles.length">
      <article
        class="insight-chip"
        *ngFor="let tile of tiles"
        [class.insight-chip--bull]="tile.accent === 'bull'"
        [class.insight-chip--bear]="tile.accent === 'bear'"
        [class.insight-chip--info]="tile.accent === 'info'"
        [class.insight-chip--warn]="tile.accent === 'warn'"
        [class.insight-chip--neutral]="tile.accent === 'neutral'"
      >
        <header class="insight-chip-header">
          <span class="insight-chip-label">{{ tile.label }}</span>
          <span class="insight-chip-context" *ngIf="tile.context">{{ tile.context }}</span>
        </header>
        <p class="insight-chip-value">{{ tile.value }}</p>
        <span class="insight-chip-subtext" *ngIf="tile.subtext">{{ tile.subtext }}</span>
      </article>
    </section>
  `,
})
export class SnapshotStripComponent {
  @Input({ required: true }) tiles: DashboardTile[] = [];
}
