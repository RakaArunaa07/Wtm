/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Coffee, Lock, Unlock } from 'lucide-react';

interface HeaderProps {
  isClosed: boolean;
  onReopen?: () => void;
}

export default function Header({ isClosed, onReopen }: HeaderProps) {
  return (
    <header className="bg-black text-white py-5 px-6 border-b border-zinc-900 sticky top-0 z-50">
      <div className="flex items-center justify-between max-w-md mx-auto">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 flex items-center justify-center transition-transform hover:scale-105 duration-300">
            <img src="/logo.svg" alt="Logo Warkop Tengah Malam" className="w-10 h-10 object-contain select-none" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-display font-black tracking-tight text-white leading-none">
              WARKOP TENGAH MALAM
            </h1>
            <span className="text-[9px] text-zinc-500 font-sans uppercase tracking-widest mt-1">
              NONGKRONG GAK HARUS MAHAL
            </span>
          </div>
        </div>
        
        <div className="flex items-center">
          {isClosed ? (
            <div className="flex items-center bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-full text-[10px] text-red-500 font-mono font-bold uppercase tracking-wider">
              <Lock size={11} className="mr-1.5 animate-pulse text-red-500" />
              Closed
            </div>
          ) : (
            <div className="flex items-center bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-full text-[10px] text-emerald-500 font-mono font-bold uppercase tracking-wider">
              <Unlock size={11} className="mr-1.5 animate-pulse text-emerald-500" />
              Open
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
