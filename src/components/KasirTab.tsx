/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { MenuItem, Member, Order, OrderItem } from '../types';
import { Plus, Minus, Trash2, Search, Check, User, CreditCard, DollarSign, BookOpen, Clock, AlertCircle, ShoppingBag, X, Maximize2 } from 'lucide-react';
import QrisPoster from './QrisPoster';

interface KasirTabProps {
  menuItems: MenuItem[];
  members: Member[];
  onAddOrder: (order: Order) => void;
  isClosed: boolean;
  onNavigateToOrders: () => void;
}

export default function KasirTab({
  menuItems,
  members,
  onAddOrder,
  isClosed,
  onNavigateToOrders,
}: KasirTabProps) {
  // Order flow state
  const [isCreating, setIsCreating] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'QRIS' | 'Member Tab' | 'Bayar Nanti'>('Cash');
  
  // Cash details
  const [cashReceived, setCashReceived] = useState<string>('');
  const [showQrisModal, setShowQrisModal] = useState(false);
  const [qrisConfirmed, setQrisConfirmed] = useState(false);
  
  // Filter and Category state
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [menuSearchQuery, setMenuSearchQuery] = useState('');

  // Auto-fill member name if member is toggled
  const handleToggleMember = (checked: boolean) => {
    setIsMember(checked);
    if (!checked) {
      setSelectedMemberId('');
      setPaymentMethod('Cash');
    } else {
      setPaymentMethod('Member Tab'); // Default for member is typically tab/accumulate
    }
  };

  // Categories
  const categories = useMemo(() => {
    const cats = new Set(menuItems.map(item => item.category));
    return ['Semua', ...Array.from(cats)];
  }, [menuItems]);

  // Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchCat = activeCategory === 'Semua' || item.category === activeCategory;
      const matchSearch = item.name.toLowerCase().includes(menuSearchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menuItems, activeCategory, menuSearchQuery]);

  // Search Members
  const filteredMembers = useMemo(() => {
    if (!memberSearchQuery) return members;
    return members.filter(m =>
      m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      m.phone.includes(memberSearchQuery)
    );
  }, [members, memberSearchQuery]);

  const selectedMember = useMemo(() => {
    return members.find(m => m.id === selectedMemberId);
  }, [members, selectedMemberId]);

  // Cart operations
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItem.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.menuItem.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { menuItem: item, quantity: 1, note: '' }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.menuItem.id === itemId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const updateNote = (itemId: string, note: string) => {
    setCart(prev =>
      prev.map(item =>
        item.menuItem.id === itemId ? { ...item, note } : item
      )
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.menuItem.id !== itemId));
  };

  // Calculations
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
  }, [cart]);

  const changeDue = useMemo(() => {
    if (paymentMethod !== 'Cash') return 0;
    const received = parseFloat(cashReceived) || 0;
    return Math.max(0, received - cartTotal);
  }, [cashReceived, cartTotal, paymentMethod]);

  const isCartValid =
    cart.length > 0 &&
    (isMember ? selectedMemberId !== '' : buyerName.trim() !== '');
  const isPaymentValid = useMemo(() => {
    if (paymentMethod === 'Cash') {
      const received = parseFloat(cashReceived) || 0;
      return received >= cartTotal;
    }
    if (paymentMethod === 'Member Tab') {
      return isMember && selectedMemberId !== '';
    }
    if (paymentMethod === 'QRIS') {
      return qrisConfirmed;
    }
    if (paymentMethod === 'Bayar Nanti') {
      return true;
    }
    return true;
  }, [paymentMethod, cashReceived, cartTotal, isMember, selectedMemberId, qrisConfirmed]);

  // Submit Order
  const handleCompleteOrder = () => {
    if (!isCartValid || !isPaymentValid) return;

    const invoiceNumber = `INV-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      invoice: invoiceNumber,
      buyerName: isMember && selectedMember ? selectedMember.name : buyerName,
      isMember,
      memberId: isMember ? selectedMemberId : undefined,
      items: cart,
      total: cartTotal,
      paymentMethod,
      paymentStatus: (paymentMethod === 'Member Tab' || paymentMethod === 'Bayar Nanti') ? 'Belum Bayar' : 'Lunas',
      orderStatus: 'Sedang Dibuat',
      createdAt: new Date().toISOString(),
      cashPaid: paymentMethod === 'Cash' ? (parseFloat(cashReceived) || 0) : 0,
      cashChange: paymentMethod === 'Cash' ? changeDue : 0,
    };

    onAddOrder(newOrder);

    // Reset Form
    setIsCreating(false);
    setBuyerName('');
    setIsMember(false);
    setSelectedMemberId('');
    setCart([]);
    setPaymentMethod('Cash');
    setCashReceived('');
    setMemberSearchQuery('');
    setQrisConfirmed(false);
    
    // Jump to active orders tab
    onNavigateToOrders();
  };

  // Helper for formatting price
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  if (isClosed) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-900 text-white min-h-[70vh] border border-zinc-800/80 rounded-3xl mx-4 my-6">
        <AlertCircle size={44} className="text-zinc-600 mb-4 animate-pulse" />
        <h3 className="text-base font-display font-bold tracking-wider uppercase mb-2">Register Closed</h3>
        <p className="text-xs text-zinc-400 text-center max-w-xs leading-relaxed mb-6">
          Karyawan sudah melakukan Close Register. Silakan buka kembali register melalui menu CLOSE di akhir sesi jika ingin bertransaksi kembali.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen pb-28 text-white bg-zinc-950">
      {!isCreating ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-850 w-full text-center flex flex-col items-center">
            <div className="bg-white text-black p-4 rounded-2xl mb-5 shadow-lg">
              <ShoppingBag size={28} />
            </div>
            <h2 className="text-lg font-display font-black uppercase tracking-wider mb-6">POS KASIR</h2>
            <button
              onClick={() => setIsCreating(true)}
              className="w-full bg-white hover:bg-zinc-100 text-black font-display font-bold uppercase tracking-wider py-4 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md active:scale-[0.98] cursor-pointer"
            >
              <Plus size={18} className="mr-2" strokeWidth={3} />
              Pesanan Baru
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col space-y-4">
          {/* Header Batal */}
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3.5">
            <h2 className="text-sm font-display font-black tracking-wider uppercase">Buat Pesanan</h2>
            <button
              onClick={() => {
                setIsCreating(false);
                setCart([]);
                setBuyerName('');
                setIsMember(false);
                setSelectedMemberId('');
                setQrisConfirmed(false);
              }}
              className="text-[11px] font-mono font-bold uppercase border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-3.5 py-1.5 rounded-xl transition cursor-pointer"
            >
              Batal
            </button>
          </div>

          {/* Form Pelanggan */}
          <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-850 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Kategori Pembeli</label>
              <div className="flex items-center space-x-2">
                <span className={`text-[11px] font-mono transition-colors ${!isMember ? 'text-white font-bold' : 'text-zinc-500'}`}>Reguler</span>
                <button
                  type="button"
                  onClick={() => handleToggleMember(!isMember)}
                  className={`w-10 h-5.5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-300 ${isMember ? 'bg-white justify-end' : 'bg-zinc-800 justify-start'}`}
                >
                  <span className={`w-4.5 h-4.5 rounded-full shadow-md transform transition-all duration-300 ${isMember ? 'bg-black' : 'bg-zinc-400'}`}></span>
                </button>
                <span className={`text-[11px] font-mono transition-colors ${isMember ? 'text-white font-bold' : 'text-zinc-500'}`}>Member</span>
              </div>
            </div>

            {!isMember ? (
              <div className="space-y-1">
                <label htmlFor="buyer-name" className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Nama Pemesan
                </label>
                <div className="relative">
                  <User size={13} className="absolute left-3.5 top-3.5 text-zinc-500" />
                  <input
                    id="buyer-name"
                    type="text"
                    placeholder="Masukkan nama pemesan (misal: Budi / Meja 3)..."
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full bg-black border border-zinc-800 text-white pl-9 pr-3 py-2.5 rounded-xl font-sans text-xs focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-zinc-600"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">Pilih Akun Member</label>
                
                {/* Search Member input */}
                <div className="relative">
                  <Search size={13} className="absolute left-3.5 top-3.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Cari nama atau no HP member..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="w-full bg-black border border-zinc-800 text-white pl-9 pr-3 py-2.5 rounded-xl font-sans text-xs focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                </div>

                {/* Member selection area */}
                <div className="max-h-24 overflow-y-auto border border-zinc-800 rounded-xl bg-black/45 p-1 space-y-1">
                  {filteredMembers.length === 0 ? (
                    <p className="text-[10px] text-zinc-500 text-center py-2.5 font-sans">Member tidak ditemukan</p>
                  ) : (
                    filteredMembers.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMemberId(m.id);
                          setBuyerName(m.name); // automatically sync buyer name
                        }}
                        className={`w-full text-left p-2 rounded-lg font-sans text-xs flex items-center justify-between transition-all duration-200 ${
                          selectedMemberId === m.id ? 'bg-white text-black font-semibold' : 'hover:bg-zinc-900 text-zinc-400'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <User size={11} className={selectedMemberId === m.id ? 'text-black' : 'text-zinc-500'} />
                          <span>{m.name}</span>
                        </div>
                        <span className={`font-mono text-[9px] ${selectedMemberId === m.id ? 'text-zinc-600 font-bold' : 'text-zinc-500'}`}>{m.phone}</span>
                      </button>
                    ))
                  )}
                </div>

                {selectedMember && (
                  <div className="flex items-center space-x-2 bg-emerald-950/20 border border-emerald-900/40 p-2.5 rounded-xl text-emerald-400">
                    <Check size={12} strokeWidth={3} />
                    <span className="text-[11px] font-sans">Terpilih: <strong className="text-white">{selectedMember.name}</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pemilihan Menu & Cart */}
          <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-850 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Pilih Menu</label>
              {/* Menu Search */}
              <div className="relative w-1/2">
                <Search size={11} className="absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Cari..."
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  className="w-full bg-black border border-zinc-800 text-white pl-8 pr-2 py-2 rounded-xl font-sans text-xs focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>
            </div>

            {/* Menu categories tabs */}
            <div className="flex space-x-1.5 overflow-x-auto pb-1.5 scrollbar-none">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap cursor-pointer transition-all ${
                    activeCategory === cat ? 'bg-white text-black font-semibold' : 'bg-black border border-zinc-800 hover:bg-zinc-900 text-zinc-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {filteredMenuItems.length === 0 ? (
                <p className="col-span-2 text-xs text-zinc-500 text-center py-4 font-sans">Menu tidak tersedia</p>
              ) : (
                filteredMenuItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="flex flex-col justify-between items-start p-3 bg-black hover:bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 rounded-xl text-left transition-all duration-200 cursor-pointer"
                  >
                    <span className="font-sans text-xs font-semibold text-zinc-200 line-clamp-1">{item.name}</span>
                    <div className="flex items-center justify-between w-full mt-2">
                      <span className="font-mono text-[9px] text-zinc-500 uppercase">{item.category}</span>
                      <span className="font-mono text-xs font-bold text-white">{formatPrice(item.price)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Cart Details */}
          {cart.length > 0 && (
            <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-850 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Daftar Pesanan ({cart.length})</span>
                <button
                  onClick={() => setCart([])}
                  className="text-[10px] font-mono font-bold text-red-400 uppercase flex items-center hover:text-red-300 transition-colors"
                >
                  <Trash2 size={10} className="mr-1" /> Bersihkan
                </button>
              </div>

              {/* Cart Items List */}
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.menuItem.id} className="border-b border-zinc-800/60 pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="text-xs font-sans font-bold text-zinc-100">{item.menuItem.name}</span>
                        <div className="text-[11px] font-mono text-zinc-400">
                          {formatPrice(item.menuItem.price)} × {item.quantity} = {formatPrice(item.menuItem.price * item.quantity)}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 bg-black border border-zinc-800 px-1.5 py-1 rounded-xl">
                        <button
                          onClick={() => updateQuantity(item.menuItem.id, -1)}
                          className="text-zinc-400 hover:bg-zinc-900 p-0.5 rounded transition text-zinc-400 hover:text-white"
                        >
                          <Minus size={11} strokeWidth={3} />
                        </button>
                        <span className="font-mono text-xs font-bold w-4 text-center text-white">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.menuItem.id, 1)}
                          className="text-zinc-400 hover:bg-zinc-900 p-0.5 rounded transition text-zinc-400 hover:text-white"
                        >
                          <Plus size={11} strokeWidth={3} />
                        </button>
                      </div>
                    </div>

                    {/* Note Input */}
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Catatan (misal: Es sedikit, gula aren dikurangi)..."
                        value={item.note}
                        onChange={(e) => updateNote(item.menuItem.id, e.target.value)}
                        className="w-full bg-black border border-zinc-800 hover:border-zinc-700 focus:border-zinc-600 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-sans focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Invoice Summary */}
              <div className="border-t border-zinc-800 pt-3.5 space-y-1.5">
                <div className="flex justify-between items-center text-zinc-400 text-xs font-sans">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium">{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-white border-t border-zinc-850 pt-2.5">
                  <span className="uppercase tracking-wider font-mono text-[10px] text-zinc-400">Total Pembayaran</span>
                  <span className="text-base font-display font-black text-white">{formatPrice(cartTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Form Pembayaran */}
          {cart.length > 0 && (
            <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-850 shadow-sm space-y-4">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">Metode Pembayaran</label>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  className={`py-2.5 px-2 rounded-xl border font-mono text-[11px] flex items-center justify-center space-x-1.5 transition duration-200 cursor-pointer ${
                    paymentMethod === 'Cash'
                      ? 'bg-white text-black border-white font-bold shadow-sm'
                      : 'bg-black text-zinc-400 border-zinc-800 hover:bg-zinc-900'
                  }`}
                >
                  <DollarSign size={13} />
                  <span>CASH</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('QRIS')}
                  className={`py-2.5 px-2 rounded-xl border font-mono text-[11px] flex items-center justify-center space-x-1.5 transition duration-200 cursor-pointer ${
                    paymentMethod === 'QRIS'
                      ? 'bg-white text-black border-white font-bold shadow-sm'
                      : 'bg-black text-zinc-400 border-zinc-800 hover:bg-zinc-900'
                  }`}
                >
                  <CreditCard size={13} />
                  <span>QRIS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('Bayar Nanti')}
                  className={`py-2.5 px-2 rounded-xl border font-mono text-[11px] flex items-center justify-center space-x-1.5 transition duration-200 cursor-pointer ${
                    paymentMethod === 'Bayar Nanti'
                      ? 'bg-amber-400 text-black border-amber-400 font-bold shadow-sm'
                      : 'bg-black text-zinc-400 border-zinc-800 hover:bg-zinc-900'
                  }`}
                >
                  <Clock size={13} />
                  <span>BAYAR NANTI</span>
                </button>

                <button
                  type="button"
                  disabled={!isMember}
                  onClick={() => setPaymentMethod('Member Tab')}
                  className={`py-2.5 px-2 rounded-xl border font-mono text-[11px] flex items-center justify-center space-x-1.5 transition duration-200 ${
                    !isMember
                      ? 'opacity-25 bg-zinc-950 border-zinc-900 text-zinc-600 cursor-not-allowed'
                      : paymentMethod === 'Member Tab'
                      ? 'bg-white text-black border-white font-bold shadow-sm cursor-pointer'
                      : 'bg-black text-zinc-400 border-zinc-800 hover:bg-zinc-900 cursor-pointer'
                  }`}
                >
                  <BookOpen size={13} />
                  <span>MEMBER TAB</span>
                </button>
              </div>

              {/* Conditional Input based on Payment Method */}
              {paymentMethod === 'Cash' && (
                <div className="space-y-3 bg-black/40 p-4 rounded-xl border border-zinc-800">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center mb-1.5">
                      <label htmlFor="cash-received" className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Uang Diterima</label>
                      <div className="flex space-x-1">
                        {[10000, 20000, 50000, 100000].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCashReceived(val.toString())}
                            className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer"
                          >
                            {val / 1000}k
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 font-mono text-sm text-zinc-500 font-bold">Rp</span>
                      <input
                        id="cash-received"
                        type="number"
                        placeholder="0"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        className="w-full bg-black border border-zinc-800 pl-9 pr-3 py-2.5 rounded-xl font-mono text-sm focus:outline-none focus:border-zinc-500 text-white"
                      />
                    </div>
                  </div>

                  {parseFloat(cashReceived) > 0 && (
                    <div className="flex justify-between items-center border-t border-zinc-800 pt-2.5 font-mono text-xs">
                      <span className="text-zinc-400 uppercase tracking-wider font-bold">Kembalian</span>
                      <span className={`text-sm font-bold ${changeDue >= 0 && parseFloat(cashReceived) >= cartTotal ? 'text-emerald-400' : 'text-red-400'}`}>
                        {parseFloat(cashReceived) < cartTotal ? 'Kurang Pembayaran' : formatPrice(changeDue)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'QRIS' && (
                <div className="bg-black/40 p-4 rounded-2xl border border-zinc-800 space-y-4">
                  {/* Inline Clean QR Code directly in the form */}
                  <div className="flex flex-col items-center">
                    <QrisPoster
                      amount={cartTotal}
                      size={170}
                      onExpand={() => setShowQrisModal(true)}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-zinc-400">Status Pembayaran:</span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      qrisConfirmed ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                    }`}>
                      {qrisConfirmed ? 'LUNAS (TERKONFIRMASI)' : 'MENUNGGU SCAN PELANGGAN'}
                    </span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setQrisConfirmed(!qrisConfirmed)}
                    className={`w-full py-3 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer border shadow-sm ${
                      qrisConfirmed
                        ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400'
                        : 'bg-white hover:bg-zinc-100 text-black border-white'
                    }`}
                  >
                    <Check size={14} className={qrisConfirmed ? 'text-emerald-400' : 'text-black'} strokeWidth={2.5} />
                    <span>{qrisConfirmed ? 'Dikonfirmasi Karyawan (Lunas)' : 'Konfirmasi Pembayaran QRIS'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQrisModal(true)}
                    className="w-full text-[10px] text-zinc-400 hover:text-zinc-200 underline font-mono text-center flex items-center justify-center space-x-1 cursor-pointer pt-1"
                  >
                    <Maximize2 size={11} />
                    <span>Buka Layar Penuh QRIS untuk Pelanggan</span>
                  </button>
                </div>
              )}

              {paymentMethod === 'Bayar Nanti' && (
                <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-900/40 text-left space-y-2">
                  <div className="flex items-center space-x-2 text-amber-400 font-mono text-xs font-bold">
                    <Clock size={14} />
                    <span className="uppercase tracking-wider">BAYAR NANTI</span>
                  </div>
                  <p className="text-[11px] font-sans text-amber-200/90 leading-relaxed">
                    Pesanan akan dicatat sebagai <strong>Belum Bayar</strong>. Pelanggan wajib melunasi pesanan ini hari ini (bisa via Cash atau QRIS).
                  </p>
                  <p className="text-[10px] font-mono text-amber-400/80 bg-black/40 p-2 rounded-lg border border-amber-900/30">
                    ⚠️ <strong>Aturan Tutup Kasir:</strong> Anda tidak akan bisa melakukan <em>Close Register</em> sebelum semua pesanan "Bayar Nanti" dilunasi.
                  </p>
                </div>
              )}

              {paymentMethod === 'Member Tab' && (
                <div className="bg-emerald-950/20 p-4 rounded-xl border border-emerald-900/30 text-center">
                  <p className="text-[11px] font-sans text-emerald-400 leading-relaxed">
                    <strong>Penting:</strong> Pembayaran ini ditumpuk/dimasukkan ke saldo tagihan member <strong>{selectedMember?.name}</strong>. Tagihan dapat dibayarkan kapan saja oleh member.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Final Button */}
          <button
            onClick={handleCompleteOrder}
            disabled={!isCartValid || !isPaymentValid}
            className={`w-full py-4 rounded-xl font-mono font-bold uppercase tracking-wider text-sm transition-all duration-300 shadow-md ${
              isCartValid && isPaymentValid
                ? 'bg-white hover:bg-zinc-100 text-black cursor-pointer active:scale-[0.98]'
                : 'bg-zinc-900 text-zinc-600 border border-zinc-850 cursor-not-allowed'
            }`}
          >
            Selesai & Kirim Ke Antrean
          </button>
        </div>
      )}

      {/* QRIS Modal */}
      {showQrisModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all animate-fade-in overflow-y-auto">
          <div className="bg-zinc-900 rounded-3xl w-full max-w-md p-5 shadow-2xl border border-zinc-800 text-center flex flex-col items-center space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="w-full flex justify-between items-center border-b border-zinc-800 pb-2">
              <span className="font-mono font-bold text-white tracking-wider text-xs uppercase">Scan QRIS Pembayaran</span>
              <button
                onClick={() => setShowQrisModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Clean QR Code Component */}
            <div className="w-full py-2">
              <QrisPoster
                amount={cartTotal}
                size={230}
              />
            </div>

            <button
              onClick={() => setShowQrisModal(false)}
              className="w-full bg-white hover:bg-zinc-100 text-black font-mono text-xs font-bold py-3 rounded-xl uppercase tracking-wider transition cursor-pointer"
            >
              Tutup QRIS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
