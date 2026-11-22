import React from 'react';
import { GameState } from '../types';
import { DailyMissionsView } from './DailyMissionsView';
import { X } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface DailyMissionsModalProps {
  state: GameState;
  onUpdateState: (fn: (prev: GameState) => GameState) => void;
  onClose: () => void;
  onAddFloatingText?: (text: string, x: number, y: number, color?: string) => void;
}

export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({
  state,
  onUpdateState,
  onClose,
  onAddFloatingText
}) => {
  const handleClose = () => {
    soundManager.playSound('click', state.settings.soundFx);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-sm animate-scaleIn">
      <div className="relative w-full max-w-md max-h-[90vh] bg-[#F8FAFF] rounded-2xl shadow-2xl border border-indigo-200 flex flex-col overflow-hidden">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-xs active:scale-95 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="overflow-y-auto no-scrollbar pt-2 pb-4 px-1">
          <DailyMissionsView
            state={state}
            onUpdateState={onUpdateState}
            onAddFloatingText={onAddFloatingText}
            isModal={true}
            onClose={handleClose}
          />
        </div>
      </div>
    </div>
  );
};
