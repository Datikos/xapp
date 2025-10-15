import type { DataProvider } from './provider.model';

export interface AssetOption {
  id: string;
  name: string;
  base: string;
  quote: string;
  providerSymbols: Partial<Record<DataProvider, string>>;
  newsCodes: string[];
  newsKeywords: string[];
}
