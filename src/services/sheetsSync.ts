/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order, Expense, Member, MenuItem, CloseReport } from '../types';
import {
  directSyncNewOrder,
  directSyncOrderSettlement,
  directSyncNewExpense,
  directSyncMenuItems,
  directSyncCloseRegister,
} from './googleSheetsDirect';

export function getWebhookUrl(): string {
  return localStorage.getItem('kala_sheets_webhook_url') || '';
}

export async function sendWebhookPayload(payload: Record<string, unknown>): Promise<boolean> {
  const url = getWebhookUrl();
  if (!url) return false;

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (err) {
    console.error('Failed to dispatch webhook event:', err);
    return false;
  }
}

export async function dispatchLiveOrder(order: Order): Promise<void> {
  // 1. Direct Google Sheets Sync via OAuth (Zero Extension Setup)
  try {
    await directSyncNewOrder(order);
  } catch (e) {
    console.error('Direct Google Sheets sync error:', e);
  }

  // 2. Webhook Fallback
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID');
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const monthYearStr = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();

  const itemsSummary = order.items
    .map(i => `${i.quantity}x ${i.menuItem.name}${i.note ? ` (${i.note})` : ''}`)
    .join(', ');

  sendWebhookPayload({
    action: 'new_order',
    monthYear: monthYearStr,
    date: dateStr,
    time: timeStr,
    invoice: order.invoice,
    buyerName: order.buyerName,
    isMember: order.isMember ? 'MEMBER' : 'REGULER',
    itemsSummary,
    itemsDetail: order.items.map(i => ({
      name: i.menuItem.name,
      quantity: i.quantity,
      price: i.menuItem.price,
      subtotal: i.menuItem.price * i.quantity,
      note: i.note || '',
    })),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    settledVia: order.settledVia || '',
    total: order.total,
    cashPaid: order.cashPaid,
    cashChange: order.cashChange,
  });
}

export async function dispatchOrderSettlement(
  order: Order,
  paymentMethod: 'Cash' | 'QRIS',
  cashPaid: number,
  cashChange: number
): Promise<void> {
  // 1. Direct Google Sheets Sync
  try {
    await directSyncOrderSettlement(order, paymentMethod);
  } catch (e) {
    console.error('Direct Google Sheets sync error:', e);
  }

  // 2. Webhook Fallback
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID');
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const monthYearStr = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();

  sendWebhookPayload({
    action: 'settle_order',
    monthYear: monthYearStr,
    date: dateStr,
    time: timeStr,
    invoice: order.invoice,
    buyerName: order.buyerName,
    paymentMethod,
    paymentStatus: 'Lunas',
    total: order.total,
    cashPaid,
    cashChange,
  });
}

export async function dispatchLiveExpense(expense: Expense): Promise<void> {
  // 1. Direct Google Sheets Sync
  try {
    await directSyncNewExpense(expense);
  } catch (e) {
    console.error('Direct Google Sheets sync error:', e);
  }

  // 2. Webhook Fallback
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID');
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const monthYearStr = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();

  sendWebhookPayload({
    action: 'new_expense',
    monthYear: monthYearStr,
    date: dateStr,
    time: timeStr,
    name: expense.name,
    amount: expense.amount,
    createdAt: expense.createdAt,
  });
}

export async function dispatchSyncMenu(menuItems: MenuItem[]): Promise<boolean> {
  let directSuccess = false;
  try {
    directSuccess = await directSyncMenuItems(menuItems);
  } catch (e) {
    console.error('Direct sync menu error:', e);
  }

  const webhookSuccess = await sendWebhookPayload({
    action: 'sync_menu',
    menus: menuItems.map((item, index) => ({
      no: index + 1,
      name: item.name,
      price: item.price,
      category: item.category,
    })),
  });

  return directSuccess || webhookSuccess;
}

export async function dispatchCloseRegister(
  reportData: Omit<CloseReport, 'id' | 'closedAt'>,
  activeOrders: Order[],
  activeExpenses: Expense[],
  members: Member[],
  memberDebtMap: Record<string, number>
): Promise<boolean> {
  // 1. Direct Google Sheets Sync
  let directSuccess = false;
  try {
    directSuccess = await directSyncCloseRegister(
      reportData,
      activeOrders,
      activeExpenses,
      members,
      memberDebtMap
    );
  } catch (e) {
    console.error('Direct close sync error:', e);
  }

  // 2. Webhook Fallback
  const now = new Date();
  const exportDateTimeStr = `${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID').replace(/:/g, '.')}`;
  const monthYearStr = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();

  const webhookSuccess = await sendWebhookPayload({
    action: 'close_register',
    date: reportData.date,
    exportDateTime: exportDateTimeStr,
    monthYear: monthYearStr,
    ordersCount: activeOrders.length,
    totalCashSales: reportData.totalCashSales,
    totalQrisSales: reportData.totalQrisSales,
    totalExpenses: reportData.totalExpenses,
    expectedCash: reportData.expectedCash,
    actualCash: reportData.actualCash,
    difference: reportData.difference,
    status: reportData.difference === 0 ? 'BALANCE' : reportData.difference > 0 ? 'SURPLUS' : 'DEFISIT',
    expenses: activeExpenses.map(e => ({
      name: e.name,
      amount: e.amount,
      date: new Date(e.createdAt).toLocaleDateString('id-ID'),
    })),
    members: members
      .filter(m => (memberDebtMap[m.id] || 0) > 0)
      .map(m => ({
        name: m.name,
        phone: m.phone,
        debt: memberDebtMap[m.id] || 0,
        status: 'ADA TAGIHAN',
      })),
  });

  return directSuccess || webhookSuccess;
}
