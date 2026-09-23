/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MenuItem } from '../types';
import { Plus, Edit2, Check, X, Coffee, List, Trash2, QrCode } from 'lucide-react';
import QrisPoster from './QrisPoster';

interface MenuTabProps {
  menuItems: MenuItem[];
  onAddMenuItem: (item: MenuItem) => void;
  onUpdatePrice: (itemId: string, newPrice: number) => void;
  onDeleteMenuItem: (itemId: string) => void;
}

export default function MenuTab({
  menuItems,
  onAddMenuItem,
  onUpdatePrice,
  onDeleteMenuItem,
}: MenuTabProps) {
  // Add menu form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Kopi');
  
  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');

  // Categories list
  const categories = ['Kopi', 'Non-Kopi', 'Makanan', 'Lain-lain'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return;

    const newItem: MenuItem = {
      id: `menu-${Date.now()}`,
      name: name.trim(),
      price: parseFloat(price),
      category,
    };

    onAddMenuItem(newItem);
    setName('');
    setPrice('');
    setCategory('Kopi');
  };

  const handleStartEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setEditPrice(item.price.toString());
  };

  const handleSaveEdit = (itemId: string) => {
    const parsedPrice = parseFloat(editPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) return;
    onUpdatePrice(itemId, parsedPrice);
    setEditingId(null);
    setEditPrice('');
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen pb-28 text-white bg-zinc-950">
      <div className="flex flex-col space-y-4">
        <h2 className="text-lg font-display font-bold tracking-wider uppercase border-b border-zinc-850 pb-3">Daftar Menu &amp; Harga</h2>

        {/* Form Tambah Menu Baru */}
        <form onSubmit={handleSubmit} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-850 shadow-sm space-y-4">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Tambah Item Menu Baru</h3>
          
          <div className="space-y-1.5">
            <label htmlFor="menu-item-name" className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">Nama Menu</label>
            <input
              id="menu-item-name"
              type="text"
              placeholder="Contoh: Kopi Tarik Ice..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border border-zinc-800 px-3.5 py-2.5 rounded-xl font-sans text-sm focus:outline-none focus:border-zinc-500 text-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="menu-item-price" className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">Harga (IDR)</label>
              <input
                id="menu-item-price"
                type="number"
                placeholder="20000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-black border border-zinc-800 px-3.5 py-2.5 rounded-xl font-mono text-sm focus:outline-none focus:border-zinc-500 text-white"
                required
                min="0"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="menu-item-category" className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">Kategori</label>
              <select
                id="menu-item-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-black border border-zinc-800 px-3.5 py-2.5 rounded-xl font-mono text-xs focus:outline-none focus:border-zinc-500 text-white h-[42px] cursor-pointer"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-white hover:bg-zinc-100 text-black font-display font-bold uppercase tracking-wider py-3 rounded-xl transition flex items-center justify-center cursor-pointer shadow-md active:scale-95 text-xs"
          >
            <Plus size={14} className="mr-1" strokeWidth={3} />
            Tambah Menu
          </button>
        </form>

        {/* List Menu Items */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-zinc-500 font-mono text-xs pb-1.5 border-b border-zinc-850 px-1">
            <span className="uppercase tracking-wider font-bold">Menu Tersedia ({menuItems.length})</span>
            <span className="uppercase tracking-wider font-bold">Harga &amp; Aksi</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {menuItems.map((item) => (
              <div
                key={item.id}
                className="bg-zinc-900 border border-zinc-850 p-3.5 rounded-xl shadow-sm flex items-center justify-between transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5">
                    <Coffee size={12} className="text-zinc-500" />
                    <span className="text-xs font-sans font-bold text-zinc-200">{item.name}</span>
                  </div>
                  <span className="bg-black text-zinc-400 border border-zinc-800 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase inline-block">
                    {item.category}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {editingId === item.id ? (
                    <div className="flex items-center space-x-1.5">
                      <div className="relative">
                        <span className="absolute left-1.5 top-1.5 font-mono text-[9px] text-zinc-500 font-bold">Rp</span>
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-20 bg-black border border-zinc-800 pl-5 pr-1 py-1 rounded-md font-mono text-xs focus:outline-none focus:border-zinc-500 text-white text-right"
                          min="0"
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        className="bg-white hover:bg-zinc-100 text-black p-1.5 rounded-md transition cursor-pointer"
                        title="Simpan"
                      >
                        <Check size={11} strokeWidth={3} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 p-1.5 rounded-md transition cursor-pointer"
                        title="Batal"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-white mr-1">{formatPrice(item.price)}</span>
                      <button
                        onClick={() => handleStartEdit(item)}
                        className="text-zinc-500 hover:text-white p-2 rounded-xl hover:bg-zinc-800 border border-transparent hover:border-zinc-850 transition cursor-pointer"
                        title="Ubah Harga"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => onDeleteMenuItem(item.id)}
                        className="text-zinc-500 hover:text-red-400 p-2 rounded-xl hover:bg-red-950/30 border border-transparent hover:border-red-900/40 transition cursor-pointer"
                        title="Hapus Menu"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pengaturan QRIS Toko */}
        <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-850 shadow-sm space-y-3 mt-4">
          <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
            <div className="flex items-center space-x-2">
              <QrCode size={16} className="text-emerald-400" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Foto / Barcode QRIS Toko
              </h3>
            </div>
            <span className="text-[9px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-md border border-zinc-800">
              Metode QRIS
            </span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Upload foto QRIS toko Anda agar pelanggan dapat langsung melakukan pembayaran scan QRIS saat checkout di kasir.
          </p>

          <div className="pt-2">
            <QrisPoster size={200} />
          </div>
        </div>
      </div>
    </div>
  );
}
