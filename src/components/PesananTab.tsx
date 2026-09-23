/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Order } from '../types';
import { Check, Clock, User, Coffee, Info, CheckCircle2, DollarSign, CreditCard, X, AlertCircle } from 'lucide-react';
import QrisPoster from './QrisPoster';

interface PesananTabProps {
  orders: Order[];
  onCompleteOrder: (orderId: string) => void;
  onSettleOrder?: (orderId: string, paymentMethod: 'Cash' | 'QRIS', cashPaid: number, cashChange: number) => void;
}

export default function PesananTab({ orders, onCompleteOrder, onSettleOrder }: PesananTabProps) {
  const [activeFilter, setActiveFilter] = useState<'sedang_dibuat' | 'selesai' | 'belum_lunas'>('sedang_dibuat');

  // Modal State for Settling Pay Later Order
  const [settlingOrder, setSettlingOrder] = useState<Order | null>(null);
  const [settleMethod, setSettleMethod] = useState<'Cash' | 'QRIS'>('Cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [qrisConfirmed, setQrisConfirmed] = useState(false);

  const unpaidPayLaterCount = useMemo(() => {
    return orders.filter(o => o.paymentMethod === 'Bayar Nanti' && o.paymentStatus === 'Belum Bayar').length;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (activeFilter === 'sedang_dibuat') {
        return order.orderStatus === 'Sedang Dibuat';
      } else if (activeFilter === 'selesai') {
        return order.orderStatus === 'Selesai';
      } else if (activeFilter === 'belum_lunas') {
        return order.paymentMethod === 'Bayar Nanti' && order.paymentStatus === 'Belum Bayar';
      }
      return true;
    });
  }, [orders, activeFilter]);

  // Helper for formatting price
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  // Format date helper
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    } catch {
      return '';
    }
  };

  // Calculation for settle modal
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

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen pb-28 text-white bg-zinc-950">
      {/* Unpaid Pay Later Warning Banner if any */}
      {unpaidPayLaterCount > 0 && (
        <div className="mb-4 p-3.5 bg-amber-950/30 border border-amber-800/50 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Clock size={16} className="text-amber-400 animate-pulse shrink-0" />
            <div>
              <span className="font-mono text-xs font-bold text-amber-300 block">
                {unpaidPayLaterCount} Pesanan Bayar Nanti
              </span>
              <span className="text-[10px] text-amber-200/80 font-sans">
                Wajib dilunasi hari ini sebelum Close Register.
              </span>
            </div>
          </div>
          {activeFilter !== 'belum_lunas' && (
            <button
              onClick={() => setActiveFilter('belum_lunas')}
              className="bg-amber-400 hover:bg-amber-300 text-black px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition cursor-pointer"
            >
              Lihat
            </button>
          )}
        </div>
      )}

      {/* Tab Filter */}
      <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-850 mb-5 font-mono text-[10px]">
        <button
          onClick={() => setActiveFilter('sedang_dibuat')}
          className={`flex-1 py-2.5 rounded-xl font-bold uppercase transition-all duration-200 flex items-center justify-center space-x-1 cursor-pointer ${
            activeFilter === 'sedang_dibuat' ? 'bg-white text-black shadow-md' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
          }`}
        >
          <Clock size={11} className={activeFilter === 'sedang_dibuat' ? 'animate-pulse' : ''} />
          <span>Antrean ({orders.filter(o => o.orderStatus === 'Sedang Dibuat').length})</span>
        </button>
        <button
          onClick={() => setActiveFilter('selesai')}
          className={`flex-1 py-2.5 rounded-xl font-bold uppercase transition-all duration-200 flex items-center justify-center space-x-1 cursor-pointer ${
            activeFilter === 'selesai' ? 'bg-white text-black shadow-md' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
          }`}
        >
          <CheckCircle2 size={11} />
          <span>Selesai ({orders.filter(o => o.orderStatus === 'Selesai').length})</span>
        </button>
        {unpaidPayLaterCount > 0 && (
          <button
            onClick={() => setActiveFilter('belum_lunas')}
            className={`flex-1 py-2.5 rounded-xl font-bold uppercase transition-all duration-200 flex items-center justify-center space-x-1 cursor-pointer ${
              activeFilter === 'belum_lunas' ? 'bg-amber-400 text-black shadow-md' : 'text-amber-400 hover:bg-amber-950/40'
            }`}
          >
            <span>Tagihan ({unpaidPayLaterCount})</span>
          </button>
        )}
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-zinc-900 border border-zinc-850 rounded-2xl text-center p-6 shadow-sm">
            <Coffee size={32} className="text-zinc-600 mb-2" />
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
              {activeFilter === 'sedang_dibuat' 
                ? 'Tidak Ada Antrean' 
                : activeFilter === 'belum_lunas' 
                ? 'Semua Bayar Nanti Sudah Lunas' 
                : 'Belum Ada Pesanan Selesai'}
            </h4>
            <p className="text-zinc-500 font-sans text-[11px] leading-relaxed max-w-xs">
              {activeFilter === 'sedang_dibuat' 
                ? 'Semua pesanan saat ini sudah siap diproses dan disajikan.' 
                : activeFilter === 'belum_lunas'
                ? 'Bagus! Tidak ada tunggakan Bayar Nanti yang menahan Close Register.'
                : 'Pencatatan pesanan yang selesai akan muncul di tab ini.'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isUnpaidPayLater = order.paymentMethod === 'Bayar Nanti' && order.paymentStatus === 'Belum Bayar';

            return (
              <div
                key={order.id}
                className={`bg-zinc-900 border rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between transition-all duration-300 ${
                  isUnpaidPayLater 
                    ? 'border-amber-700/60 ring-1 ring-amber-500/30' 
                    : order.orderStatus === 'Sedang Dibuat' 
                    ? 'border-zinc-800' 
                    : 'border-zinc-850/80 opacity-85'
                }`}
              >
                {/* Order Header */}
                <div className="bg-black/30 px-4 py-3.5 border-b border-zinc-800/80 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono text-[9px] text-zinc-400">{order.invoice}</span>
                      <span className="text-[9px] font-mono text-zinc-600">•</span>
                      <span className="font-mono text-[9px] text-zinc-400">{formatTime(order.createdAt)}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 mt-1">
                      <User size={11} className="text-zinc-500" />
                      <span className="text-xs font-bold text-white">{order.buyerName}</span>
                      {order.isMember && (
                        <span className="bg-white text-black text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase">
                          MEMBER
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-xs font-bold block text-white">{formatPrice(order.total)}</span>
                    <div className="flex justify-end space-x-1 items-center mt-1">
                      <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                        order.paymentMethod === 'Member Tab' 
                          ? 'bg-orange-950/40 text-orange-400 border border-orange-900/30' 
                          : order.paymentMethod === 'Bayar Nanti'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}>
                        {order.settledVia ? `${order.paymentMethod} (${order.settledVia})` : order.paymentMethod}
                      </span>
                      <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                        order.paymentStatus === 'Lunas' 
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' 
                          : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                      }`}>
                        {order.paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="p-4 space-y-3">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start border-b border-zinc-800/50 pb-2.5 last:border-0 last:pb-0">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="bg-black text-white border border-zinc-800 w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold">
                            {item.quantity}
                          </span>
                          <span className="text-xs font-sans font-bold text-zinc-200">{item.menuItem.name}</span>
                        </div>
                        {item.note && (
                          <p className="text-[10px] text-zinc-400 italic mt-1 ml-7 font-sans leading-relaxed">
                            Catatan: {item.note}
                          </p>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-zinc-400">{formatPrice(item.menuItem.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                {/* Action Bar (Completion & Settlement) */}
                <div className="p-3 bg-black/30 border-t border-zinc-800/60 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center text-[10px] font-mono text-zinc-400">
                    {isUnpaidPayLater ? (
                      <span className="text-amber-400 font-semibold flex items-center">
                        <AlertCircle size={12} className="mr-1" />
                        Belum Lunas (Bayar Nanti)
                      </span>
                    ) : order.orderStatus === 'Sedang Dibuat' ? (
                      <span className="text-zinc-500 flex items-center">
                        <Info size={11} className="mr-1" />
                        Sedang disiapkan
                      </span>
                    ) : (
                      <span className="text-emerald-400/80 flex items-center">
                        <Check size={11} className="mr-1" />
                        Pesanan Selesai
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Pay button for unpaid Bayar Nanti orders */}
                    {isUnpaidPayLater && onSettleOrder && (
                      <button
                        onClick={() => openSettleModal(order)}
                        className="bg-amber-400 hover:bg-amber-300 text-black font-display font-bold uppercase tracking-wider text-[10px] px-3 py-1.5 rounded-xl flex items-center transition active:scale-95 cursor-pointer shadow-sm"
                      >
                        <DollarSign size={12} className="mr-0.5" />
                        Lunasi Sekarang
                      </button>
                    )}

                    {/* Finish button if still preparing */}
                    {order.orderStatus === 'Sedang Dibuat' && (
                      <button
                        onClick={() => onCompleteOrder(order.id)}
                        className="bg-white hover:bg-zinc-100 text-black font-display font-bold uppercase tracking-wider text-[10px] px-3.5 py-1.5 rounded-xl flex items-center transition active:scale-95 cursor-pointer"
                      >
                        <Check size={11} className="mr-1" strokeWidth={3} />
                        Selesai
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Settlement Modal for Bayar Nanti */}
      {settlingOrder && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all animate-fade-in overflow-y-auto">
          <div className="bg-zinc-900 rounded-3xl w-full max-w-md p-5 shadow-2xl border border-zinc-800 flex flex-col space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div>
                <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider block">Pelunasan Bayar Nanti</span>
                <h3 className="font-display font-bold text-sm text-white">{settlingOrder.buyerName} ({settlingOrder.invoice})</h3>
              </div>
              <button
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

