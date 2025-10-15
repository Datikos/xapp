export type DataProvider = 'binance' | 'coinbase';

export interface ProviderOption {
  id: DataProvider;
  label: string;
  symbol: string;
}
