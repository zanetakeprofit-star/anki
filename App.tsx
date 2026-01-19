
import React, { useState, useRef, useMemo } from 'react';
import { performOCR, generateAnkiCard } from './services/aiService';
import { ProcessingState, ImageItem, AnkiCard } from './types';

const App: React.FC = () => {
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [status, setStatus] = useState<ProcessingState>({ step: 'idle', message: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).slice(0, 100); // 限制最多100张
      
      const promises = newFiles.map(file => {
        return new Promise<ImageItem>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve({
              id: Math.random().toString(36).substr(2, 9),
              data: event.target?.result as string,
              status: 'pending'
            });
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(promises).then(items => {
        setImageItems(prev => [...prev, ...items].slice(0, 100));
        setStatus({ step: 'idle', message: `已添加 ${items.length} 张图片` });
      });
    }
  };

  const startBatchProcess = async () => {
    if (imageItems.length === 0 || isProcessing) return;
    
    setIsProcessing(true);
    setStatus({ step: 'processing', message: '正在启动批量处理流水线...' });

    const updatedItems = [...imageItems];

    for (let i = 0; i < updatedItems.length; i++) {
      if (updatedItems[i].status === 'done') continue;

      try {
        // 更新状态为处理中
        updatedItems[i].status = 'processing';
        setImageItems([...updatedItems]);
        setStatus({ 
          step: 'processing', 
          message: `正在处理第 ${i + 1}/${updatedItems.length} 张图片...` 
        });

        // 步骤 1: OCR
        const rawText = await performOCR(updatedItems[i].data);
        
        // 步骤 2: 生成卡片
        const card = await generateAnkiCard(rawText);
        
        updatedItems[i].card = card;
        updatedItems[i].status = 'done';
      } catch (error: any) {
        console.error(`Error processing image ${i}:`, error);
        updatedItems[i].status = 'error';
        updatedItems[i].errorMessage = error.message;
      }
      
      setImageItems([...updatedItems]);
    }

    setIsProcessing(false);
    setStatus({ step: 'completed', message: '批量处理任务已完成！' });
  };

  const clearAll = () => {
    if (isProcessing) return;
    setImageItems([]);
    setStatus({ step: 'idle', message: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadAllAnki = () => {
    const successCards = imageItems.filter(item => item.status === 'done' && item.card);
    if (successCards.length === 0) return;

    const fileContent = successCards.map(item => {
      const card = item.card!;
      const cleanFront = card.front.replace(/\t/g, ' ').replace(/\n/g, '<br><br>');
      const cleanBack = card.back.replace(/\t/g, ' ').replace(/\n/g, '<br><br>');
      return `${cleanFront}\t${cleanBack}`;
    }).join('\n');
    
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medical_anki_batch_${new Date().getTime()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const total = imageItems.length;
    const done = imageItems.filter(i => i.status === 'done').length;
    const error = imageItems.filter(i => i.status === 'error').length;
    const pending = imageItems.filter(i => i.status === 'pending' || i.status === 'processing').length;
    return { total, done, error, pending };
  }, [imageItems]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-slate-800 mb-2 flex items-center justify-center gap-3">
          <i className="fas fa-layer-group text-blue-500"></i>
          医学 Anki 批量生成器
        </h1>
        <p className="text-slate-500">支持一次上传 100 张图片，自动生成合并后的 Anki 导入文件</p>
      </header>

      {/* Control Panel */}
      <div className="glass-card rounded-2xl p-6 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-400 uppercase">当前队列</span>
            <span className="text-2xl font-black text-slate-700">{stats.total}<span className="text-sm font-normal text-slate-400 ml-1">/ 100</span></span>
          </div>
          <div className="h-10 w-[1px] bg-slate-200"></div>
          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-xs font-bold text-emerald-500 uppercase">成功</div>
              <div className="text-lg font-bold text-slate-700">{stats.done}</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-rose-500 uppercase">失败</div>
              <div className="text-lg font-bold text-slate-700">{stats.error}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={clearAll}
            disabled={isProcessing || imageItems.length === 0}
            className="px-4 py-2 text-slate-500 hover:text-rose-500 font-medium transition-colors disabled:opacity-30"
          >
            清空列表
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing || imageItems.length >= 100}
            className="px-6 py-2 bg-white border-2 border-blue-500 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all disabled:opacity-50"
          >
            添加图片
          </button>

          <button 
            onClick={startBatchProcess}
            disabled={isProcessing || imageItems.length === 0 || stats.pending === 0}
            className="px-8 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-play"></i>}
            开始批量生成
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <div className="mb-6 bg-white rounded-full h-4 overflow-hidden shadow-inner border border-slate-100">
          <div 
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${(stats.done + stats.error) / stats.total * 100}%` }}
          ></div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Image List */}
        <div className="lg:col-span-8">
          <div className="glass-card rounded-2xl p-6 shadow-sm min-h-[600px]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <i className="fas fa-images text-indigo-500"></i>
                图片队列预览
              </h2>
              <span className="text-sm text-slate-400">{status.message}</span>
            </div>

            {imageItems.length === 0 ? (
              <div 
                className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="fas fa-cloud-upload-alt text-6xl text-slate-200 mb-4"></i>
                <p className="text-slate-400 font-medium">还没有图片，点击或拖拽上传 (最多100张)</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {imageItems.map((item, index) => (
                  <div key={item.id} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                    <img src={item.data} alt="Upload" className="w-full h-full object-cover" />
                    
                    {/* Status Overlay */}
                    <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all ${
                      item.status === 'pending' ? 'bg-black/0 group-hover:bg-black/20' : 
                      item.status === 'processing' ? 'bg-blue-600/60' : 
                      item.status === 'done' ? 'bg-emerald-600/60' : 
                      'bg-rose-600/60'
                    }`}>
                      {item.status === 'processing' && <i className="fas fa-spinner fa-spin text-white text-2xl"></i>}
                      {item.status === 'done' && <i className="fas fa-check-circle text-white text-3xl"></i>}
                      {item.status === 'error' && <i className="fas fa-times-circle text-white text-3xl"></i>}
                      <span className="text-[10px] text-white font-bold mt-2 px-2 py-0.5 bg-black/20 rounded">
                        #{index + 1}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Export & Instructions */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
              <i className="fas fa-file-download text-emerald-500"></i>
              批量导出
            </h2>
            
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-500">可导出卡片：</span>
                <span className="font-bold text-emerald-600">{stats.done} 张</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">失败数量：</span>
                <span className="font-bold text-rose-500">{stats.error} 张</span>
              </div>
            </div>

            <button 
              onClick={downloadAllAnki}
              disabled={stats.done === 0 || isProcessing}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-30 flex flex-col items-center"
            >
              <div className="flex items-center gap-2">
                <i className="fas fa-file-export"></i>
                下载合并后的 Anki 文件
              </div>
              <span className="text-[10px] font-normal opacity-80 mt-1">共计 {stats.done} 条问答记录</span>
            </button>

            <div className="mt-8 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">导入说明</h3>
              <ul className="text-xs text-slate-500 space-y-2">
                <li className="flex gap-2">
                  <span className="font-bold text-blue-500">1.</span>
                  下载的文件为 .txt 格式，包含所有处理成功的图片。
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-500">2.</span>
                  导入 Anki 时，分隔符请务必选择 <b>Tab (制表符)</b>。
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-500">3.</span>
                  务必勾选 <b>"允许字段中使用 HTML"</b>。
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageUpload} 
        className="hidden" 
        accept="image/*" 
        multiple 
      />
    </div>
  );
};

export default App;
