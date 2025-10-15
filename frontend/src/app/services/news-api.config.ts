import { InjectionToken } from '@angular/core';

import { environment } from '../../environments/environment';

export interface NewsApiConfig {
  enabled: boolean;
  apiToken: string;
  baseUrl?: string;
}

export const NEWS_API_CONFIG = new InjectionToken<NewsApiConfig>('NEWS_API_CONFIG', {
  providedIn: 'root',
  factory: (): NewsApiConfig => ({
    ...environment.newsApi,
  }),
});
