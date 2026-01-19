
import React, { useState, useRef, useMemo } from 'react';
import { performOCR, generateAnkiCard } from './services/aiService';
import { ProcessingState, ImageItem, AnkiCard, ZhipuModel } from './types';

const App: React.FC = () => {
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<ZhipuModel>('glm-4-plus');
  const [status, setStatus] = useState<ProcessingState>({ step: 'idle', message: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewItem, setPreviewItem] = useState<ImageItem | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).slice(0, 100); 
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
        setImageItems(prev => [...prev, ...items]);
        setStatus({ step: 'idle', message: `已导入 ${items.length} 张图片` });
      });
    }
  };

  const startBatchProcess = async () => {
    if (imageItems.length === 0 || isProcessing) return;
    setIsProcessing(true);
    const updatedItems = [...imageItems];

    for (let i = 0; i < updatedItems.length; i++) {
      if (updatedItems[i].status === 'done') continue;
      try {
        updatedItems[i].status = 'processing';
        setImageItems([...updatedItems]);
        setStatus({ step: 'processing', message: `正在调用 ${selectedModel} 处理 (${i + 1}/${updatedItems.length})` });

        const rawText = await performOCR(updatedItems[i].data, selectedModel);
        const card = await generateAnkiCard(rawText, selectedModel);
        
        updatedItems[i].card = card;
        updatedItems[i].status = 'done';
        if (!previewItem) setPreviewItem(updatedItems[i]);
      } catch (error: any) {
        updatedItems[i].status = 'error';
        updatedItems[i].errorMessage = error.message;
      }
      setImageItems([...updatedItems]);
    }
    setIsProcessing(false);
    setStatus({ step: 'completed', message: '批量生成任务已完成' });
  };

  const downloadAllAnki = () => {
    const successCards = imageItems.filter(item => item.status === 'done' && item.card);
    const fileContent = successCards.map(item => {
      const card = item.card!;
      const cleanFront = card.front.replace(/\t/g, ' ').replace(/\n/g, ' ');
      const cleanBack = card.back.replace(/\t/g, ' ').replace(/\n/g, ' ');
      return `${cleanFront}\t${cleanBack}`;
    }).join('\n');
    
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Medical_Anki_Export_${new Date().getTime()}.txt`;
    link.click();
  };

  const stats = useMemo(() => ({
    total: imageItems.length,
    done: imageItems.filter(i => i.status === 'done').length,
    error: imageItems.filter(i => i.status === 'error').length,
    pending: imageItems.filter(i => i.status === 'pending' || i.status === 'processing').length
  }), [imageItems]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-12 text-center relative">
        <div className="absolute top-0 right-0">
          <button 
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <i className={`fas ${showGuide ? 'fa-times' : 'fa-lightbulb'} text-yellow-500`}></i>
            {showGuide ? '关闭指南' : '使用指南'}
          </button>
        </div>
        <div className="inline-block bg-slate-900 text-white px-4 py-1 rounded-full text-xs font-bold mb-4 tracking-widest uppercase">
          Medical Education Expert Edition
        </div>
        <h1 className="text-6xl font-black text-slate-900 mb-4 tracking-tighter">
          医学制卡 <span className="text-yellow-500">PRO</span>
        </h1>
        <p className="text-slate-500 text-xl max-w-2xl mx-auto leading-relaxed">
          采用智谱 <span className="font-bold text-slate-800">GLM-4-Plus</span> 最新架构，支持复杂 HTML 表格还原与多空合并识别。
        </p>
      </header>

      {/* Help Guide Section */}
      {showGuide && (
        <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="glass-card rounded-[2rem] p-8 border-2 border-yellow-100 bg-yellow-50/30 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-camera"></i>
              </div>
              <h3 className="font-black text-slate-800">图片拍摄建议</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                使用<b>充足的光源</b>，避免阴影遮挡文字。确保相机垂直于纸面拍摄。模型对微距拍摄的文字识别率更高。
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-highlighter"></i>
              </div>
              <h3 className="font-black text-slate-800">荧光标记技巧</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                建议使用<b>亮黄色或翠绿色</b>荧光笔。对于表格内容，划出对比项。模型会自动识别并保留表格框架。
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-layer-group"></i>
              </div>
              <h3 className="font-black text-slate-800">关于卡片生成</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                <b>一张图生成一张卡</b>。同一页面内的多个标记会被合并为编号填空 (1)(2)，非常适合记忆复杂的鉴别诊断和机制。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="glass-card rounded-[2.5rem] p-8 shadow-2xl mb-10 border-2 border-slate-100 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">选择驱动模型</label>
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as ZhipuModel)}
              className="h-14 bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 font-bold text-slate-700 focus:border-slate-900 transition-all outline-none appearance-none cursor-pointer pr-10 relative"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 24 24%27 stroke=%27%2364748b%27%3E%3Cpath stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27M19 9l-7 7-7-7%27/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5rem' }}
            >
              <option value="glm-4-plus">GLM-4-Plus (推荐：最新旗舰)</option>
              <option value="glm-4v-plus">GLM-4V-Plus (最强视觉识别)</option>
              <option value="glm-4-flash">GLM-4-Flash (超快响应)</option>
              <option value="glm-4v">GLM-4V (经典视觉模型)</option>
            </select>
          </div>
          
          <div className="h-16 w-px bg-slate-100"></div>

          <div className="flex items-center gap-10">
             <div className="text-center">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">已就绪</span>
                <span className="text-3xl font-black text-slate-900">{stats.total}</span>
             </div>
             <div className="text-center">
                <span className="text-[10px] font-black text-emerald-500 uppercase block mb-1">成功</span>
                <span className="text-3xl font-black text-emerald-600">{stats.done}</span>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => { setImageItems([]); setPreviewItem(null); }}
            className="h-14 px-6 text-slate-400 hover:text-rose-500 font-bold transition-all"
          >
            清空队列
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="h-14 px-8 bg-white border-2 border-slate-900 text-slate-900 font-black rounded-2xl hover:bg-slate-50 transition-all active:scale-95 shadow-lg"
          >
            导入笔记
          </button>
          <button 
            onClick={startBatchProcess}
            disabled={isProcessing || stats.total === 0}
            className="h-14 px-10 bg-slate-900 text-white font-black rounded-2xl shadow-2xl hover:bg-black transition-all disabled:opacity-20 flex items-center gap-3"
          >
            {isProcessing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-microchip text-yellow-400"></i>}
            批量运行
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Queue & Gallery */}
        <div className="lg:col-span-6">
          <div className="glass-card rounded-[2.5rem] p-8 border border-slate-100 min-h-[650px] shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <i className="fas fa-images text-slate-300"></i> 笔记素材库
              </h2>
              <span className="px-4 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500">
                {status.message || "就绪"}
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {imageItems.map((item, idx) => (
                <div 
                  key={item.id} 
                  onClick={() => setPreviewItem(item)}
                  className={`group relative aspect-[3/4] rounded-3xl overflow-hidden border-4 cursor-pointer transition-all shadow-md ${
                    previewItem?.id === item.id ? 'border-yellow-400 scale-105 z-10' : 'border-transparent'
                  }`}
                >
                  <img src={item.data} className="w-full h-full object-cover" />
                  <div className={`absolute inset-0 flex flex-col items-center justify-center backdrop-blur-[1px] transition-all ${
                    item.status === 'done' ? 'bg-emerald-500/30' : 
                    item.status === 'processing' ? 'bg-yellow-500/40' : 
                    item.status === 'error' ? 'bg-rose-500/50' : 'bg-black/0 group-hover:bg-black/20'
                  }`}>
                    {item.status === 'processing' && <i className="fas fa-atom fa-spin text-white text-3xl"></i>}
                    {item.status === 'done' && <i className="fas fa-check-circle text-white text-4xl shadow-lg"></i>}
                    {item.status === 'error' && <i className="fas fa-exclamation-triangle text-white text-3xl"></i>}
                  </div>
                  <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 text-[10px] font-black text-white rounded-full backdrop-blur-md">
                    #{idx + 1}
                  </div>
                </div>
              ))}
              
              {imageItems.length === 0 && (
                <div className="col-span-full py-40 flex flex-col items-center justify-center border-4 border-dashed border-slate-50 rounded-[2rem]">
                   <i className="fas fa-cloud-upload-alt text-7xl text-slate-100 mb-6"></i>
                   <p className="text-slate-300 font-black text-xl">请导入医学笔记照片</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Premium Preview */}
        <div className="lg:col-span-6">
           <div className="glass-card rounded-[2.5rem] p-8 border border-slate-100 h-full sticky top-8 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between mb-8 flex-shrink-0">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <i className="fas fa-wand-magic-sparkles text-blue-500"></i> 卡片预览
                </h2>
                <button 
                  onClick={downloadAllAnki}
                  disabled={stats.done === 0}
                  className="px-6 py-2 bg-slate-900 text-white text-xs font-black rounded-full shadow-xl disabled:opacity-20 hover:bg-black transition-all"
                >
                  导出制卡文件 (.txt)
                </button>
              </div>

              {previewItem?.card ? (
                <div className="space-y-8 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-200 relative shadow-inner">
                    <span className="absolute -top-3 left-8 px-4 py-1 bg-slate-900 text-white text-[10px] font-black rounded-full">FRONT 正面</span>
                    <div className="anki-content prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: previewItem.card.front }}></div>
                  </div>
                  <div className="p-8 bg-blue-50/50 rounded-[2rem] border border-blue-100 relative shadow-inner">
                    <span className="absolute -top-3 left-8 px-4 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full">BACK 反面</span>
                    <div className="anki-content prose prose-blue max-w-none font-medium" dangerouslySetInnerHTML={{ __html: previewItem.card.back }}></div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-200">
                  <i className="fas fa-microscope text-8xl mb-6 opacity-10"></i>
                  <p className="text-lg font-bold">处理完成后点击左侧图片查看 HTML 排版</p>
                </div>
              )}
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
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        .anki-content {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: #1e293b;
          line-height: 1.6;
        }
        .anki-content table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin: 1.5rem 0;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 1rem;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .anki-content th, .anki-content td {
          border-bottom: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
          padding: 12px 16px;
          text-align: left;
        }
        .anki-content th {
          background: #f8fafc;
          font-weight: 800;
          color: #475569;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }
        .anki-content tr:last-child td {
          border-bottom: none;
        }
        .anki-content td:last-child, .anki-content th:last-child {
          border-right: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
};

export default App;
