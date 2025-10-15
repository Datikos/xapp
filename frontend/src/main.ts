import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';

import { AppComponent } from './app/app.component';
import { NEWS_API_CONFIG } from './app/services/news-api.config';

const env = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};
const newsApiToken = env.NG_APP_CRYPTOPANIC_TOKEN ?? env.NG_APP_NEWS_TOKEN ?? '';
const newsApiBaseUrl = env.NG_APP_NEWS_BASE_URL ?? 'https://cryptopanic.com/api/v1/posts/';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideZonelessChangeDetection(),
    {
      provide: NEWS_API_CONFIG,
      useValue: {
        enabled: Boolean(newsApiToken),
        apiToken: newsApiToken,
        baseUrl: newsApiBaseUrl,
      },
    },
  ],
}).catch((err) => console.error(err));
