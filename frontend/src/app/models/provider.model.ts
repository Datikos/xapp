export type DataProvider = 'binance' | 'coinbase' | 'nasdaq';

export interface ProviderOption {
  id: DataProvider;
  label: string;
  symbol: string;
}
