/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order, Expense, Member, MenuItem, CloseReport } from '../types';
import { getAccessToken } from './googleAuth';

export interface GoogleSpreadsheetInfo {
  id: string;
  url: string;
  name: string;
}

const STORAGE_KEY_SHEET_ID = 'pos_google_spreadsheet_id';
const STORAGE_KEY_SHEET_URL = 'pos_google_spreadsheet_url';

export function getSavedSpreadsheetInfo(): GoogleSpreadsheetInfo | null {
  const id = localStorage.getItem(STORAGE_KEY_SHEET_ID);
  const url = localStorage.getItem(STORAGE_KEY_SHEET_URL);
  if (id && url) {
    return { id, url, name: 'POS WTM - Live Transaksi & Laporan' };
  }
  return null;
}

export function getSavedSpreadsheetUrl(): string | null {
  return localStorage.getItem(STORAGE_KEY_SHEET_URL);
}

export async function getOrCreateSpreadsheet(menuItems: MenuItem[] = []): Promise<GoogleSpreadsheetInfo> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Silakan login ke Akun Google terlebih dahulu.');
  }
  return initializeLiveSpreadsheet(token, menuItems);
}

export function saveSpreadsheetInfo(id: string, url: string): void {
  localStorage.setItem(STORAGE_KEY_SHEET_ID, id);
  localStorage.setItem(STORAGE_KEY_SHEET_URL, url);
}

export function clearSpreadsheetInfo(): void {
  localStorage.removeItem(STORAGE_KEY_SHEET_ID);
  localStorage.removeItem(STORAGE_KEY_SHEET_URL);
}

function formatRp(val: number): string {
  const num = Math.round(Number(val) || 0);
  return ' Rp' + num.toLocaleString('en-US') + ' ';
}

