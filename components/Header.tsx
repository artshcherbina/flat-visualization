import React from 'react';
import { HomeIcon } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-600">
          <HomeIcon className="h-8 w-8" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">DreamHome AI</h1>
        </div>
        <div className="hidden md:flex items-center space-x-4 text-sm font-medium text-slate-500">
          <span>Визуализация</span>
          <span>Интерьер</span>
          <span>Экстерьер</span>
        </div>
      </div>
    </header>
  );
};
