/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Expense } from '../types';
import { Plus, Trash2, DollarSign, ListFilter, Calendar, AlertCircle } from 'lucide-react';

interface PengeluaranTabProps {
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => void;
  isClosed: boolean;
}

export default function PengeluaranTab({
  expenses,
  onAddExpense,
  onDeleteExpense,
  isClosed,
}: PengeluaranTabProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, item) => sum + item.amount, 0);
  }, [expenses]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;

    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      name: name.trim(),
      amount: parseFloat(amount),
      createdAt: new Date().toISOString(),
    };

    onAddExpense(newExpense);
    setName('');
    setAmount('');
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (isClosed) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-900 text-white min-h-[70vh] border border-zinc-850 rounded-2xl mx-4 my-6">
        <AlertCircle size={44} className="text-zinc-500 mb-4 animate-pulse" />
        <h3 className="text-lg font-mono font-bold tracking-wider uppercase mb-2">Toko Sedang Tutup</h3>
        <p className="text-xs text-zinc-400 text-center max-w-xs mb-6 leading-relaxed">
          Karyawan sudah melakukan Close Register. Silakan buka kembali register melalui menu CLOSE di akhir sesi jika ingin mencatat pengeluaran.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen pb-28 text-white bg-zinc-950">
      <div className="flex flex-col space-y-4">
        <h2 className="text-lg font-display font-bold tracking-wider uppercase border-b border-zinc-850 pb-3">Input Pengeluaran Toko</h2>

        {/* Input Form */}
        <form onSubmit={handleAdd} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-850 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="expense-name" className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">Nama Pengeluaran / Barang</label>
            <input
              id="expense-name"
              type="text"
              placeholder="Contoh: Es batu, Susu UHT 5 Box, Sabun Cuci..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border border-zinc-800 px-3.5 py-2.5 rounded-xl font-sans text-sm focus:outline-none focus:border-zinc-500 text-white"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="expense-amount" className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">Nominal Harga (IDR)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 font-mono text-sm text-zinc-500 font-bold">Rp</span>
              <input
                id="expense-amount"
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-black border border-zinc-800 pl-10 pr-3.5 py-2.5 rounded-xl font-mono text-sm focus:outline-none focus:border-zinc-500 text-white"
                required
                min="0"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-white hover:bg-zinc-100 text-black font-display font-bold uppercase tracking-wider py-3.5 rounded-xl transition flex items-center justify-center cursor-pointer shadow-md active:scale-95"
          >
            <Plus size={15} className="mr-1.5" strokeWidth={3} />
            Simpan Pengeluaran
          </button>
        </form>

        {/* Live Expense Counter Card */}
        <div className="bg-zinc-900 text-white p-4 rounded-2xl border border-zinc-850 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[10px] text-zinc-400 font-mono tracking-wider uppercase block mb-1">Total Pengeluaran Hari Ini</span>
            <span className="text-xl font-mono font-black">{formatPrice(totalExpenses)}</span>
          </div>
          <div className="bg-black border border-zinc-850 p-2 rounded-full text-zinc-400">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Expense History List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-zinc-500 font-mono text-xs pb-1.5 px-1 border-b border-zinc-850">
            <span className="uppercase tracking-wider font-bold">Riwayat Pengeluaran ({expenses.length})</span>
            <span className="uppercase tracking-wider font-bold">Aksi</span>
          </div>

          {expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-zinc-900 border border-zinc-850 rounded-2xl text-center p-6 shadow-sm">
              <ListFilter size={20} className="text-zinc-600 mb-1.5" />
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide">Belum ada pengeluaran hari ini</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {expenses.map((exp) => (
                <div
                  key={exp.id}
                  className="bg-zinc-900 border border-zinc-850 p-3.5 rounded-xl flex items-center justify-between shadow-sm"
                >
                  <div className="space-y-1">
                    <span className="text-xs font-sans font-bold text-zinc-200 block">{exp.name}</span>
                    <div className="flex items-center space-x-1 text-[10px] text-zinc-400 font-mono">
                      <Calendar size={10} />
                      <span>{formatDate(exp.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs font-bold text-white">{formatPrice(exp.amount)}</span>
                    <button
                      onClick={() => onDeleteExpense(exp.id)}
                      className="text-zinc-500 hover:text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/40 p-2 rounded-xl transition cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