// 1. Create or Find existing Spreadsheet in Google Drive
export async function initializeLiveSpreadsheet(
  accessToken: string,
  menuItems: MenuItem[] = []
): Promise<GoogleSpreadsheetInfo> {
  const existing = getSavedSpreadsheetInfo();

  // Validate existing spreadsheet if present
  if (existing?.id) {
    try {
      const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${existing.id}?fields=spreadsheetId,properties.title`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (checkRes.ok) {
        return existing;
      }
    } catch {
      // Create new one below
    }
  }

  const now = new Date();
  const currentMonthSheet = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();

  // Create new Spreadsheet
  const createPayload = {
    properties: {
      title: `POS WTM - Live Transaksi & Laporan`,
    },
    sheets: [
      {
        properties: {
          title: currentMonthSheet,
          gridProperties: { rowCount: 1000, columnCount: 15 },
        },
      },
      {
        properties: {
          title: 'DAFTAR_MENU',
          gridProperties: { rowCount: 100, columnCount: 10 },
        },
      },
      {
        properties: {
          title: 'PENGELUARAN',
          gridProperties: { rowCount: 500, columnCount: 10 },
        },
      },
      {
        properties: {
          title: 'TAGIHAN_MEMBER',
          gridProperties: { rowCount: 200, columnCount: 10 },
        },
      },
    ],
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(err.error?.message || 'Gagal membuat Google Spreadsheet baru.');
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  saveSpreadsheetInfo(spreadsheetId, spreadsheetUrl);

  // Initialize Headers in Current Month Sheet
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${currentMonthSheet}'!A1:H3:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [
          [currentMonthSheet],
          [],
          ['Waktu', 'Invoice', 'Pelanggan', 'Tipe', 'Menu / Pesanan', 'Metode Bayar', 'Status', 'Total (Rp)'],
        ],
      }),
    }
  );

  // Initialize PENGELUARAN Header
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'PENGELUARAN'!A1:D1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [['Tanggal', 'Waktu', 'Nama Pengeluaran', 'Jumlah Biaya (Rp)']],
      }),
    }
  );

  // Initialize TAGIHAN_MEMBER Header
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'TAGIHAN_MEMBER'!A1:E1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [['Nama Member', 'Nomor Handphone', 'Total Tagihan Aktif', 'Status', 'Terakhir Diupdate']],
      }),
    }
  );

  // Populate DAFTAR_MENU tab
  if (menuItems.length > 0) {
    await syncDaftarMenuDirect(accessToken, spreadsheetId, menuItems);
  }

  return { id: spreadsheetId, url: spreadsheetUrl, name: 'POS WTM - Live Transaksi & Laporan' };
}

// 2. Ensure Sheet for Month Exists
async function ensureMonthSheetExists(accessToken: string, spreadsheetId: string, sheetTitle: string): Promise<void> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) return;
  const meta = await metaRes.json();
  const exists = meta.sheets?.some((s: { properties?: { title?: string } }) => s.properties?.title === sheetTitle);

  if (!exists) {
    // Add Sheet
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
                gridProperties: { rowCount: 1000, columnCount: 15 },
              },
            },
          },
        ],
      }),
    });

    // Add Header
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetTitle}'!A1:H3:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [
            [sheetTitle],
            [],
            ['Waktu', 'Invoice', 'Pelanggan', 'Tipe', 'Menu / Pesanan', 'Metode Bayar', 'Status', 'Total (Rp)'],
          ],
        }),
      }
    );
  }
}

// 3. Append Real-Time Order to Current Month Sheet
export async function appendLiveOrderDirect(
  accessToken: string,
  spreadsheetId: string,
  order: Order
): Promise<void> {
  const now = new Date();
  const currentMonthSheet = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  await ensureMonthSheetExists(accessToken, spreadsheetId, currentMonthSheet);

  const itemsSummary = order.items
    .map(i => `${i.quantity}x ${i.menuItem.name}${i.note ? ` (${i.note})` : ''}`)
    .join(', ');

  const row = [
    timeStr,
    order.invoice,
    order.buyerName,
    order.isMember ? 'MEMBER' : 'REGULER',
    itemsSummary,
    order.paymentMethod,
    order.paymentStatus,
    formatRp(order.total),
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${currentMonthSheet}'!A:H:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );
}

// 4. Append Order Settlement
export async function appendOrderSettlementDirect(
  accessToken: string,
  spreadsheetId: string,
  order: Order,
  paymentMethod: 'Cash' | 'QRIS'
): Promise<void> {
  const now = new Date();
  const currentMonthSheet = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  await ensureMonthSheetExists(accessToken, spreadsheetId, currentMonthSheet);

  const row = [
    timeStr,
    order.invoice,
    order.buyerName,
    order.isMember ? 'MEMBER (Pelunasan)' : 'REGULER (Pelunasan)',
    `Pelunasan Tagihan / Pesanan #${order.invoice}`,
    paymentMethod,
    'Lunas',
    formatRp(order.total),
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${currentMonthSheet}'!A:H:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );
}

// 5. Append Real-Time Expense to PENGELUARAN Sheet
export async function appendLiveExpenseDirect(
  accessToken: string,
  spreadsheetId: string,
  expense: Expense
): Promise<void> {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID');
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const row = [dateStr, timeStr, expense.name, formatRp(expense.amount)];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'PENGELUARAN'!A:D:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );
}

// 6. Sync DAFTAR MENU
export async function syncDaftarMenuDirect(
  accessToken: string,
  spreadsheetId: string,
  menuItems: MenuItem[]
): Promise<void> {
  // Clear existing content in DAFTAR_MENU
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'DAFTAR_MENU'!A1:D100:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const values: (string | number)[][] = [
    ['DAFTAR MENU'],
    [],
    ['No', 'Nama MENU', 'Harga', 'Kategori'],
  ];

  menuItems.forEach((item, index) => {
    values.push([index + 1, item.name, formatRp(item.price), item.category || 'General']);
  });

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'DAFTAR_MENU'!A1:D${values.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );
}

// 7. Append Close Register and Separation Block
export async function appendCloseRegisterDirect(
  accessToken: string,
  spreadsheetId: string,
  reportData: Omit<CloseReport, 'id' | 'closedAt'>,
  activeOrders: Order[],
  members: Member[],
  memberDebtMap: Record<string, number>
): Promise<void> {
  const now = new Date();
  const currentMonthSheet = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();
  const exportDateTimeStr = `${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID').replace(/:/g, '.')}`;
  const statusStr = reportData.difference === 0 ? 'BALANCE' : reportData.difference > 0 ? 'SURPLUS' : 'DEFISIT';

  await ensureMonthSheetExists(accessToken, spreadsheetId, currentMonthSheet);

  const closeBlock: (string | number)[][] = [
    [],
    [`LAPORAN WTM ${reportData.date}`],
    ['Waktu Penutupan:', exportDateTimeStr],
    ['Total Transaksi:', `${activeOrders.length} Pesanan`],
    [],
    ['RINGKASAN LAPORAN KEUANGAN HARIAN'],
    ['Total Cash:', ':', formatRp(reportData.totalCashSales)],
    ['Total QRIS:', ':', formatRp(reportData.totalQrisSales)],
    ['Total Pengeluaran:', ':', formatRp(reportData.totalExpenses)],
    ['Uang Di Wadah (Laci):', ':', formatRp(reportData.actualCash)],
    ['Status Selisih:', ':', `${statusStr} (${formatRp(reportData.difference)})`],
    [],
    ['CLOSE'],
    [],
    ['------------------------------------------------------------'],
    [],
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${currentMonthSheet}'!A:H:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: closeBlock }),
    }
  );

  // Update TAGIHAN_MEMBER
  const memberWithDebts = members.filter(m => (memberDebtMap[m.id] || 0) > 0);
  if (memberWithDebts.length > 0) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'TAGIHAN_MEMBER'!A1:E100:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const memValues: (string | number)[][] = [
      ['Nama Member', 'Nomor Handphone', 'Total Tagihan Aktif', 'Status', 'Terakhir Diupdate'],
    ];

    memberWithDebts.forEach(m => {
      memValues.push([
        m.name,
        m.phone,
        formatRp(memberDebtMap[m.id] || 0),
        'ADA TAGIHAN',
        `${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID')}`,
      ]);
    });

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'TAGIHAN_MEMBER'!A1:E${memValues.length}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: memValues }),
      }
    );
  }
}

