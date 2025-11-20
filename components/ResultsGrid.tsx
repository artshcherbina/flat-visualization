import React from 'react';
import { GeneratedImage, GenerationStatus } from '../types';
import { ImageCard } from './ImageCard';

interface ResultsGridProps {
  images: GeneratedImage[];
  status: GenerationStatus;
  onRetry: (id: string, prompt: string) => void;
}

export const ResultsGrid: React.FC<ResultsGridProps> = ({ images, status, onRetry }) => {
  if (status === GenerationStatus.IDLE && images.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-800">Результат визуализации</h3>
        <span className="text-sm text-slate-500">
            {images.filter(i => i.status === 'success').length} / {images.length} готово
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Exterior Shot - Featured larger on desktop? Let's keep uniform for simplicity first, maybe span 2 for first one */}
        {images.map((img, index) => (
          <div 
            key={img.id} 
            className={`${index === 0 ? 'sm:col-span-2 lg:col-span-2 lg:row-span-2 aspect-video sm:aspect-auto' : ''}`}
          >
             <div className="h-full">
                 <ImageCard image={img} index={index} onRetry={onRetry} />
             </div>
          </div>
        ))}
      </div>
    </section>
  );
};
