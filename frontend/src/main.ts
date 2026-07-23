import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';

import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withXhr()),
    provideZonelessChangeDetection(),
  ],
}).catch((err) => console.error(err));
