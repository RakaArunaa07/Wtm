/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { CloseReport, Order, Expense, Member, MenuItem } from '../types';
import { Lock, Unlock, HelpCircle, DollarSign, CreditCard, ShoppingBag, Download, Check, AlertTriangle, Copy, ExternalLink, RefreshCw, FileSpreadsheet, Trash2, X, UtensilsCrossed, LogOut, CheckCircle2 } from 'lucide-react';
import QrisPoster from './QrisPoster';
import { dispatchSyncMenu } from '../services/sheetsSync';
import { googleSignIn, googleSignOut, initAuth } from '../services/googleAuth';
import { getOrCreateSpreadsheet, getSavedSpreadsheetUrl, directSyncMenuItems } from '../services/googleSheetsDirect';
import { User } from 'firebase/auth';

interface CloseTabProps {
  isClosed: boolean;
  activeOrders: Order[];
  activeExpenses: Expense[];
  closeReports: CloseReport[];
  members: Member[];
  allOrders: Order[];
  allExpenses?: Expense[];
  menuItems?: MenuItem[];
  onCloseRegister: (actualCash: number, report: Omit<CloseReport, 'id' | 'closedAt'>, customReportId?: string) => void;
  onReopenRegister: () => void;
  onResetAllData?: () => void;
  onSettleOrder?: (orderId: string, paymentMethod: 'Cash' | 'QRIS', cashPaid: number, cashChange: number) => void;
}

