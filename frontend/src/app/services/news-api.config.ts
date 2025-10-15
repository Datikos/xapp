import { InjectionToken } from "@angular/core";

export interface NewsApiConfig {
  enabled: boolean;
  apiToken: string;
  baseUrl?: string;
}

export const NEWS_API_CONFIG = new InjectionToken<NewsApiConfig>(
  "NEWS_API_CONFIG",
  {
    providedIn: "root",
    factory: (): NewsApiConfig => ({
      enabled: false,
      apiToken: "4e89a76117fd692f20b5f6ac89431c2dd6e3f46c",
      baseUrl: "https://cryptopanic.com/api/v1/posts/",
    }),
  }
);
