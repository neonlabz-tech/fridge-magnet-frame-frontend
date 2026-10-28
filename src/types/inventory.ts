export type InventoryStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

export const STOCK_REASONS = ['Initial Stock', 'Purchased', 'Damaged', 'Used', 'Returned', 'Correction'] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

export interface StockLogEntry {
  at: string; // ISO
  role: 'Admin/Director' | 'Warehouse Lead' | 'Purchasing Manager';
  change: number; // +50 / -20
  totalValue: number; // stock value after change
  reason?: StockReason;
}

export interface InventoryItem {
  id: string; // ITEM-0001
  name: string;
  stock: number;
  unitValue: number;
  history: StockLogEntry[];
}

export const LOW_STOCK_LIMIT = 50;

export const getInventoryStatus = (stock: number): InventoryStatus =>
  stock <= 0 ? 'out-of-stock' : stock < LOW_STOCK_LIMIT ? 'low-stock' : 'in-stock';
