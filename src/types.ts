/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

export interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
  note: string;
}

export interface Order {
  id: string;
  invoice: string;
  buyerName: string;
  isMember: boolean;
  memberId?: string;
  items: OrderItem[];
  total: number;
  paymentMethod: 'Cash' | 'QRIS' | 'Member Tab' | 'Bayar Nanti';
  settledVia?: 'Cash' | 'QRIS';
  paymentStatus: 'Lunas' | 'Belum Bayar';
  orderStatus: 'Sedang Dibuat' | 'Selesai';
  createdAt: string;
  cashPaid: number;
  cashChange: number;
  isClosedInSession?: boolean;
  closeReportId?: string;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  createdAt: string;
  isClosedInSession?: boolean;
  closeReportId?: string;
}

export interface CloseReport {
  id: string;
  date: string;
  totalCashSales: number;
  totalQrisSales: number;
  totalExpenses: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  closedAt: string;
}
