import React, { useState } from 'react';
import { Download, Maximize2, AlertCircle } from 'lucide-react';
import { GeneratedImage } from '../types';
import { LoadingSpinner } from './LoadingSpinner';

interface ImageCardProps {
  image: GeneratedImage;
  index: number;
  onRetry?: (id: string, prompt: string) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({ image, index, onRetry }) => {
  const [isHovered, setIsHovered] = useState(false);

  const downloadImage = () => {
    if (image.base64) {
      const link = document.createElement('a');
      link.href = image.base64;
      link.download = `dreamhome-${image.label}-${index}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Calculate delay for staggered animation
  const animationDelay = `${index * 100}ms`;

  return (
    <div 
      className="relative group rounded-xl overflow-hidden shadow-sm bg-white aspect-[4/3] border border-slate-100"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ animationDelay, animationFillMode: 'both' }}
    >
      {/* Image Area */}
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        {image.status === 'success' && image.base64 ? (
          <img
            src={image.base64}
            alt={image.label}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : image.status === 'error' ? (
          <div className="flex flex-col items-center text-red-500 px-4 text-center">
            <AlertCircle className="w-8 h-8 mb-2" />
            <span className="text-sm font-medium">Ошибка генерации</span>
            {onRetry && (
                <button 
                    onClick={() => onRetry(image.id, image.prompt)}
                    className="mt-2 text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded"
                >
                    Повторить
                </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-slate-400">
            <LoadingSpinner className="w-8 h-8 mb-2 text-indigo-500" />
            <span className="text-xs animate-pulse font-medium">Создаем шедевр...</span>
          </div>
        )}
      </div>

      {/* Overlay Content */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
        <div className="flex justify-between items-end">
            <div className="text-white">
                <h3 className="font-semibold text-lg">{image.label}</h3>
                <p className="text-xs text-white/80 line-clamp-2 max-w-[200px]">{image.prompt}</p>
            </div>
            
            {image.status === 'success' && (
                <div className="flex gap-2">
                    <button 
                        onClick={downloadImage}
                        className="p-2 bg-white/20 backdrop-blur-md hover:bg-white/30 rounded-full text-white transition-colors"
                        title="Скачать"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* Label Tag (Always visible if not hovered, optional) */}
      {!isHovered && image.status === 'success' && (
        <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-md">
          {image.label}
        </div>
      )}
    </div>
  );
};
