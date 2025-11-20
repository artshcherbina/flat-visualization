import React, { useState, useCallback } from 'react';
import { Wand2 } from 'lucide-react';

interface InputSectionProps {
  onGenerate: (description: string) => void;
  isProcessing: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({ onGenerate, isProcessing }) => {
  const [text, setText] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onGenerate(text);
    }
  }, [text, onGenerate]);

  const handleExampleClick = (example: string) => {
    setText(example);
  };

  const examples = [
    "Современная квартира в стиле лофт в центре Москвы, кирпичные стены, большие окна, открытая планировка.",
    "Уютный загородный дом в скандинавском стиле, светлое дерево, камин, панорамные окна с видом на лес.",
    "Роскошный пентхаус в Дубае, золото и мрамор, вид на Бурдж-Халифа, бассейн на террасе."
  ];

  return (
    <section className="max-w-3xl mx-auto mt-12 px-4 text-center">
      <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
        Создайте визуализацию вашей мечты
      </h2>
      <p className="text-lg text-slate-600 mb-8">
        Опишите квартиру, и ИИ создаст 5 уникальных изображений: интерьер, экстерьер и детали.
      </p>

      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-200"></div>
        <div className="relative flex flex-col md:flex-row gap-2 bg-white p-2 rounded-xl shadow-xl border border-slate-100">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Например: Светлая трехкомнатная квартира в стиле минимализм..."
            className="flex-grow p-4 bg-transparent border-none focus:ring-0 text-slate-800 placeholder-slate-400 resize-none h-24 md:h-auto outline-none"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!text.trim() || isProcessing}
            className="md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-8 py-3 rounded-lg font-medium transition-all active:scale-95"
          >
            {isProcessing ? (
              <>
                <span className="animate-pulse">Генерация...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                <span>Создать</span>
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
        <span className="text-slate-500">Попробуйте:</span>
        {examples.map((ex, idx) => (
          <button
            key={idx}
            onClick={() => handleExampleClick(ex)}
            disabled={isProcessing}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-full transition-colors text-xs md:text-sm truncate max-w-[200px] md:max-w-none"
          >
            {ex.slice(0, 40)}...
          </button>
        ))}
      </div>
    </section>
  );
};