export async function directSyncNewOrder(order: Order): Promise<void> {
  const token = await getAccessToken();
  const info = getSavedSpreadsheetInfo();
  if (token && info?.id) {
    await appendLiveOrderDirect(token, info.id, order);
  }
}

export async function directSyncOrderSettlement(
  order: Order,
  paymentMethod: 'Cash' | 'QRIS'
): Promise<void> {
  const token = await getAccessToken();
  const info = getSavedSpreadsheetInfo();
  if (token && info?.id) {
    await appendOrderSettlementDirect(token, info.id, order, paymentMethod);
  }
}

export async function directSyncNewExpense(expense: Expense): Promise<void> {
  const token = await getAccessToken();
  const info = getSavedSpreadsheetInfo();
  if (token && info?.id) {
    await appendLiveExpenseDirect(token, info.id, expense);
  }
}

export async function directSyncMenuItems(menuItems: MenuItem[]): Promise<boolean> {
  const token = await getAccessToken();
  const info = getSavedSpreadsheetInfo();
  if (token && info?.id) {
    await syncDaftarMenuDirect(token, info.id, menuItems);
    return true;
  }
  return false;
}

export async function directSyncCloseRegister(
  reportData: Omit<CloseReport, 'id' | 'closedAt'>,
  activeOrders: Order[],
  _activeExpenses: Expense[],
  members: Member[],
  memberDebtMap: Record<string, number>
): Promise<boolean> {
  const token = await getAccessToken();
  const info = getSavedSpreadsheetInfo();
  if (token && info?.id) {
    await appendCloseRegisterDirect(
      token,
      info.id,
      reportData,
      activeOrders,
      members,
      memberDebtMap
    );
    return true;
  }
  return false;
}

