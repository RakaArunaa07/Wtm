/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MenuItem, Order, Member, Expense, CloseReport } from './types';
import { INITIAL_MENU_ITEMS, INITIAL_MEMBERS } from './data';
import Header from './components/Header';
import KasirTab from './components/KasirTab';
import PesananTab from './components/PesananTab';
import PengeluaranTab from './components/PengeluaranTab';
import MemberTab from './components/MemberTab';
import MenuTab from './components/MenuTab';
import CloseTab from './components/CloseTab';
import { ShoppingBag, Clock, DollarSign, Users, Menu as MenuIcon, Archive } from 'lucide-react';
import { dispatchLiveOrder, dispatchOrderSettlement, dispatchLiveExpense, dispatchCloseRegister } from './services/sheetsSync';

export default function App() {
  // 1. Core State Initialization with LocalStorage Persistence
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem('kala_menu_items');
    return saved ? JSON.parse(saved) : INITIAL_MENU_ITEMS;
  });

  const [members, setMembers] = useState<Member[]>(() => {
    const saved = localStorage.getItem('kala_members');
    return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('kala_orders');
    return saved ? JSON.parse(saved) : [];
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('kala_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  const [closeReports, setCloseReports] = useState<CloseReport[]>(() => {
    const saved = localStorage.getItem('kala_close_reports');
    return saved ? JSON.parse(saved) : [];
  });

  const [isClosed, setIsClosed] = useState<boolean>(() => {
    const saved = localStorage.getItem('kala_is_closed');
    return saved === 'true';
  });

  const [activeTab, setActiveTab] = useState<'kasir' | 'pesanan' | 'pengeluaran' | 'member' | 'menu' | 'close'>('kasir');

  // One-time automatic cleanup of old pre-filled mock data so the app starts 100% empty
  useEffect(() => {
    const isCleaned = localStorage.getItem('kala_data_force_reset_complete_v1');
    if (!isCleaned) {
      localStorage.removeItem('kala_menu_items');
      localStorage.removeItem('kala_members');
      localStorage.removeItem('kala_orders');
      localStorage.removeItem('kala_expenses');
      localStorage.removeItem('kala_close_reports');
      localStorage.setItem('kala_is_closed', 'false');
      localStorage.setItem('kala_data_force_reset_complete_v1', 'true');
      
      setMenuItems([]);
      setMembers([]);
      setOrders([]);
      setExpenses([]);
      setCloseReports([]);
      setIsClosed(false);
    }
  }, []);

  // 2. Synchronize States with LocalStorage upon any change
  useEffect(() => {
    localStorage.setItem('kala_menu_items', JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem('kala_members', JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem('kala_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('kala_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('kala_close_reports', JSON.stringify(closeReports));
  }, [closeReports]);

  useEffect(() => {
    localStorage.setItem('kala_is_closed', isClosed.toString());
  }, [isClosed]);

  // 3. App Core Event Handlers
  // A. KASIR
  const handleAddOrder = (newOrder: Order) => {
    setOrders(prev => [newOrder, ...prev]);
    // Dispatch real-time live order to Google Sheets
    dispatchLiveOrder(newOrder);
  };

  // B. PESANAN
  const handleCompleteOrder = (orderId: string) => {
    setOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, orderStatus: 'Selesai' } : order
      )
    );
  };

  // C. PENGELUARAN
  const handleAddExpense = (newExpense: Expense) => {
    setExpenses(prev => [newExpense, ...prev]);
    // Dispatch real-time expense to Google Sheets
    dispatchLiveExpense(newExpense);
  };

  const handleDeleteExpense = (expenseId: string) => {
    setExpenses(prev => prev.filter(e => e.id !== expenseId));
  };

  // D. MEMBER & PAY LATER SETTLEMENT
  const handleAddMember = (newMember: Member) => {
    setMembers(prev => [newMember, ...prev]);
  };

  const handlePayBill = (
    orderId: string,
    paymentMethod: 'Cash' | 'QRIS',
    cashPaid: number,
    cashChange: number
  ) => {
    const target = orders.find(o => o.id === orderId);
    if (target) {
      dispatchOrderSettlement(target, paymentMethod, cashPaid, cashChange);
    }
    setOrders(prev =>
      prev.map(order =>
        order.id === orderId
          ? {
              ...order,
              paymentMethod,
              paymentStatus: 'Lunas',
              cashPaid,
              cashChange,
            }
          : order
      )
    );
  };

  const handleSettlePayLaterOrder = (
    orderId: string,
    paymentMethod: 'Cash' | 'QRIS',
    cashPaid: number,
    cashChange: number
  ) => {
    const target = orders.find(o => o.id === orderId);
    if (target) {
      dispatchOrderSettlement(target, paymentMethod, cashPaid, cashChange);
    }
    setOrders(prev =>
      prev.map(order =>
        order.id === orderId
          ? {
              ...order,
              paymentStatus: 'Lunas',
              settledVia: paymentMethod,
              cashPaid: paymentMethod === 'Cash' ? cashPaid : 0,
              cashChange: paymentMethod === 'Cash' ? cashChange : 0,
            }
          : order
      )
    );
  };

  const handleDeleteMember = (memberId: string) => {
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  // E. DAFTAR MENU
  const handleAddMenuItem = (newItem: MenuItem) => {
    setMenuItems(prev => [...prev, newItem]);
  };

  const handleUpdatePrice = (itemId: string, newPrice: number) => {
    setMenuItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, price: newPrice } : item
      )
    );
  };

  const handleDeleteMenuItem = (itemId: string) => {
    setMenuItems(prev => prev.filter(item => item.id !== itemId));
  };

  // F. CLOSE
  // Filter active session entries (orders & expenses which haven't been archived yet via CLOSE)
  const activeOrders = orders.filter(o => !o.isClosedInSession);
  const activeExpenses = expenses.filter(e => !e.isClosedInSession);

  const handleCloseRegister = (
    actualCash: number,
    reportStats: Omit<CloseReport, 'id' | 'closedAt'>,
    customReportId?: string
  ) => {
    const reportId = customReportId || `rep-${Date.now()}`;
    // Generate new CloseReport
    const newReport: CloseReport = {
      id: reportId,
      ...reportStats,
      closedAt: new Date().toISOString(),
    };

    setCloseReports(prev => [newReport, ...prev]);
    setIsClosed(true);

    // Member debt map calculation for closing sync
    const memberDebts: Record<string, number> = {};
    members.forEach(m => {
      const memberUnpaid = orders.filter(o => o.memberId === m.id && o.paymentStatus === 'Belum Bayar');
      memberDebts[m.id] = memberUnpaid.reduce((sum, o) => sum + o.total, 0);
    });

    // Auto dispatch closing event to Google Sheets
    dispatchCloseRegister(reportStats, activeOrders, activeExpenses, members, memberDebts);

    // Archive all current session orders & expenses by setting isClosedInSession to true
    // and linking them to this specific closeReportId
    setOrders(prev =>
      prev.map(o => (!o.isClosedInSession ? { ...o, isClosedInSession: true, closeReportId: reportId } : o))
    );
    setExpenses(prev =>
      prev.map(e => (!e.isClosedInSession ? { ...e, isClosedInSession: true, closeReportId: reportId } : e))
    );
  };

  const handleReopenRegister = () => {
    setIsClosed(false);
    setActiveTab('kasir');
  };

  const handleResetAllData = () => {
    setOrders([]);
    setExpenses([]);
    setCloseReports([]);
    setIsClosed(false);
    setActiveTab('kasir');
  };

  return (
    <div className="min-h-screen bg-black flex justify-center items-start overflow-y-auto font-sans selection:bg-white selection:text-black">
      {/* Phone Mockup Frame */}
      <div className="w-full max-w-md min-h-screen bg-zinc-950 text-white flex flex-col relative shadow-2xl border-x border-zinc-900">
        
        {/* Logo Header */}
        <Header isClosed={isClosed} onReopen={handleReopenRegister} />

        {/* Scrollable Tab Content Wrapper */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'kasir' && (
            <KasirTab
              menuItems={menuItems}
              members={members}
              onAddOrder={handleAddOrder}
              isClosed={isClosed}
              onNavigateToOrders={() => setActiveTab('pesanan')}
            />
          )}

          {activeTab === 'pesanan' && (
            <PesananTab
              orders={activeOrders}
              onCompleteOrder={handleCompleteOrder}
              onSettleOrder={handleSettlePayLaterOrder}
            />
          )}

          {activeTab === 'pengeluaran' && (
            <PengeluaranTab
              expenses={activeExpenses}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              isClosed={isClosed}
            />
          )}

          {activeTab === 'member' && (
            <MemberTab
              members={members}
              orders={orders}
              onAddMember={handleAddMember}
              onPayBill={handlePayBill}
              onDeleteMember={handleDeleteMember}
            />
          )}

          {activeTab === 'menu' && (
            <MenuTab
              menuItems={menuItems}
              onAddMenuItem={handleAddMenuItem}
              onUpdatePrice={handleUpdatePrice}
              onDeleteMenuItem={handleDeleteMenuItem}
            />
          )}

          {activeTab === 'close' && (
            <CloseTab
              isClosed={isClosed}
              activeOrders={activeOrders}
              activeExpenses={activeExpenses}
              closeReports={closeReports}
              members={members}
              allOrders={orders}
              allExpenses={expenses}
              menuItems={menuItems}
              onCloseRegister={handleCloseRegister}
              onReopenRegister={handleReopenRegister}
              onResetAllData={handleResetAllData}
              onSettleOrder={handleSettlePayLaterOrder}
            />
          )}
        </main>

        {/* Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-black text-white border-t border-zinc-800 flex justify-around py-3.5 px-2 z-50">
          <button
            onClick={() => setActiveTab('kasir')}
            className={`flex flex-col items-center space-y-1 transition cursor-pointer ${
              activeTab === 'kasir' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ShoppingBag size={18} strokeWidth={activeTab === 'kasir' ? 2.5 : 2} />
            <span className="text-[9px] font-mono font-bold tracking-wide">KASIR</span>
          </button>

          <button
            onClick={() => setActiveTab('pesanan')}
            className={`flex flex-col items-center space-y-1 transition cursor-pointer relative ${
              activeTab === 'pesanan' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Clock size={18} strokeWidth={activeTab === 'pesanan' ? 2.5 : 2} />
            {orders.filter(o => o.orderStatus === 'Sedang Dibuat').length > 0 && (
              <span className="absolute -top-1 right-2 w-4 h-4 bg-white text-black border border-zinc-900 rounded-full flex items-center justify-center font-mono font-black text-[8px] animate-bounce">
                {orders.filter(o => o.orderStatus === 'Sedang Dibuat').length}
              </span>
            )}
            <span className="text-[9px] font-mono font-bold tracking-wide">PESANAN</span>
          </button>

          <button
            onClick={() => setActiveTab('pengeluaran')}
            className={`flex flex-col items-center space-y-1 transition cursor-pointer ${
              activeTab === 'pengeluaran' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <DollarSign size={18} strokeWidth={activeTab === 'pengeluaran' ? 2.5 : 2} />
            <span className="text-[9px] font-mono font-bold tracking-wide">PENGELUARAN</span>
          </button>

          <button
            onClick={() => setActiveTab('member')}
            className={`flex flex-col items-center space-y-1 transition cursor-pointer ${
              activeTab === 'member' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Users size={18} strokeWidth={activeTab === 'member' ? 2.5 : 2} />
            <span className="text-[9px] font-mono font-bold tracking-wide">MEMBER</span>
          </button>

          <button
            onClick={() => setActiveTab('menu')}
            className={`flex flex-col items-center space-y-1 transition cursor-pointer ${
              activeTab === 'menu' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <MenuIcon size={18} strokeWidth={activeTab === 'menu' ? 2.5 : 2} />
            <span className="text-[9px] font-mono font-bold tracking-wide">MENU</span>
          </button>

          <button
            onClick={() => setActiveTab('close')}
            className={`flex flex-col items-center space-y-1 transition cursor-pointer relative ${
              activeTab === 'close' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Archive size={18} strokeWidth={activeTab === 'close' ? 2.5 : 2} />
            {activeOrders.filter(o => o.paymentMethod === 'Bayar Nanti' && o.paymentStatus === 'Belum Bayar').length > 0 && (
              <span className="absolute -top-1 right-2 w-4 h-4 bg-amber-400 text-black border border-zinc-900 rounded-full flex items-center justify-center font-mono font-black text-[8px] animate-pulse">
                !
              </span>
            )}
            <span className="text-[9px] font-mono font-bold tracking-wide">CLOSE</span>
          </button>
        </nav>

      </div>
    </div>
  );
}
