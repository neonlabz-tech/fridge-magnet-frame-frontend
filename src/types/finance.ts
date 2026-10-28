export type TxKind = 'income' | 'expense';
export type TxMethod = 'Bank Transfer' | 'Cash' | 'Card Payment';
export type TxStatus = 'completed' | 'pending';

export interface Transaction {
  id: string;
  kind: TxKind;
  date: string; // YYYY-MM-DD
  ref: string; // invoice / bill number
  party: string; // customer / vendor
  note: string;
  amount: number;
  method: TxMethod;
  status: TxStatus;
  createdBy?: string; // username; missing = admin (seed data)
}

export const TX_METHODS: TxMethod[] = ['Bank Transfer', 'Cash', 'Card Payment'];