export default function CloseTab({
  isClosed,
  activeOrders,
  activeExpenses,
  closeReports,
  members,
  allOrders,
  allExpenses = [],
  menuItems = [],
  onCloseRegister,
  onReopenRegister,
  onResetAllData,
  onSettleOrder,
}: CloseTabProps) {
  // Close form state
  const [actualCashInput, setActualCashInput] = useState('');

  // Modal State for Settling Pay Later Order directly inside CloseTab
  const [settlingOrder, setSettlingOrder] = useState<Order | null>(null);
  const [settleMethod, setSettleMethod] = useState<'Cash' | 'QRIS'>('Cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [qrisConfirmed, setQrisConfirmed] = useState(false);

  // Google Direct Auth State (Zero-setup live sheets)
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(() => getSavedSpreadsheetUrl());
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);

  // Google Sheets Webhook Fallback State
  const [sheetsWebhookUrl, setSheetsWebhookUrl] = useState(() => {
    return localStorage.getItem('kala_sheets_webhook_url') || '';
  });
  const [showTutorial, setShowTutorial] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [menuSyncStatus, setMenuSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
        const savedUrl = getSavedSpreadsheetUrl();
        if (savedUrl) setSpreadsheetUrl(savedUrl);
      },
      () => {
        setGoogleUser(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setGoogleUser(res.user);
        setIsCreatingSheet(true);
        try {
          const sheet = await getOrCreateSpreadsheet();
          setSpreadsheetUrl(sheet.url);
          if (menuItems.length > 0) {
            await directSyncMenuItems(menuItems);
          }
          alert('Akun Google berhasil terhubung! File "POS WTM - Live Spreadsheet" telah otomatis dibuat dan aktif.');
        } catch (e: any) {
          console.error(e);
        } finally {
          setIsCreatingSheet(false);
        }
      }
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      alert('Gagal login dengan Google: ' + (err?.message || 'Silakan coba lagi.'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await googleSignOut();
    setGoogleUser(null);
  };

  const handleOpenOrCreateSpreadsheet = async () => {
    if (!googleUser) {
      handleGoogleLogin();
      return;
    }
    setIsCreatingSheet(true);
    try {
      const sheet = await getOrCreateSpreadsheet();
      setSpreadsheetUrl(sheet.url);
      window.open(sheet.url, '_blank');
    } catch (e: any) {
      alert('Gagal membuka spreadsheet: ' + (e?.message || 'Error'));
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Google Apps Script template matching user's live spreadsheet layout
  const appsScriptCode = `function doPost(e) {
  try {
    var jsonString = e.postData.contents;
    var data = JSON.parse(jsonString);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 0. PING TEST
    if (data.action === 'ping') {
      var logSheet = ss.getSheetByName("LOG_SINKRONISASI") || ss.insertSheet("LOG_SINKRONISASI");
      if (logSheet.getLastRow() === 0) {
        logSheet.appendRow(["Waktu", "Aktivitas", "Status"]);
      }
      logSheet.appendRow([new Date(), "Test Koneksi (Ping)", "BERHASIL"]);
      return ContentService.createTextOutput("Koneksi OK");
    }
    
    // Helper Format Rupiah
    function formatRp(val) {
      var num = Number(val) || 0;
      return ' Rp' + Math.round(num).toLocaleString('en-US') + ' ';
    }
    
    // 1. EVENT PESANAN BARU / PELUNASAN (LIVE PER TRANSAKSI)
    if (data.action === 'new_order' || data.action === 'settle_order') {
      var sheetName = data.monthYear || (Utilities.formatDate(new Date(), "GMT+7", "MMMM yyyy").toUpperCase());
      var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
      
      // Jika sheet bulan baru, buat judul bulan dan header tabel
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([sheetName]);
        sheet.appendRow([]);
        sheet.appendRow(["Waktu", "Invoice", "Pelanggan", "Tipe", "Menu / Pesanan", "Metode Bayar", "Status", "Total (Rp)"]);
      }
      
      // Tambah baris transaksi langsung secara real-time
      sheet.appendRow([
        data.time || Utilities.formatDate(new Date(), "GMT+7", "HH:mm"),
        data.invoice || "-",
        data.buyerName || "Pelanggan",
        data.isMember || "REGULER",
        data.itemsSummary || "-",
        data.paymentMethod || "Cash",
        data.paymentStatus || "Lunas",
        formatRp(data.total)
      ]);
      return ContentService.createTextOutput("Pesanan Live Tercatat!");
    }
    
    // 2. EVENT PENGELUARAN BARU (LIVE)
    if (data.action === 'new_expense') {
      var expSheet = ss.getSheetByName("PENGELUARAN") || ss.insertSheet("PENGELUARAN");
      if (expSheet.getLastRow() === 0) {
        expSheet.appendRow(["Tanggal", "Waktu", "Nama Pengeluaran", "Jumlah Biaya (Rp)"]);
      }
      expSheet.appendRow([
        data.date || Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy"),
        data.time || Utilities.formatDate(new Date(), "GMT+7", "HH:mm"),
        data.name,
        formatRp(data.amount)
      ]);
      return ContentService.createTextOutput("Pengeluaran Live Tercatat!");
    }
    
    // 3. SINKRONISASI DAFTAR MENU (Format Sesuai Contoh: No, Nama MENU, Harga, Kategori)
    if (data.action === 'sync_menu') {
      var menuSheet = ss.getSheetByName("DAFTAR_MENU") || ss.insertSheet("DAFTAR_MENU");
      menuSheet.clear();
      menuSheet.appendRow(["DAFTAR MENU"]);
      menuSheet.appendRow([]);
      menuSheet.appendRow(["No", "Nama MENU", "Harga", "Kategori"]);
      if (data.menus && data.menus.length > 0) {
        data.menus.forEach(function(m, idx) {
          menuSheet.appendRow([idx + 1, m.name, formatRp(m.price), m.category || "General"]);
        });
      }
      return ContentService.createTextOutput("Daftar Menu Berhasil Diperbarui!");
    }
    
    // 4. EVENT CLOSE REGISTER (PENUTUPAN SESI KASIR)
    if (data.action === 'close_register') {
      var monthSheetName = data.monthYear || (Utilities.formatDate(new Date(), "GMT+7", "MMMM yyyy").toUpperCase());
      var mSheet = ss.getSheetByName(monthSheetName) || ss.insertSheet(monthSheetName);
      
      if (mSheet.getLastRow() === 0) {
        mSheet.appendRow([monthSheetName]);
        mSheet.appendRow([]);
      }
      
      // Baris Ringkasan Laporan dan Penanda CLOSE
      var closeBlock = [
        [],
        ["LAPORAN WTM " + data.date],
        ["Waktu Penutupan:", data.exportDateTime || Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH.mm.ss")],
        ["Total Transaksi:", (data.ordersCount || 0) + " Pesanan"],
        [],
        ["RINGKASAN LAPORAN KEUANGAN HARIAN"],
        ["Total Cash:", ":", formatRp(data.totalCashSales)],
        ["Total QRIS:", ":", formatRp(data.totalQrisSales)],
        ["Total Pengeluaran:", ":", formatRp(data.totalExpenses)],
        ["Uang Di Wadah (Laci):", ":", formatRp(data.actualCash)],
        ["Status Selisih:", ":", (data.status || "BALANCE") + " (" + formatRp(data.difference) + ")"],
        [],
        ["CLOSE"],
        [],
        ["------------------------------------------------------------"],
        []
      ];
      
      closeBlock.forEach(function(row) {
        mSheet.appendRow(row);
      });
      
      // Update Tagihan Member jika ada
      if (data.members && data.members.length > 0) {
        var memSheet = ss.getSheetByName("TAGIHAN_MEMBER") || ss.insertSheet("TAGIHAN_MEMBER");
        memSheet.clear();
        memSheet.appendRow(["Nama Member", "Nomor Handphone", "Total Tagihan Aktif", "Status", "Terakhir Diupdate"]);
        data.members.forEach(function(mem) {
          memSheet.appendRow([mem.name, mem.phone, formatRp(mem.debt), mem.status, Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss")]);
        });
      }
      
      return ContentService.createTextOutput("Sesi Toko Berhasil Ditutup & Dipisahkan dengan CLOSE!");
    }
    
    return ContentService.createTextOutput("OK");
  } catch(error) {
    return ContentService.createTextOutput("Error: " + error.toString());
  }
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveWebhook = (url: string) => {
    setSheetsWebhookUrl(url);
    localStorage.setItem('kala_sheets_webhook_url', url);
  };

  const syncToGoogleSheets = async (reportData: {
    date: string;
    totalCashSales: number;
    totalQrisSales: number;
    totalExpenses: number;
    expectedCash: number;
    actualCash: number;
    difference: number;
  }) => {
    if (!sheetsWebhookUrl) return;
    setSyncStatus('syncing');
    try {
      const now = new Date();
      const exportDateTimeStr = `${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID').replace(/:/g, '.')}`;
      const monthYearStr = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();

      const payload = {
        action: 'close_register',
        date: reportData.date,
        exportDateTime: exportDateTimeStr,
        monthYear: monthYearStr,
        ordersCount: activeCompletedOrders.length || activeOrders.length,
        totalCashSales: reportData.totalCashSales,
        totalQrisSales: reportData.totalQrisSales,
        totalExpenses: reportData.totalExpenses,
        expectedCash: reportData.expectedCash,
        actualCash: reportData.actualCash,
        difference: reportData.difference,
        status: reportData.difference === 0 ? "BALANCE" : reportData.difference > 0 ? "SURPLUS" : "DEFISIT",
        expenses: activeExpenses.map(e => ({ name: e.name, amount: e.amount, date: new Date(e.createdAt).toLocaleDateString('id-ID') })),
        members: members
          .filter(m => (memberDebtMap[m.id] || 0) > 0)
          .map(m => {
            const debt = memberDebtMap[m.id] || 0;
            return {
              name: m.name,
              phone: m.phone,
              debt: debt,
              status: "ADA TAGIHAN"
            };
          })
      };

      await fetch(sheetsWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(payload)
      });
      
      setSyncStatus('success');
      setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      console.error("Sheets sync failed:", err);
      setSyncStatus('error');
    }
  };

  const handleTestKoneksi = async () => {
    if (!sheetsWebhookUrl) {
      alert('Masukkan URL Webhook Google Apps Script terlebih dahulu!');
      return;
    }
    setSyncStatus('syncing');
    try {
      await fetch(sheetsWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({ action: 'ping' })
      });
      setSyncStatus('success');
      setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
      alert('Tes koneksi dikirim! Silakan periksa tab "LOG_SINKRONISASI" di Google Sheets Anda.');
    } catch (err) {
      setSyncStatus('error');
      alert('Gagal menghubungi Google Apps Script Web App. Periksa URL Anda.');
    }
  };

  // Calculate current active session revenues
  // Active completed orders
  const activeCompletedOrders = useMemo(() => {
    return activeOrders.filter(o => o.orderStatus === 'Selesai');
  }, [activeOrders]);

  // Unpaid Pay Later orders in the current active session (must be settled before closing)
  const unpaidPayLaterOrders = useMemo(() => {
    return activeOrders.filter(
      o => o.paymentMethod === 'Bayar Nanti' && o.paymentStatus === 'Belum Bayar'
    );
  }, [activeOrders]);

  const isPayLaterBlocked = unpaidPayLaterOrders.length > 0;

  // Total Cash from active orders (includes orders paid in Cash or settled via Cash)
  const totalCashSales = useMemo(() => {
    return activeOrders
      .filter(o => o.paymentStatus === 'Lunas' && (o.paymentMethod === 'Cash' || o.settledVia === 'Cash'))
      .reduce((sum, o) => sum + o.total, 0);
  }, [activeOrders]);

  // Total QRIS from active orders (includes orders paid in QRIS or settled via QRIS)
  const totalQrisSales = useMemo(() => {
    return activeOrders
      .filter(o => o.paymentStatus === 'Lunas' && (o.paymentMethod === 'QRIS' || o.settledVia === 'QRIS'))
      .reduce((sum, o) => sum + o.total, 0);
  }, [activeOrders]);

  // Total Expenses
  const totalExpenses = useMemo(() => {
    return activeExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [activeExpenses]);

  // Expected cash in drawer = Total Cash Sales - Total Expenses
  // (Assuming starting cash modal is 0, or we can just say Cash Revenue minus Cash Expenses)
  const expectedCash = useMemo(() => {
    return Math.max(0, totalCashSales - totalExpenses);
  }, [totalCashSales, totalExpenses]);

  // Parsing actual cash inputted
  const actualCash = parseFloat(actualCashInput) || 0;

  // Difference
  const difference = actualCash - expectedCash;

  // Outstanding member bills
  const memberDebtMap = useMemo(() => {
    const debts: Record<string, number> = {};
    members.forEach(m => {
      const memberUnpaid = allOrders.filter(o => o.memberId === m.id && o.paymentStatus === 'Belum Bayar');
      debts[m.id] = memberUnpaid.reduce((sum, o) => sum + o.total, 0);
    });
    return debts;
  }, [members, allOrders]);

  // Helper to escape CSV values safely to prevent comma/quote cell break errors
  const escapeCSV = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Format price helper specifically for CSV cells: e.g. " Rp8,000 "
  const formatRupiahCsv = (val: number): string => {
    const formatted = Math.round(val).toLocaleString('en-US');
    return `" Rp${formatted} "`;
  };

  // Central Generator that matches USER SPECIFIED TEMPLATE SAMA PERSIS
  const generateWtmCsvContent = (
    exportDateTimeStr: string,
    sessionsCount: number,
    orders: Order[],
    expensesList: Expense[],
    cashSales: number,
    qrisSales: number,
    expensesTotal: number,
    actualCashContainer: number
  ): string => {
    let csvContent = "";

    // 1. TITLE BLOCK
    csvContent += "LAPORAN - WARKOP TENGAH MALAM,,,,,,,,\r\n";
    csvContent += `Tanggal Ekspor:,${escapeCSV(exportDateTimeStr)},,,,,,,` + "\r\n";
    csvContent += `Total Sesi Terbuku:,${sessionsCount} Sesi Penutupan,,,,,,,` + "\r\n";
    csvContent += `Total Transaksi:,${orders.length} Pesanan,,,,,,,` + "\r\n";
    csvContent += ",,,,,,,,\r\n";

    // 2. FINANCIAL SUMMARY BLOCK
    csvContent += "RINGKASAN LAPORAN KEUANGAN HARIAN,,,,,,,,\r\n";
    csvContent += `Total Cash:,:,${formatRupiahCsv(cashSales)},,,,,,` + "\r\n";
    csvContent += `Total QRIS ,:,${formatRupiahCsv(qrisSales)},,,,,,` + "\r\n";
    csvContent += `Total Pengeluaran,:,${formatRupiahCsv(expensesTotal)},,,,,,` + "\r\n";
    csvContent += `Uang Di Wadah,:,${formatRupiahCsv(actualCashContainer)},,,,,,` + "\r\n";
    csvContent += ",,,,,,,,\r\n";

    // 3. EXPENSES BLOCK
    csvContent += "DAFTAR PENGELUARAN,,,,,,,,\r\n";
    csvContent += "No,Nama Barang,Total Harga,,,,,,\r\n";
    if (expensesList.length > 0) {
      expensesList.forEach((e, idx) => {
        csvContent += `${idx + 1},${escapeCSV(e.name)},${e.amount},,,,,,\r\n`;
      });
    }
    csvContent += ",,,,,,,,\r\n";
    csvContent += ",,,,,,,,\r\n";

    // 4. MEMBER DEBTS BLOCK
    csvContent += "TAGIHAN MEMBER,,,,,,,,\r\n";
    csvContent += "No,Nama Member,Nomer HP,Total Tagihan,Status Tagihan,,,,\r\n";
    const activeDebtorMembers = members.filter(m => (memberDebtMap[m.id] || 0) > 0);
    if (activeDebtorMembers.length > 0) {
      activeDebtorMembers.forEach((m, idx) => {
        const debt = memberDebtMap[m.id] || 0;
        csvContent += `${idx + 1},${escapeCSV(m.name)},${escapeCSV(m.phone)},${debt},ADA OUTSTANDING,,,,\r\n`;
      });
    }
    csvContent += ",,,,,,,,\r\n";

    // 5. TRANSACTIONS BLOCK
    csvContent += "RIWAYAT TRANSAKSI / PESANAN PELANGGAN,,,,,,,,\r\n";
    csvContent += "No,Nama Pembeli,Tipe,Daftar Pesanan,Metode Pembayaran,Status Pembayaran,Total Penjualan,,\r\n";
    if (orders.length > 0) {
      orders.forEach((order, idx) => {
        const customerType = order.isMember ? "MEMBER" : "REGULER";
        const itemsSummary = order.items
          .map(item => `${item.quantity}x ${item.menuItem.name}`)
          .join('; ');

        const payMethodLabel = order.paymentMethod;
        const payStatusLabel = order.paymentStatus;

        csvContent += `${idx + 1},${escapeCSV(order.buyerName)},${customerType},${escapeCSV(itemsSummary)},${escapeCSV(payMethodLabel)},${escapeCSV(payStatusLabel)},${order.total},,\r\n`;
      });
    }
    csvContent += ",,,,,,,,\r\n";
    csvContent += "CLOSED,,,,,,,,\r\n";

    return csvContent;
  };

  // CSV Generator for a single specific close report (per session/date)
  const downloadSingleReportCSV = (
    report: CloseReport,
    providedOrders?: Order[],
    providedExpenses?: Expense[]
  ) => {
    // Target orders for this report
    const targetOrders = providedOrders || allOrders.filter(o => 
      o.closeReportId === report.id ||
      (o.isClosedInSession && new Date(o.createdAt).toLocaleDateString('id-ID') === report.date)
    );

    // Target expenses for this report
    const expensesPool = (allExpenses && allExpenses.length > 0) ? allExpenses : activeExpenses;
    const targetExpenses = providedExpenses || expensesPool.filter(e =>
      e.closeReportId === report.id ||
      (e.isClosedInSession && new Date(e.createdAt).toLocaleDateString('id-ID') === report.date)
    );

    const exportTime = report.closedAt 
      ? `${new Date(report.closedAt).toLocaleDateString('id-ID')} ${new Date(report.closedAt).toLocaleTimeString('id-ID')}`
      : `${report.date} 00.00.00`;

    const csvContent = generateWtmCsvContent(
      exportTime,
      closeReports.length || 1,
      targetOrders,
      targetExpenses,
      report.totalCashSales,
      report.totalQrisSales,
      report.totalExpenses,
      report.actualCash
    );

    // Creating Blob with UTF-8 BOM
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const formattedDateStr = report.date ? report.date.replace(/[\/\\]/g, '-') : new Date().toISOString().substring(0, 10);
    link.setAttribute("download", `wtm_${formattedDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClose = (e: React.FormEvent) => {
    e.preventDefault();

    // Critical block: cannot close register if there are unpaid 'Bayar Nanti' transactions
    if (unpaidPayLaterOrders.length > 0) {
      alert(
        `⛔ TIDAK BISA TUTUP KASIR (CLOSE REGISTER)!\n\n` +
        `Terdapat ${unpaidPayLaterOrders.length} pesanan dengan metode "Bayar Nanti" yang BELUM LUNAS.\n\n` +
        `Metode Bayar Nanti wajib diselesaikan pembayarannya hari ini sebelum kasir dapat ditutup. Harap lunasi pesanan tersebut terlebih dahulu.`
      );
      return;
    }

    if (actualCashInput === '') {
      alert('Masukkan jumlah uang di wadah terlebih dahulu!');
      return;
    }

    const todayDateStr = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const newReportId = `rep-${Date.now()}`;

    const reportData = {
      date: todayDateStr,
      totalCashSales,
      totalQrisSales,
      totalExpenses,
      expectedCash,
      actualCash,
      difference,
    };

    const singleReport: CloseReport = {
      id: newReportId,
      ...reportData,
      closedAt: new Date().toISOString()
    };

    // 1. Auto download CSV for this closing shift!
    downloadSingleReportCSV(singleReport, activeOrders, activeExpenses);

    // 2. Pass to parent to archive session in state & localStorage
    onCloseRegister(actualCash, reportData, newReportId);

    // Sync to Google Sheets if configured
    if (sheetsWebhookUrl) {
      syncToGoogleSheets(reportData);
    }

    setActualCashInput('');
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  // Settlement modal calculations for Bayar Nanti
  const settleTotal = settlingOrder?.total || 0;
  const parsedCashReceived = parseFloat(cashReceived) || 0;
  const changeDue = Math.max(0, parsedCashReceived - settleTotal);
  const isSettleValid = useMemo(() => {
    if (!settlingOrder) return false;
    if (settleMethod === 'Cash') {
      return parsedCashReceived >= settleTotal;
    }
    if (settleMethod === 'QRIS') {
      return qrisConfirmed;
    }
    return false;
  }, [settlingOrder, settleMethod, parsedCashReceived, settleTotal, qrisConfirmed]);

  const handleConfirmSettle = () => {
    if (!settlingOrder || !isSettleValid || !onSettleOrder) return;

    onSettleOrder(
      settlingOrder.id,
      settleMethod,
      settleMethod === 'Cash' ? parsedCashReceived : 0,
      settleMethod === 'Cash' ? changeDue : 0
    );

    // Reset state & close modal
    setSettlingOrder(null);
    setCashReceived('');
    setQrisConfirmed(false);
    setSettleMethod('Cash');
  };

  const openSettleModal = (order: Order) => {
    setSettlingOrder(order);
    setSettleMethod('Cash');
    setCashReceived(order.total.toString());
    setQrisConfirmed(false);
  };

  const handleSyncMenuToSheets = async () => {
    if (!googleUser && !sheetsWebhookUrl) {
      alert('Silakan login dengan akun Google atau masukkan URL Webhook terlebih dahulu!');
      return;
    }
    setMenuSyncStatus('syncing');
    try {
      await dispatchSyncMenu(menuItems);
      setMenuSyncStatus('success');
      setTimeout(() => setMenuSyncStatus('idle'), 3000);
      alert('Daftar menu berhasil dikirim dan diperbarui ke tab DAFTAR_MENU di Google Sheets!');
    } catch {
      setMenuSyncStatus('error');
      alert('Gagal mengirim daftar menu ke Google Sheets.');
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen pb-28 text-white bg-zinc-950">
      {!isClosed ? (
        <div className="flex flex-col space-y-4">
          <h2 className="text-lg font-display font-bold tracking-wider uppercase border-b border-zinc-850 pb-3">Close Register (Tutup Toko)</h2>

          {/* Critical Blocking Banner for Bayar Nanti */}
          {isPayLaterBlocked && (
            <div className="bg-red-950/30 border-2 border-red-800/80 rounded-2xl p-4 shadow-lg space-y-3 animate-fade-in">
              <div className="flex items-start space-x-2.5">
                <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5 animate-bounce" />
                <div>
                  <h3 className="font-mono text-xs font-bold text-red-300 uppercase tracking-wide">
                    Tutup Kasir Diblokir ({unpaidPayLaterOrders.length} Bayar Nanti Belum Lunas)
                  </h3>
                  <p className="text-[11px] text-red-200/90 font-sans mt-1 leading-relaxed">
                    Sistem <strong>Bayar Nanti</strong> tidak bisa dibawa ke hari berikutnya. Anda wajib melunasi semua pesanan berikut sebelum dapat melakukan <em>Close Register</em>:
                  </p>
                </div>
              </div>

              {/* Unpaid orders list */}
              <div className="space-y-2 pt-1">
                {unpaidPayLaterOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-black/60 border border-red-900/50 rounded-xl p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5 font-mono text-[10px] text-zinc-400">
                        <span>{order.invoice}</span>
                        <span>•</span>
                        <span className="text-white font-bold">{order.buyerName}</span>
                      </div>
                      <div className="font-mono text-xs font-bold text-amber-400 mt-0.5">
                        {formatPrice(order.total)}
                      </div>
                    </div>

                    {onSettleOrder && (
                      <button
                        type="button"
                        onClick={() => openSettleModal(order)}
                        className="bg-amber-400 hover:bg-amber-300 text-black font-display font-bold uppercase tracking-wider text-[10px] px-3 py-1.5 rounded-lg flex items-center transition cursor-pointer shadow-sm active:scale-95"
                      >
                        <DollarSign size={11} className="mr-0.5" />
                        Lunasi
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Session Stats */}
          <div className="bg-zinc-900 text-white p-5 rounded-2xl border border-zinc-850 shadow-md space-y-4">
            <div className="flex items-center space-x-2 border-b border-zinc-850 pb-3">
              <Unlock size={14} className="text-emerald-400 animate-pulse" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">Statistik Sesi Aktif</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center text-zinc-500 text-[9px] uppercase font-mono tracking-wider space-x-1.5">
                  <DollarSign size={10} />
                  <span>Total Cash Sales</span>
                </div>
                <span className="font-mono text-xs font-bold block text-zinc-200">{formatPrice(totalCashSales)}</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center text-zinc-500 text-[9px] uppercase font-mono tracking-wider space-x-1.5">
                  <CreditCard size={10} />
                  <span>Total QRIS Sales</span>
                </div>
                <span className="font-mono text-xs font-bold block text-zinc-200">{formatPrice(totalQrisSales)}</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center text-zinc-500 text-[9px] uppercase font-mono tracking-wider space-x-1.5">
                  <ShoppingBag size={10} />
                  <span>Total Pengeluaran</span>
                </div>
                <span className="font-mono text-xs font-bold text-red-400 block">{formatPrice(totalExpenses)}</span>
              </div>

              <div className="space-y-1 border-t border-zinc-850 pt-3 col-span-2">
                <span className="text-zinc-500 text-[9px] uppercase font-mono tracking-wider block">Uang Tunai Seharusnya di Laci</span>
                <span className="font-mono text-base font-black text-emerald-400">{formatPrice(expectedCash)}</span>
                <p className="text-[9px] text-zinc-500 font-sans leading-tight mt-1">Rumus: (Total Cash) - (Pengeluaran)</p>
              </div>
            </div>
          </div>

          {/* Verification Form */}
          <form onSubmit={handleClose} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-850 shadow-sm space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="cash-count" className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">Uang Riil di Wadah / Laci (IDR)</label>
              <div className="relative">
                <span className="absolute left-3 top-3 font-mono text-sm text-zinc-500 font-bold">Rp</span>
                <input
                  id="cash-count"
                  type="number"
                  placeholder="Masukkan jumlah fisik uang..."
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  className="w-full bg-black border border-zinc-800 pl-10 pr-3.5 py-2.5 rounded-xl font-mono text-sm focus:outline-none focus:border-zinc-500 text-white"
                  required
                />
              </div>
            </div>

            {/* Difference breakdown if entered */}
            {actualCashInput !== '' && (
              <div className="border-t border-zinc-850 pt-3.5 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Uang Seharusnya</span>
                  <span>{formatPrice(expectedCash)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Uang Aktual</span>
                  <span>{formatPrice(actualCash)}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-850 pt-2.5 font-bold">
                  <span>Selisih</span>
                  <span className={difference === 0 ? 'text-emerald-400' : difference > 0 ? 'text-blue-400' : 'text-red-400'}>
                    {difference === 0 ? 'SESUAI (BALANCE)' : difference > 0 ? `LEBIH (+${formatPrice(difference)})` : `KURANG (-${formatPrice(Math.abs(difference))})`}
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isPayLaterBlocked}
              className={`w-full font-display font-bold uppercase tracking-wider py-3.5 rounded-xl transition flex items-center justify-center text-xs ${
                isPayLaterBlocked
                  ? 'bg-zinc-900 text-zinc-600 border border-zinc-850 cursor-not-allowed opacity-60'
                  : 'bg-white hover:bg-zinc-100 text-black cursor-pointer shadow-md active:scale-95'
              }`}
            >
              <Lock size={14} className={`mr-1.5 ${isPayLaterBlocked ? '' : 'animate-pulse'}`} />
              {isPayLaterBlocked ? 'Tutup Kasir Dinonaktifkan (Selesaikan Bayar Nanti)' : 'Close Register & Simpan Laporan'}
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col space-y-5">
          {/* Shop Locked screen */}
          <div className="bg-zinc-900 text-white p-6 rounded-3xl border border-zinc-850 shadow-xl text-center flex flex-col items-center py-10">
            <div className="bg-white text-black p-4.5 rounded-full mb-4.5 shadow-md">
              <Lock size={32} />
            </div>
            <h2 className="text-lg font-display font-bold uppercase tracking-wider mb-2 text-white">REGISTER DIKUNCI</h2>
            <p className="text-xs text-zinc-400 max-w-xs mb-6 font-sans leading-relaxed">
              Sesi kasir hari ini telah resmi ditutup. Semua transaksi dan laporan harian telah dibukukan.
            </p>
            {closeReports.length > 0 && (
              <button
                type="button"
                onClick={() => downloadSingleReportCSV(closeReports[0])}
                className="w-full mb-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-mono text-xs font-bold uppercase py-3 rounded-xl transition flex items-center justify-center space-x-2 border border-zinc-700 cursor-pointer active:scale-95 shadow-sm"
              >
                <Download size={14} className="text-emerald-400" />
                <span>Unduh CSV Penutupan Terakhir</span>
              </button>
            )}
            <button
              onClick={onReopenRegister}
              className="w-full bg-white hover:bg-zinc-100 text-black font-display font-bold uppercase tracking-wider py-3.5 rounded-xl transition flex items-center justify-center cursor-pointer active:scale-95 text-xs shadow-md"
            >
              <Unlock size={13} className="mr-1.5" />
              Buka Sesi Kasir Baru (Data Fresh)
            </button>
          </div>
        </div>
      )}

      {/* Google Sheets Integration Section */}
      <div className="bg-zinc-900 border border-emerald-950/45 rounded-3xl p-5 mt-5 space-y-4 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
        
        <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="bg-emerald-950/50 p-2 rounded-xl text-emerald-400 border border-emerald-900/40">
              <FileSpreadsheet size={16} />
            </div>
            <div>
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-zinc-100">Live Google Sheets (Otomatis)</h3>
              <p className="text-[9px] text-zinc-400 font-sans">Tanpa Ekstensi &bull; Sinkronisasi Real-time</p>
            </div>
          </div>
          
          {googleUser && (
            <button
              type="button"
              onClick={handleGoogleLogout}
              className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg text-[9px] font-mono flex items-center transition cursor-pointer"
              title="Putuskan Akun Google"
            >
              <LogOut size={12} className="mr-1" /> Keluar
            </button>
          )}
        </div>

        {/* 1. Direct Google Account Connection (Zero-Extension Setup) */}
        {!googleUser ? (
          <div className="bg-black/40 border border-zinc-800 p-4 rounded-2xl space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-display font-bold text-white uppercase tracking-wide block">
                Hubungkan Akun Google Anda
              </span>
              <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
                Hubungkan satu klik untuk membuat file spreadsheet live di Google Drive Anda secara otomatis. Setiap pesanan dan tutup kasir akan langsung tercatat tanpa perlu konfigurasi script atau ekstensi.
              </p>
            </div>

            {/* Official Sign in with Google Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="w-full bg-white hover:bg-zinc-100 text-zinc-800 font-sans font-semibold text-xs py-3 px-4 rounded-xl flex items-center justify-center space-x-3 transition active:scale-95 shadow-md cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
              <span>{isLoggingIn ? 'Menghubungkan Akun...' : 'Sign in with Google'}</span>
            </button>
          </div>
        ) : (
          <div className="bg-black/50 border border-emerald-900/40 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                {googleUser.photoURL ? (
                  <img
                    src={googleUser.photoURL}
                    alt={googleUser.displayName || 'User'}
                    className="w-8 h-8 rounded-full border border-emerald-500/50"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-950 text-emerald-400 font-bold flex items-center justify-center text-xs">
                    {(googleUser.displayName || 'U')[0]}
                  </div>
                )}
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] font-bold text-white">{googleUser.displayName || 'Akun Terhubung'}</span>
                    <CheckCircle2 size={11} className="text-emerald-400" />
                  </div>
                  <span className="text-[9px] text-zinc-400 font-mono block truncate max-w-[180px]">{googleUser.email}</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded-md text-[9px] font-mono uppercase font-bold">
                LIVE AKTIF
              </span>
            </div>

            {/* Direct Spreadsheet Link & Actions */}
            <div className="pt-1 flex flex-col space-y-2">
              <button
                type="button"
                onClick={handleOpenOrCreateSpreadsheet}
                disabled={isCreatingSheet}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-display font-bold text-xs uppercase tracking-wider transition flex items-center justify-center space-x-2 cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
              >
                <ExternalLink size={13} />
                <span>{isCreatingSheet ? 'Menyiapkan Spreadsheet...' : 'Buka Live Google Spreadsheet'}</span>
              </button>

              <button
                type="button"
                onClick={handleSyncMenuToSheets}
                disabled={menuSyncStatus === 'syncing'}
                className="w-full py-2 px-3 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-200 font-mono text-[10px] font-bold uppercase transition flex items-center justify-center space-x-2 border border-zinc-700 cursor-pointer"
              >
                <UtensilsCrossed size={11} className={menuSyncStatus === 'syncing' ? 'animate-spin' : 'text-emerald-400'} />
                <span>
                  {menuSyncStatus === 'syncing'
                    ? 'Menyinkronkan Menu...'
                    : menuSyncStatus === 'success'
                    ? 'Menu Berhasil Disinkronkan!'
                    : 'Sinkronkan Daftar Menu Sekarang'}
                </span>
              </button>
            </div>
            
            <p className="text-[9px] text-zinc-400 font-sans leading-normal pt-1">
              ✨ Setiap ada pesanan masuk, pelunasan hutang, pengeluaran, atau penutupan sesi <strong>CLOSE</strong> akan otomatis langsung tercatat ke tab bulan terkait di file Google Spreadsheet Anda.
            </p>
          </div>
        )}

        {/* 2. Opsi Tambahan: Webhook Manual (Opsional) */}
        <div className="border-t border-zinc-850/80 pt-3">
          <button
            type="button"
            onClick={() => setShowTutorial(!showTutorial)}
            className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 flex items-center justify-between w-full uppercase transition cursor-pointer"
          >
            <span>Opsi Tambahan: Webhook Apps Script (Opsional)</span>
            <span>{showTutorial ? '▲ Sembunyikan' : '▼ Tampilkan'}</span>
          </button>
        </div>

        {/* Webhook and Tutorial Section if expanded */}
        {showTutorial && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
                Google Apps Script Web App URL (Webhook)
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={sheetsWebhookUrl}
                  onChange={(e) => handleSaveWebhook(e.target.value)}
                  className="flex-1 bg-black border border-zinc-800 focus:border-emerald-700/80 px-3 py-2 rounded-xl font-mono text-[10px] text-zinc-200 placeholder-zinc-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleTestKoneksi}
                  disabled={!sheetsWebhookUrl}
                  className={`px-3 py-2 rounded-xl font-mono text-[10px] font-bold uppercase transition cursor-pointer flex items-center space-x-1 border ${
                    sheetsWebhookUrl
                      ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
                      : 'bg-zinc-950 border-zinc-900 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw size={10} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                  <span>Test</span>
                </button>
              </div>
            </div>

            {/* Script Code Block */}
            <div className="relative">
              <div className="absolute top-2 right-2 flex space-x-2">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 p-1.5 rounded-lg text-[9px] font-mono flex items-center space-x-1 transition cursor-pointer border border-zinc-700"
                >
                  {copied ? (
                    <>
                      <Check size={10} className="text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={10} />
                      <span>Salin Kode</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-black/90 text-emerald-400 p-3 rounded-xl border border-zinc-800 font-mono text-[8px] max-h-40 overflow-y-auto leading-normal">
                {appsScriptCode}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone: Reset All Data */}
      {onResetAllData && (
        <div className="bg-zinc-950 border border-red-950/40 rounded-3xl p-5 mt-5 space-y-4 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          
          <div className="flex items-center space-x-2.5 border-b border-zinc-900 pb-3">
            <div className="bg-red-950/50 p-2 rounded-xl text-red-400 border border-red-900/40 animate-pulse">
              <Trash2 size={16} />
            </div>
            <div>
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-red-400">Zona Bahaya (Danger Zone)</h3>
              <p className="text-[9px] text-zinc-500 font-sans">Kelola Penghapusan Data Sistem</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
              Fitur ini akan menghapus secara permanen beberapa rekaman data transaksi, meliputi:
            </p>
            <ul className="list-disc list-inside text-[9px] text-zinc-500 font-mono space-y-1 pl-1">
              <li>Semua Daftar Pengeluaran Sesi Aktif</li>
              <li>Semua Riwayat Pesanan &amp; Laporan Shift</li>
              <li className="text-zinc-500">⚠️ Daftar Menu Makanan &amp; Minuman (<span className="text-zinc-600 font-sans font-bold">TIDAK DIHAPUS</span>)</li>
              <li className="text-zinc-500">⚠️ Akun Member &amp; Saldo Piutang (<span className="text-zinc-600 font-sans font-bold">TIDAK DIHAPUS</span>)</li>
            </ul>
            <p className="text-[9px] text-amber-500/90 leading-relaxed font-sans bg-amber-950/20 border border-amber-900/30 p-2 rounded-xl">
              ⚠️ <strong>Perhatian:</strong> Tindakan ini tidak dapat dibatalkan. Struktur menu dan data akun member Anda akan tetap utuh, hanya data rekaman transaksi kasir, laporan penutupan harian, dan pengeluaran saja yang dikosongkan.
            </p>

            <button
              type="button"
              onClick={() => {
                const confirmed = confirm(
                  "Apakah Anda YAKIN ingin mereset seluruh data transaksi (Pesanan, Pengeluaran, dan Riwayat Laporan)?\n\nTindakan ini akan menghapusnya secara permanen, namun tetap MEMPERTAHANKAN Daftar Menu dan Akun Member Anda!"
                );
                if (confirmed) {
                  const finalConfirmed = confirm(
                    "KONFIRMASI TERAKHIR:\n\nApakah Anda benar-benar yakin ingin membersihkan data transaksi WARKOP TENGAH MALAM?"
                  );
                  if (finalConfirmed) {
                    onResetAllData();
                    alert("Data transaksi berhasil dibersihkan! Daftar Menu dan Akun Member tetap aman.");
                  }
                }
              }}
              className="w-full bg-red-950/20 hover:bg-red-900/30 border border-red-900/40 text-red-400 font-mono text-[10px] font-bold uppercase py-3 rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
            >
              <Trash2 size={13} />
              <span>Reset &amp; Hapus Data Transaksi</span>
            </button>
          </div>
        </div>
      )}

      {/* Settlement Modal for Bayar Nanti inside CloseTab */}
      {settlingOrder && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all animate-fade-in overflow-y-auto">
          <div className="bg-zinc-900 rounded-3xl w-full max-w-md p-5 shadow-2xl border border-zinc-800 flex flex-col space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div>
                <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider block">Pelunasan Bayar Nanti</span>
                <h3 className="font-display font-bold text-sm text-white">{settlingOrder.buyerName} ({settlingOrder.invoice})</h3>
              </div>
              <button
                type="button"
                onClick={() => setSettlingOrder(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Total tagihan */}
            <div className="bg-black/50 p-3.5 rounded-2xl border border-zinc-800 flex justify-between items-center">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Total Tagihan</span>
              <span className="font-mono text-base font-bold text-white">{formatPrice(settleTotal)}</span>
            </div>

            {/* Method switcher */}
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setSettleMethod('Cash')}
                className={`py-2.5 rounded-xl border flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                  settleMethod === 'Cash'
                    ? 'bg-white text-black border-white font-bold shadow-sm'
                    : 'bg-black text-zinc-400 border-zinc-800 hover:bg-zinc-850'
                }`}
              >
                <DollarSign size={13} />
                <span>CASH</span>
              </button>
              <button
                type="button"
                onClick={() => setSettleMethod('QRIS')}
                className={`py-2.5 rounded-xl border flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                  settleMethod === 'QRIS'
                    ? 'bg-white text-black border-white font-bold shadow-sm'
                    : 'bg-black text-zinc-400 border-zinc-800 hover:bg-zinc-850'
                }`}
              >
                <CreditCard size={13} />
                <span>QRIS</span>
              </button>
            </div>

            {/* Method Inputs */}
            {settleMethod === 'Cash' ? (
              <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-zinc-800">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Uang Diterima</label>
                    <div className="flex space-x-1">
                      {[10000, 20000, 50000, 100000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCashReceived(val.toString())}
                          className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer"
                        >
                          {val / 1000}k
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCashReceived(settleTotal.toString())}
                        className="bg-zinc-800 border border-zinc-700 text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer"
                      >
                        Pas
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-mono text-sm text-zinc-500 font-bold">Rp</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full bg-black border border-zinc-800 pl-9 pr-3 py-2 rounded-xl font-mono text-sm focus:outline-none focus:border-zinc-500 text-white"
                      autoFocus
                    />
                  </div>
                </div>

                {parsedCashReceived > 0 && (
                  <div className="flex justify-between items-center border-t border-zinc-800 pt-2 font-mono text-xs">
                    <span className="text-zinc-400 uppercase tracking-wider">Kembalian</span>
                    <span className={`text-sm font-bold ${parsedCashReceived >= settleTotal ? 'text-emerald-400' : 'text-red-400'}`}>
                      {parsedCashReceived < settleTotal ? 'Kurang Pembayaran' : formatPrice(changeDue)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-black/40 p-4 rounded-2xl border border-zinc-800 space-y-3 text-center">
                <QrisPoster amount={settleTotal} size={150} />
                <button
                  type="button"
                  onClick={() => setQrisConfirmed(!qrisConfirmed)}
                  className={`w-full py-2.5 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer border ${
                    qrisConfirmed
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400'
                      : 'bg-white hover:bg-zinc-100 text-black border-white'
                  }`}
                >
                  <Check size={13} strokeWidth={2.5} />
                  <span>{qrisConfirmed ? 'Terkonfirmasi Lunas' : 'Konfirmasi Scan QRIS'}</span>
                </button>
              </div>
            )}

            {/* Confirm Settle Button */}
            <button
              type="button"
              onClick={handleConfirmSettle}
              disabled={!isSettleValid}
              className={`w-full py-3.5 rounded-xl font-mono font-bold uppercase tracking-wider text-xs transition flex items-center justify-center space-x-1.5 ${
                isSettleValid
                  ? 'bg-white hover:bg-zinc-100 text-black cursor-pointer active:scale-95 shadow-md'
                  : 'bg-zinc-800 text-zinc-600 border border-zinc-850 cursor-not-allowed'
              }`}
            >
              <Check size={14} strokeWidth={2.5} />
              <span>Simpan &amp; Tandai Lunas</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
