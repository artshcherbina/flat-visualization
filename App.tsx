import { AlertTriangle, Layers, Layout } from 'lucide-react';
import React, { useState } from 'react';
import { BatchProcessor } from './components/BatchProcessor';
import { Header } from './components/Header';
import { InputSection } from './components/InputSection';
import { ResultsGrid } from './components/ResultsGrid';
import { generateImagePrompts, generateRealEstateImage } from './services/geminiService';
import { GeneratedImage, GenerationStatus } from './types';

const App: React.FC = () => {
  // App Mode State
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  // Single Mode State
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Helper to wait
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // --- Single Mode Logic ---
  const handleSingleGenerate = async (description: string, imageCount: number = 5) => {
    setStatus(GenerationStatus.GENERATING_PROMPTS);
    setError(null);
    setImages([]);

    try {
      const plans = await generateImagePrompts(description, imageCount);

      const initialImages: GeneratedImage[] = plans.map((plan, idx) => ({
        id: `img-${Date.now()}-${idx}`,
        label: plan.label,
        prompt: plan.prompt,
        base64: null,
        status: 'pending'
      }));
      setImages(initialImages);
      setStatus(GenerationStatus.GENERATING_IMAGES);

      // Process ALL images in PARALLEL for faster generation
      const imagePromises = initialImages.map(img => generateSingleImage(img.id, img.prompt));
      await Promise.allSettled(imagePromises);

      setStatus(GenerationStatus.COMPLETED);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Неизвестная ошибка при планировании");
      setStatus(GenerationStatus.ERROR);
    }
  };

  const generateSingleImage = async (id: string, prompt: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'loading' } : img));

    try {
      const base64 = await generateRealEstateImage(prompt);
      setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'success', base64 } : img));
    } catch (err) {
      console.error(`Failed to generate image ${id}`, err);
      setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'error' } : img));
    }
  };

  const handleRetry = (id: string, prompt: string) => {
    generateSingleImage(id, prompt);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />

      {/* Tab Switcher */}
      <div className="max-w-7xl mx-auto px-4 mt-6 w-full flex justify-center">
        <div className="bg-white p-1 rounded-xl border border-slate-200 inline-flex shadow-sm">
          <button
            onClick={() => setMode('single')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'single'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
          >
            <Layout className="w-4 h-4" />
            Один объект
          </button>
          <button
            onClick={() => setMode('batch')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'batch'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
          >
            <Layers className="w-4 h-4" />
            Пакетная загрузка (CSV)
          </button>
        </div>
      </div>

      <main className="flex-grow flex flex-col pb-12">

        {/* Single Mode UI */}
        {mode === 'single' && (
          <>
            <InputSection
              onGenerate={handleSingleGenerate}
              isProcessing={status === GenerationStatus.GENERATING_PROMPTS || status === GenerationStatus.GENERATING_IMAGES}
            />

            {error && (
              <div className="max-w-md mx-auto mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <ResultsGrid
              images={images}
              status={status}
              onRetry={handleRetry}
            />
          </>
        )}

        {/* Batch Mode UI */}
        {mode === 'batch' && (
          <div className="max-w-7xl mx-auto px-4 w-full">
            <BatchProcessor />
          </div>
        )}

      </main>

      <footer className="py-6 text-center text-slate-400 text-sm border-t border-slate-200 bg-white mt-auto">
        <p>© {new Date().getFullYear()} DreamHome AI. Powered by Gemini & Nano Banana.</p>
      </footer>
    </div>
  );
};

export default App;