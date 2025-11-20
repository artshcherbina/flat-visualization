import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { Upload, FileText, Play, Download, CheckCircle, AlertCircle, Loader2, Package, RefreshCw, SlidersHorizontal, Hash } from 'lucide-react';
import { BatchItem, GeneratedImage } from '../types';
import { generateImagePrompts, generateRealEstateImage } from '../services/geminiService';

export const BatchProcessor: React.FC = () => {
  const [step, setStep] = useState<'upload' | 'config' | 'processing'>('upload');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  // Column selections
  const [selectedColumn, setSelectedColumn] = useState<string>(''); // Description
  const [selectedIdColumn, setSelectedIdColumn] = useState<string>(''); // ID (Optional)

  const [items, setItems] = useState<BatchItem[]>([]);
  const [isZipping, setIsZipping] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [limit, setLimit] = useState<number>(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setCsvData(results.data);
          setLimit(results.data.length);
          
          const keys = Object.keys(results.data[0] as object);
          setHeaders(keys);
          setStep('config');
          
          // Auto-detect Description column
          const likelyDesc = keys.find(h => 
            h.toLowerCase().includes('description') || h.toLowerCase().includes('описание')
          );
          if (likelyDesc) setSelectedColumn(likelyDesc);

          // Auto-detect ID column
          const likelyId = keys.find(h => 
            ['id', 'sku', 'code', 'ref', 'номер', 'артикул', 'код'].some(k => h.toLowerCase().includes(k))
          );
          if (likelyId) setSelectedIdColumn(likelyId);
        }
      },
      error: (error: any) => {
        console.error("CSV Parse error:", error);
        alert("Ошибка при чтении CSV файла");
      }
    });
  };

  const startBatchGeneration = async () => {
    if (!selectedColumn) return;

    // Apply limit
    const dataToProcess = csvData.slice(0, limit);

    const newItems: BatchItem[] = dataToProcess.map((row, idx) => ({
      id: `batch-${idx}`,
      externalId: selectedIdColumn ? row[selectedIdColumn] : undefined,
      originalDescription: row[selectedColumn],
      status: 'pending',
      images: []
    }));

    setItems(newItems);
    setStep('processing');
    
    let completedCount = 0;

    // Process ITEMS sequentially
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'processing' } : it));

      try {
        // 1. Generate Prompts
        const plans = await generateImagePrompts(item.originalDescription);
        
        const initialImages: GeneratedImage[] = plans.map((plan, pIdx) => ({
          id: `${item.id}-img-${pIdx}`,
          label: plan.label,
          prompt: plan.prompt,
          base64: null,
          status: 'loading'
        }));

        // Update UI with placeholders
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, images: initialImages } : it));

        // 2. Generate Images Sequentially (Crucial for preventing 429)
        const finalImages: GeneratedImage[] = [];
        
        for (const img of initialImages) {
            let base64 = null;
            let status: 'success' | 'error' = 'error';
            
            // Retry loop for rate limits
            for (let attempt = 0; attempt < 4; attempt++) {
                try {
                    base64 = await generateRealEstateImage(img.prompt);
                    status = 'success';
                    break;
                } catch (e: any) {
                     const isRateLimit = e.message?.includes('429') || e.status === 429 || JSON.stringify(e).includes('429');
                     if (isRateLimit) {
                         console.warn(`Rate limit hit for image ${img.id}. Waiting...`);
                         // Exponential backoff: 10s, 20s, 30s
                         await new Promise(r => setTimeout(r, 10000 * (attempt + 1)));
                     } else {
                         console.error("Non-retriable error:", e);
                         break; 
                     }
                }
            }

            finalImages.push({ ...img, base64, status });

            // Update state after each image
            setItems(prev => prev.map(it => {
                if (it.id !== item.id) return it;
                const currentImages = [...finalImages, ...initialImages.slice(finalImages.length)];
                return { ...it, images: currentImages };
            }));

            // Artificial delay between successful requests
            if (status === 'success') {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        
        setItems(prev => prev.map(it => 
          it.id === item.id 
            ? { ...it, status: 'completed', images: finalImages } 
            : it
        ));

      } catch (err) {
        console.error(err);
        setItems(prev => prev.map(it => 
          it.id === item.id 
            ? { ...it, status: 'error', error: 'Не удалось обработать описание' } 
            : it
        ));
      }

      completedCount++;
      setOverallProgress(Math.round((completedCount / newItems.length) * 100));
      
      // Delay between different items
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  };

  const downloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const rootFolder = zip.folder("dreamhome_batch_results");

      items.forEach((item, index) => {
        if (item.status === 'completed' || (item.images.some(img => img.status === 'success'))) {
          
          // Determine Folder Name
          let folderName = "";
          if (item.externalId) {
              // Sanitize user ID for folder name
              const safeId = String(item.externalId).replace(/[^a-zа-я0-9\-_]/gi, '_').trim();
              folderName = safeId || `Lot_${index + 1}`;
          } else {
              const safeDesc = item.originalDescription.slice(0, 20).replace(/[^a-zа-я0-9]/gi, '_');
              folderName = `Lot_${index + 1}_${safeDesc}`;
          }
          
          const itemFolder = rootFolder?.folder(folderName);

          item.images.forEach((img, imgIndex) => {
            if (img.base64) {
              // Remove data:image/jpeg;base64, prefix
              const data = img.base64.split(',')[1];
              
              // Construct File Name: {ID}_{Index}_{Label}.jpg
              const idPart = item.externalId 
                ? String(item.externalId).replace(/[^a-zа-я0-9\-_]/gi, '_').trim() 
                : (index + 1).toString();
                
              const labelPart = img.label.replace(/[^a-zа-я0-9]/gi, '_');
              
              const fileName = `${idPart}_${imgIndex + 1}_${labelPart}.jpg`;
              
              itemFolder?.file(fileName, data, { base64: true });
            }
          });
        }
      });

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = "dreamhome_results.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error("Zip error", e);
      alert("Ошибка при создании архива");
    } finally {
      setIsZipping(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setCsvData([]);
    setItems([]);
    setOverallProgress(0);
    setLimit(0);
    setSelectedColumn('');
    setSelectedIdColumn('');
  };

  // RENDERERS
  
  const renderUpload = () => (
    <div className="max-w-xl mx-auto text-center py-12">
      <div 
        className="border-2 border-dashed border-slate-300 rounded-2xl p-12 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-indigo-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Загрузите CSV файл</h3>
        <p className="text-slate-500 text-sm mb-6">
          Файл должен содержать колонку с описанием объектов недвижимости.
        </p>
        <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
          Выбрать файл
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          accept=".csv" 
          className="hidden" 
          onChange={handleFileUpload}
        />
      </div>
    </div>
  );

  const renderConfig = () => (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8 mt-8">
      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
        <Package className="w-5 h-5 text-indigo-600" />
        Настройка генерации
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Description Column Selector */}
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400"/>
                Колонка описания *
            </label>
            <select 
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border"
            >
                <option value="" disabled>-- Выберите колонку --</option>
                {headers.map(h => (
                <option key={h} value={h}>{h}</option>
                ))}
            </select>
        </div>

        {/* ID Column Selector */}
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Hash className="w-4 h-4 text-slate-400"/>
                Колонка ID (Опционально)
            </label>
            <select 
                value={selectedIdColumn}
                onChange={(e) => setSelectedIdColumn(e.target.value)}
                className="w-full border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border"
            >
                <option value="">-- Авто (Порядковый номер) --</option>
                {headers.map(h => (
                <option key={h} value={h}>{h}</option>
                ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">Используется для имен папок и файлов.</p>
        </div>
      </div>

      {selectedColumn && (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2 flex justify-between">
                <span>Количество объектов для обработки</span>
                <span className="text-indigo-600 font-bold">{limit}</span>
            </label>
            <div className="flex items-center gap-4">
                <SlidersHorizontal className="w-5 h-5 text-slate-400" />
                <input 
                  type="range" 
                  min="1" 
                  max={csvData.length} 
                  value={limit} 
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="flex-grow h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden w-20">
                     <input 
                        type="number"
                        min="1"
                        max={csvData.length}
                        value={limit}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) setLimit(Math.min(Math.max(1, val), csvData.length));
                        }}
                        className="w-full p-2 text-center text-sm focus:outline-none"
                     />
                </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
                Будет обработано {limit} из {csvData.length} записей (всего {limit * 5} изображений).
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mb-8">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Предпросмотр (первые 3 записи)</h4>
            <div className="space-y-3">
              {csvData.slice(0, 3).map((row, idx) => (
                <div key={idx} className="text-sm text-slate-700 border-l-2 border-indigo-300 pl-3 py-1">
                  <div className="flex gap-2 items-center mb-1">
                    <span className="font-bold bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded">
                        {selectedIdColumn ? row[selectedIdColumn] : `#${idx + 1}`}
                    </span>
                  </div>
                  <div className="line-clamp-2 text-slate-600">{row[selectedColumn]}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-3">
        <button 
          onClick={reset}
          className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
        >
          Назад
        </button>
        <button 
          onClick={startBatchGeneration}
          disabled={!selectedColumn}
          className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" />
          Начать генерацию
        </button>
      </div>
    </div>
  );

  const renderProcessing = () => (
    <div className="max-w-4xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Пакетная обработка</h3>
          <p className="text-sm text-slate-500">
             {overallProgress === 100 ? "Готово!" : "Генерация изображений..."} {overallProgress}%
          </p>
        </div>
        <div className="flex gap-3">
          {overallProgress === 100 && (
            <button 
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Новый файл
            </button>
          )}
          <button
            onClick={downloadZip}
            disabled={overallProgress === 0 || isZipping}
            className="bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm flex items-center gap-2 transition-all"
          >
            {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Скачать Архив (ZIP)
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-slate-200 rounded-full mb-8 overflow-hidden">
        <div 
          className="h-full bg-indigo-600 transition-all duration-500 ease-out"
          style={{ width: `${overallProgress}%` }}
        ></div>
      </div>

      {/* Items List */}
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {item.status === 'pending' && <div className="w-6 h-6 rounded-full border-2 border-slate-200"></div>}
                {item.status === 'processing' && <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />}
                {item.status === 'completed' && <CheckCircle className="w-6 h-6 text-green-500" />}
                {item.status === 'error' && <AlertCircle className="w-6 h-6 text-red-500" />}
                
                <div>
                    <h4 className="font-medium text-slate-900 flex items-center gap-2">
                        {item.externalId ? (
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold">
                                {item.externalId}
                            </span>
                        ) : (
                            <span>Объект #{item.id.split('-')[1]}</span>
                        )}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-1 max-w-md">{item.originalDescription}</p>
                </div>
              </div>
              <div className="text-xs font-medium px-2 py-1 bg-slate-100 rounded-md text-slate-600">
                {item.images.filter(i => i.status === 'success').length} / 5
              </div>
            </div>

            {/* Thumbnails Grid */}
            {item.images.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {item.images.map((img) => (
                  <div key={img.id} className="aspect-video bg-slate-100 rounded-md overflow-hidden relative group">
                     {img.status === 'loading' ? (
                         <div className="w-full h-full flex items-center justify-center">
                             <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                         </div>
                     ) : img.status === 'success' && img.base64 ? (
                        <img src={img.base64} alt={img.label} className="w-full h-full object-cover" />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-400">
                            <AlertCircle className="w-4 h-4" />
                        </div>
                     )}
                     
                     {/* Tooltip */}
                     <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-end justify-center pb-1">
                         <span className="text-[10px] text-white opacity-0 group-hover:opacity-100 font-medium truncate max-w-full px-1">
                            {img.label}
                         </span>
                     </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-[600px]">
      {step === 'upload' && renderUpload()}
      {step === 'config' && renderConfig()}
      {step === 'processing' && renderProcessing()}
    </div>
  );
};