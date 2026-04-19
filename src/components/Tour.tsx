import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';

export interface Step {
  icon?: string | React.ReactNode;
  title: string;
  content: string;
  selector: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourProps {
  steps: Step[];
  onComplete?: () => void;
  open?: boolean;
}

export const Tour: React.FC<TourProps> = ({ steps, onComplete, open = false }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const updateCoords = useCallback(() => {
    if (!open) return;
    
    const currentStep = steps[currentStepIndex];
    if (currentStep.selector === 'body') {
      setCoords({ top: window.innerHeight / 2 - 100, left: window.innerWidth / 2 - 150, width: 300, height: 200 });
      return;
    }

    const element = document.querySelector(currentStep.selector);
    if (element) {
      const rect = element.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStepIndex, steps, open]);

  useEffect(() => {
    updateCoords();
    window.addEventListener('resize', updateCoords);
    return () => window.removeEventListener('resize', updateCoords);
  }, [updateCoords]);

  if (!open || !coords) return null;

  const currentStep = steps[currentStepIndex];

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      onComplete?.();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const isBody = currentStep.selector === 'body';

  // Calculate tooltip position
  const getTooltipPos = () => {
    if (isBody) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '320px' };
    
    const margin = 12;
    switch (currentStep.side) {
      case 'top':
        return { bottom: window.innerHeight - coords.top + margin, left: coords.left + coords.width / 2, transform: 'translateX(-50%)', width: '280px' };
      case 'bottom':
        return { top: coords.top + coords.height + margin, left: coords.left + coords.width / 2, transform: 'translateX(-50%)', width: '280px' };
      case 'left':
        return { top: coords.top + coords.height / 2, right: window.innerWidth - coords.left + margin, transform: 'translateY(-50%)', width: '280px' };
      case 'right':
      default:
        return { top: coords.top + coords.height / 2, left: coords.left + coords.width + margin, transform: 'translateY(-50%)', width: '280px' };
    }
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Overlay with hole */}
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-stone-900/60 backdrop-blur-[2px] pointer-events-auto"
          style={{
            clipPath: isBody ? 'none' : `polygon(0% 0%, 0% 100%, ${coords.left}px 100%, ${coords.left}px ${coords.top}px, ${coords.left + coords.width}px ${coords.top}px, ${coords.left + coords.width}px ${coords.top + coords.height}px, ${coords.left}px ${coords.top + coords.height}px, ${coords.left}px 100%, 100% 100%, 100% 0%)`
          }}
          onClick={onComplete}
        />
      </AnimatePresence>

      {/* Tooltip */}
      <motion.div
        layoutId="tour-tooltip"
        className="absolute bg-white rounded-3xl shadow-2xl p-6 pointer-events-auto flex flex-col gap-4 border border-stone-100"
        style={getTooltipPos() as any}
      >
        <button 
          onClick={onComplete}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-4">
          {currentStep.icon && (
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl">
              {currentStep.icon}
            </div>
          )}
          <div>
            <h4 className="font-bold text-stone-900">{currentStep.title}</h4>
            <div className="flex gap-1 mt-1">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1 rounded-full transition-all ${i === currentStepIndex ? 'w-4 bg-emerald-600' : 'w-1 bg-stone-200'}`} 
                />
              ))}
            </div>
          </div>
        </div>

        <p className="text-sm text-stone-600 leading-relaxed">
          {currentStep.content}
        </p>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className={`flex items-center gap-1 text-xs font-bold uppercase tracking-widest transition-colors ${currentStepIndex === 0 ? 'text-stone-300 pointer-events-none' : 'text-stone-500 hover:text-stone-900'}`}
          >
            <ChevronLeft size={16} />
            Quay lại
          </button>
          
          <button
            onClick={handleNext}
            className="flex items-center gap-1 bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            {currentStepIndex === steps.length - 1 ? 'Bắt đầu' : 'Tiếp theo'}
            {currentStepIndex !== steps.length - 1 && <ChevronRight size={16} />}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
