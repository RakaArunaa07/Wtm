/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Member, Order } from '../types';
import { Plus, Search, User, Phone, Check, CreditCard, DollarSign, X, Calendar, ChevronRight, AlertCircle, Trash2, Maximize2 } from 'lucide-react';
import QrisPoster from './QrisPoster';

interface MemberTabProps {
  members: Member[];
  orders: Order[];
  onAddMember: (member: Member) => void;
  onPayBill: (orderId: string, paymentMethod: 'Cash' | 'QRIS', cashPaid: number, cashChange: number) => void;
  onDeleteMember?: (memberId: string) => void; // Optional addition for complete UX
}

export default function MemberTab({
  members,
  orders,
  onAddMember,
  onPayBill,
  onDeleteMember,
}: MemberTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  // Selected member detail state
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  
  // Bill payment sub-states inside the details view
  const [paymentTargetOrder, setPaymentTargetOrder] = useState<Order | null>(null);
  const [payMethod, setPayMethod] = useState<'Cash' | 'QRIS'>('Cash');
  const [billCashReceived, setBillCashReceived] = useState('');
  const [showQrForBill, setShowQrForBill] = useState(false);
  const [billQrisConfirmed, setBillQrisConfirmed] = useState(false);

  // Compute total outstanding debt per member
  const memberDebtMap = useMemo(() => {
    const debts: Record<string, number> = {};
    members.forEach(m => {
      const memberUnpaid = orders.filter(o => o.memberId === m.id && o.paymentStatus === 'Belum Bayar');
      debts[m.id] = memberUnpaid.reduce((sum, o) => sum + o.total, 0);
    });
    return debts;
  }, [members, orders]);

  // Search filter and sort: members with outstanding tagihan (debt > 0) will be positioned at the top
  const filteredMembers = useMemo(() => {
    const filtered = members.filter(m =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone.includes(searchQuery)
    );

    return [...filtered].sort((a, b) => {
      const debtA = memberDebtMap[a.id] || 0;
      const debtB = memberDebtMap[b.id] || 0;

      // Prioritize members with unpaid debt
      if (debtA > 0 && debtB === 0) return -1;
      if (debtA === 0 && debtB > 0) return 1;

      // If both have debt, sort by largest debt first
      if (debtA > 0 && debtB > 0) {
        return debtB - debtA;
      }

      // Otherwise sort alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [members, searchQuery, memberDebtMap]);

  // Count how many members have outstanding bills
  const membersWithDebtCount = useMemo(() => {
    return members.filter(m => (memberDebtMap[m.id] || 0) > 0).length;
  }, [members, memberDebtMap]);

  // Get selected member's unpaid bills
  const selectedMemberBills = useMemo(() => {
    if (!selectedMember) return [];
    return orders.filter(o => o.memberId === selectedMember.id && o.paymentStatus === 'Belum Bayar');
  }, [selectedMember, orders]);

  // Save/Register new member
  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberPhone.trim()) return;

    const newMember: Member = {
      id: `mbr-${Date.now()}`,
      name: newMemberName.trim(),
      phone: newMemberPhone.trim(),
      createdAt: new Date().toISOString(),
    };

    onAddMember(newMember);
    setNewMemberName('');
    setNewMemberPhone('');
    setShowAddModal(false);
  };

  // Finalize payment of a specific member bill
  const handleFinalizeBillPayment = () => {
    if (!paymentTargetOrder) return;

    const totalBill = paymentTargetOrder.total;
    const received = parseFloat(billCashReceived) || 0;
    const change = payMethod === 'Cash' ? Math.max(0, received - totalBill) : 0;

    if (payMethod === 'Cash' && received < totalBill) {
      alert('Uang diterima tidak boleh kurang dari jumlah tagihan!');
      return;
    }

    onPayBill(paymentTargetOrder.id, payMethod, received, change);
    
    // Reset local payment states
    setPaymentTargetOrder(null);
    setBillCashReceived('');
    setShowQrForBill(false);
    setBillQrisConfirmed(false);
  };

  // Pricing format
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  // Date format helpers
  const formatFullDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    } catch {
      return '';
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen pb-28 text-white bg-zinc-950">
      <div className="flex flex-col space-y-4">
        {/* Header and Add Member Button */}
        <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
          <h2 className="text-lg font-display font-bold tracking-wider uppercase text-white">Daftar Akun Member</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-white hover:bg-zinc-100 text-black font-display font-bold uppercase tracking-wider text-[10px] px-3.5 py-2.5 rounded-xl flex items-center transition active:scale-95 cursor-pointer"
          >
            <Plus size={12} className="mr-1" strokeWidth={3} />
            Tambah Akun
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Cari nama atau no HP member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-850 pl-10 pr-4 py-3 rounded-xl font-sans text-sm text-white focus:outline-none focus:border-zinc-500"
          />
        </div>

        {/* Member List Grid */}
        <div className="space-y-2">
          {membersWithDebtCount > 0 && !searchQuery && (
            <div className="flex items-center justify-between px-1 py-1 text-[11px] font-mono text-zinc-400">
              <span className="flex items-center space-x-1 text-red-400 font-bold">
                <AlertCircle size={12} />
                <span>{membersWithDebtCount} Member Memiliki Tagihan</span>
              </span>
              <span className="text-zinc-500 text-[10px]">Diurutkan di atas</span>
            </div>
          )}

          {filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-zinc-900 border border-zinc-850 rounded-2xl text-center p-6 shadow-sm">
              <User size={32} className="text-zinc-600 mb-2" />
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide">Member tidak ditemukan</p>
            </div>
          ) : (
            filteredMembers.map((m) => {
              const debt = memberDebtMap[m.id] || 0;
              const hasDebt = debt > 0;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMember(m)}
                  className={`w-full text-left p-3.5 rounded-2xl shadow-sm flex items-center justify-between transition cursor-pointer ${
                    hasDebt
                      ? 'bg-zinc-900 hover:bg-zinc-850 border border-red-900/40 hover:border-red-800/60'
                      : 'bg-zinc-900 hover:bg-zinc-850 border border-zinc-850'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-xl flex items-center justify-center border ${
                      hasDebt
                        ? 'bg-red-950/40 text-red-400 border-red-900/50'
                        : 'bg-black text-white border border-zinc-800'
                    }`}>
                      <User size={15} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[9px] font-mono font-bold text-zinc-500 block">ID: {m.id.substring(4, 10).toUpperCase()}</span>
                        {hasDebt && (
                          <span className="bg-red-950 text-red-400 text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border border-red-800/50 uppercase">
                            Ada Tagihan
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-white block mt-0.5">{m.name}</span>
                      <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">{m.phone}</span>
                    </div>
                  </div>

                  <div className="text-right flex items-center space-x-2">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">Total Tagihan</span>
                      <span className={`text-xs font-mono font-bold ${hasDebt ? 'text-red-400' : 'text-zinc-500'}`}>
                        {hasDebt ? formatPrice(debt) : 'LUNAS'}
                      </span>
                    </div>
                    <ChevronRight size={14} className={hasDebt ? 'text-red-400' : 'text-zinc-600'} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Modal: Tambah Akun Member Baru */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-zinc-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-850 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Tambah Akun Member</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-white transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="member-name" className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">Nama Lengkap</label>
                <div className="relative">
                  <User size={13} className="absolute left-3.5 top-3 text-zinc-500" />
                  <input
                    id="member-name"
                    type="text"
                    placeholder="Contoh: Budi Santoso..."
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="w-full bg-black border border-zinc-800 pl-10 pr-3.5 py-2.5 rounded-xl font-sans text-sm focus:outline-none focus:border-zinc-500 text-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="member-phone" className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">Nomor WhatsApp / HP</label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3.5 top-3 text-zinc-500" />
                  <input
                    id="member-phone"
                    type="text"
                    placeholder="Contoh: 081234567890..."
                    value={newMemberPhone}
                    onChange={(e) => setNewMemberPhone(e.target.value)}
                    className="w-full bg-black border border-zinc-800 pl-10 pr-3.5 py-2.5 rounded-xl font-mono text-sm focus:outline-none focus:border-zinc-500 text-white"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-white hover:bg-zinc-100 text-black font-display font-bold uppercase tracking-wider py-3.5 rounded-xl transition flex items-center justify-center cursor-pointer active:scale-95 shadow-md"
              >
                Selesai &amp; Buat Akun
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Slide-Over: Rincian Tagihan Member */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-45 p-4 transition-all overflow-y-auto">
          <div className="bg-zinc-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-850 flex flex-col space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header Profil */}
            <div className="flex items-start justify-between border-b border-zinc-850 pb-3">
              <div className="flex items-center space-x-3">
                <div className="bg-white text-black p-2.5 rounded-xl">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">{selectedMember.name}</h3>
                  <span className="text-[9px] font-mono text-zinc-500 block uppercase mt-0.5">No Member: {selectedMember.id.substring(4, 10).toUpperCase()}</span>
                  <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">{selectedMember.phone}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedMember(null);
                  setPaymentTargetOrder(null);
                }}
                className="text-zinc-500 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Bills Section */}
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                Outstanding Bills ({selectedMemberBills.length})
              </h4>

              {selectedMemberBills.length === 0 ? (
                <div className="bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 p-4 rounded-2xl text-center space-y-1">
                  <Check size={18} className="mx-auto" />
                  <p className="text-[10px] font-mono font-bold uppercase">Member Lunas</p>
                  <p className="text-[11px] font-sans text-emerald-500">Tidak ada tumpukan tagihan pembayaran yang tersisa.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedMemberBills.map((bill) => (
                    <div
                      key={bill.id}
                      className="bg-black/30 border border-zinc-850 p-4 rounded-2xl flex flex-col space-y-3 shadow-sm hover:border-zinc-800 transition"
                    >
                      {/* Day and Date header */}
                      <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
                        <div className="flex items-center space-x-1.5 text-zinc-400">
                          <Calendar size={11} />
                          <span className="text-[10px] font-mono font-bold uppercase">{formatFullDate(bill.createdAt)}</span>
                        </div>
                        <span className="text-[9px] font-mono text-zinc-500">{formatTime(bill.createdAt)}</span>
                      </div>

                      {/* Items details */}
                      <div className="space-y-1.5 ml-1">
                        {bill.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-zinc-300 font-sans">
                            <span>{item.quantity}x {item.menuItem.name}</span>
                            <span className="font-mono text-zinc-500">{formatPrice(item.menuItem.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Subtotal & Action */}
                      <div className="flex items-center justify-between border-t border-zinc-850 pt-3">
                        <div>
                          <span className="text-[9px] font-mono font-bold text-zinc-500 block uppercase mb-0.5">Subtotal Tagihan</span>
                          <span className="font-mono text-sm font-bold text-red-400">{formatPrice(bill.total)}</span>
                        </div>

                        {paymentTargetOrder?.id !== bill.id ? (
                          <button
                            onClick={() => {
                              setPaymentTargetOrder(bill);
                              setPayMethod('Cash');
                              setBillCashReceived('');
                              setBillQrisConfirmed(false);
                            }}
                            className="bg-white hover:bg-zinc-100 text-black font-display font-bold uppercase text-[10px] tracking-wider px-3.5 py-2 rounded-xl shadow transition cursor-pointer active:scale-95"
                          >
                            Bayar
                          </button>
                        ) : (
                          <button
                            onClick={() => setPaymentTargetOrder(null)}
                            className="text-zinc-500 hover:text-white font-mono font-bold uppercase text-[10px] px-3 py-2 cursor-pointer"
                          >
                            Sembunyikan
                          </button>
                        )}
                      </div>

                      {/* Payment Sub-flow expansion inside the card */}
                      {paymentTargetOrder?.id === bill.id && (
                        <div className="mt-3 border-t border-zinc-850 pt-3.5 space-y-3 bg-zinc-950 p-4 rounded-xl border border-zinc-850">
                          <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">Metode Pembayaran Tagihan</label>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                  setPayMethod('Cash');
                                  setShowQrForBill(false);
                              }}
                              className={`py-2 rounded-lg border font-mono text-[10px] font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                                payMethod === 'Cash' ? 'bg-white text-black border-white shadow-sm' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-850 hover:text-white'
                              }`}
                            >
                              <DollarSign size={11} />
                              <span>CASH</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                  setPayMethod('QRIS');
                                  setShowQrForBill(true);
                              }}
                              className={`py-2 rounded-lg border font-mono text-[10px] font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                                payMethod === 'QRIS' ? 'bg-white text-black border-white shadow-sm' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-850 hover:text-white'
                              }`}
                            >
                              <CreditCard size={11} />
                              <span>QRIS</span>
                            </button>
                          </div>

                          {payMethod === 'Cash' ? (
                            <div className="space-y-2">
                              <label htmlFor="bill-cash" className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">Nominal Tunai Diterima</label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-2 font-mono text-xs text-zinc-500 font-bold">Rp</span>
                                <input
                                  id="bill-cash"
                                  type="number"
                                  placeholder="0"
                                  value={billCashReceived}
                                  onChange={(e) => setBillCashReceived(e.target.value)}
                                  className="w-full bg-black border border-zinc-800 pl-8 pr-2 py-1.5 rounded-lg font-mono text-xs focus:outline-none focus:border-zinc-500 text-white"
                                />
                              </div>

                              {parseFloat(billCashReceived) > 0 && (
                                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 pt-1 border-t border-zinc-850">
                                  <span>Kembalian</span>
                                  <span className={parseFloat(billCashReceived) >= bill.total ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                    {parseFloat(billCashReceived) < bill.total ? 'Uang Kurang' : formatPrice(parseFloat(billCashReceived) - bill.total)}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-black/45 border border-zinc-850 p-3.5 rounded-2xl space-y-3">
                              {/* Pure QR Code for Bill Payment */}
                              <div className="flex flex-col items-center">
                                <QrisPoster
                                  amount={bill.total}
                                  size={160}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => setBillQrisConfirmed(!billQrisConfirmed)}
                                className={`w-full py-2.5 rounded-xl font-mono text-[10px] font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer border ${
                                  billQrisConfirmed
                                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400'
                                    : 'bg-white hover:bg-zinc-100 text-black border-white'
                                }`}
                              >
                                <Check size={12} className={billQrisConfirmed ? 'text-emerald-400' : 'text-black'} strokeWidth={2.5} />
                                <span>{billQrisConfirmed ? 'Dikonfirmasi Karyawan (Lunas)' : 'Konfirmasi Pembayaran QRIS'}</span>
                              </button>
                            </div>
                          )}

                          {/* Finalize button */}
                          <button
                            onClick={handleFinalizeBillPayment}
                            disabled={
                              (payMethod === 'Cash' && (parseFloat(billCashReceived) || 0) < bill.total) ||
                              (payMethod === 'QRIS' && !billQrisConfirmed)
                            }
                            className={`w-full py-2.5 rounded-xl font-mono text-[10px] font-bold uppercase transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                              (payMethod === 'QRIS' && billQrisConfirmed) || (payMethod === 'Cash' && (parseFloat(billCashReceived) || 0) >= bill.total)
                                ? 'bg-white hover:bg-zinc-100 text-black shadow-md'
                                : 'bg-zinc-900 text-zinc-600 border border-zinc-850 cursor-not-allowed'
                            }`}
                          >
                            <Check size={11} strokeWidth={3} />
                            <span>Selesaikan Pembayaran</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Danger Zone: Hapus Akun */}
            {onDeleteMember && (
              <div className="border-t border-zinc-850 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    const totalDebt = memberDebtMap[selectedMember.id] || 0;
                    const confirmMsg = totalDebt > 0 
                      ? `PERINGATAN: Member ini masih memiliki tagihan sebesar ${formatPrice(totalDebt)}.\n\nApakah Anda yakin ingin menghapus akun member "${selectedMember.name}" secara permanen?`
                      : `Apakah Anda yakin ingin menghapus akun member "${selectedMember.name}" secara permanen?`;
                    
                    if (confirm(confirmMsg)) {
                      onDeleteMember(selectedMember.id);
                      setSelectedMember(null);
                    }
                  }}
                  className="w-full bg-red-950/10 hover:bg-red-950/30 border border-red-900/30 text-red-400 font-mono text-[10px] font-bold uppercase py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                >
                  <Trash2 size={12} />
                  <span>Hapus Akun Member</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
