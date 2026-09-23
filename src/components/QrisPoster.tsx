/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Maximize2, Trash2, RefreshCw, X, Image as ImageIcon } from 'lucide-react';

interface QrisPosterProps {
  amount?: number;
  onExpand?: () => void;
  size?: number;
}

export const STORAGE_QRIS_KEY = 'wtm_custom_qris_image';

export default function QrisPoster({ amount, onExpand, size = 180 }: QrisPosterProps) {
  const [qrisImage, setQrisImage] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_QRIS_KEY);
  });
  const [isZoomed, setIsZoomed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync if another tab or component updates the QRIS image
  useEffect(() => {
    const handleStorageChange = () => {
      setQrisImage(localStorage.getItem(STORAGE_QRIS_KEY));
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('qris_image_updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('qris_image_updated', handleStorageChange);
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          localStorage.setItem(STORAGE_QRIS_KEY, base64);
          setQrisImage(base64);
          window.dispatchEvent(new Event('qris_image_updated'));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Apakah Anda yakin ingin menghapus foto QRIS ini?')) {
      localStorage.removeItem(STORAGE_QRIS_KEY);
      setQrisImage(null);
      window.dispatchEvent(new Event('qris_image_updated'));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex flex-col items-center justify-center select-none w-full max-w-sm mx-auto">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {qrisImage ? (
        /* JIKA SUDAH ADA FOTO QRIS YANG DIUPLOAD */
        <div className="w-full flex flex-col items-center">
          {/* Header Action Bar */}
          <div className="w-full flex items-center justify-between px-1 mb-2">
            <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider flex items-center">
              <ImageIcon size={12} className="mr-1 text-emerald-400" />
              Foto QRIS Toko
            </span>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-[10px] font-mono font-bold flex items-center space-x-1 transition cursor-pointer border border-zinc-700"
                title="Ganti Foto QRIS"
              >
                <RefreshCw size={11} />
                <span>Ganti</span>
              </button>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="p-1 bg-zinc-900 hover:bg-red-950/80 text-zinc-500 hover:text-red-400 rounded-lg text-[10px] transition cursor-pointer border border-zinc-800 hover:border-red-800"
                title="Hapus Foto QRIS"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* QRIS Image Container */}
          <div className="w-full bg-white p-2 rounded-2xl shadow-xl border border-zinc-200 relative group overflow-hidden flex flex-col items-center">
            <img
              src={qrisImage}
              alt="QRIS Merchant"
              style={{ maxHeight: size > 200 ? '340px' : '220px' }}
              className="w-full object-contain rounded-xl"
            />

            {/* Hover / Click Overlay to Zoom */}
            <button
              type="button"
              onClick={() => {
                if (onExpand) {
                  onExpand();
                } else {
                  setIsZoomed(true);
                }
              }}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white rounded-2xl transition-all duration-200 cursor-pointer"
              title="Perbesar Tampilan QRIS"
            >
              <Maximize2 size={24} className="mb-1 drop-shadow" />
              <span className="text-[10px] font-mono font-bold uppercase bg-black/80 px-2.5 py-0.5 rounded-md">
                Perbesar
              </span>
            </button>
          </div>

          {/* Amount Badge if provided */}
          {amount && amount > 0 && (
            <div className="mt-2.5 bg-zinc-900 text-white px-4 py-1.5 rounded-full font-mono text-xs font-bold border border-zinc-800 shadow-md flex items-center space-x-2">
              <span className="text-zinc-400 text-[10px] uppercase tracking-wider">Total Tagihan:</span>
              <span className="text-emerald-400 text-xs sm:text-sm font-black">{formatPrice(amount)}</span>
            </div>
          )}
        </div>
      ) : (
        /* JIKA BELUM ADA QRIS: MENU UPLOAD FILE QRIS */
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-zinc-700 hover:border-emerald-500 bg-zinc-900/80 hover:bg-zinc-850 p-6 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group shadow-inner"
        >
          <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-emerald-950/80 text-zinc-400 group-hover:text-emerald-400 border border-zinc-700 group-hover:border-emerald-700/50 flex items-center justify-center mb-3 transition-colors">
            <UploadCloud size={24} />
          </div>
          <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-1 group-hover:text-emerald-400 transition-colors">
            Upload Foto QRIS Toko
          </h4>
          <p className="text-[10px] text-zinc-400 leading-relaxed max-w-[200px] mb-3">
            Klik di sini untuk memilih file foto/gambar QRIS (JPG, PNG) toko Anda.
          </p>
          <button
            type="button"
            className="px-4 py-1.5 bg-white group-hover:bg-emerald-400 text-black font-mono text-[10px] font-bold uppercase rounded-lg shadow-sm transition"
          >
            Pilih Foto QRIS
          </button>
        </div>
      )}

      {/* Standalone Zoom Modal if onExpand is not passed */}
      {isZoomed && qrisImage && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all animate-fade-in">
          <div className="bg-zinc-900 rounded-3xl w-full max-w-lg p-5 shadow-2xl border border-zinc-800 text-center flex flex-col items-center space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="w-full flex justify-between items-center border-b border-zinc-800 pb-2">
              <span className="font-mono font-bold text-white tracking-wider text-xs uppercase">
                Foto QRIS Toko (Perbesar)
              </span>
              <button
                type="button"
                onClick={() => setIsZoomed(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="w-full bg-white p-3 rounded-2xl flex items-center justify-center">
              <img
                src={qrisImage}
                alt="QRIS Toko"
                className="w-full max-h-[70vh] object-contain rounded-xl"
              />
            </div>

            {amount && amount > 0 && (
              <div className="bg-zinc-950 border border-zinc-800 px-5 py-2 rounded-xl text-center">
                <span className="text-zinc-400 text-[10px] font-mono block uppercase">Total yang Harus Dibayar:</span>
                <span className="text-emerald-400 font-mono font-black text-lg">{formatPrice(amount)}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsZoomed(false)}
              className="w-full bg-white hover:bg-zinc-100 text-black font-mono text-xs font-bold py-3 rounded-xl uppercase tracking-wider transition cursor-pointer"
            >
              Tutup Tampilan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
