import React, { useState } from 'react';
import { GameState, ItemDefinition } from '../types';
import { getItemDef } from '../data/gameData';
import { Package, ArrowUpRight, PlusCircle, AlertCircle, Info } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { ItemDetailModal } from './ItemDetailModal';

interface InventoryViewProps {
  state: GameState;
  onUpdateState: (fn: (prev: GameState) => GameState) => void;
  embedded?: boolean;
}

const MAX_VAULT_SLOTS = 24;

export const InventoryView: React.FC<InventoryViewProps> = ({
  state,
  onUpdateState,
  embedded = false
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inspectedItem, setInspectedItem] = useState<ItemDefinition | null>(null);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 2500);
  };

  const handleWithdrawItem = (itemIndex: number) => {
    onUpdateState(prev => {
      const emptyCellIdx = prev.board.findIndex(c => c.item === null);
      if (emptyCellIdx === -1) {
        soundManager.playSound('error', prev.settings.soundFx);
        showError('Assembly grid is full. Merge or sell a slot before deploying.');
        return prev;
      }

      if (itemIndex < 0 || itemIndex >= prev.inventory.length) {
        return prev;
      }

      const nextInventory = [...prev.inventory];
      const [itemToWithdraw] = nextInventory.splice(itemIndex, 1);
      if (!itemToWithdraw) return prev;

      const nextBoard = [...prev.board];
      nextBoard[emptyCellIdx] = {
        ...nextBoard[emptyCellIdx],
        item: {
          id: itemToWithdraw.id || `item_${Date.now()}_${Math.random()}`,
          tier: itemToWithdraw.tier,
          category: itemToWithdraw.category || 'wood'
        }
      };

      soundManager.playSound('click', prev.settings.soundFx);

      return {
        ...prev,
        inventory: nextInventory,
        board: nextBoard
      };
    });
  };

  const upgradeCostCoins = Math.max(200, (state.maxInventoryCapacity - 6) * 140);

  const handleUpgradeCapacity = () => {
    if (state.maxInventoryCapacity >= MAX_VAULT_SLOTS) {
      showError(`Maximum vault capacity (${MAX_VAULT_SLOTS} slots) reached.`);
      return;
    }

    if (state.coins < upgradeCostCoins) {
      soundManager.playSound('error', state.settings.soundFx);
      showError(`Requires ${upgradeCostCoins.toLocaleString()} coins to expand vault capacity.`);
      return;
    }

    onUpdateState(prev => {
      soundManager.playSound('upgrade', prev.settings.soundFx);
      return {
        ...prev,
        coins: prev.coins - upgradeCostCoins,
        maxInventoryCapacity: Math.min(MAX_VAULT_SLOTS, prev.maxInventoryCapacity + 4)
      };
    });
  };

  return (
    <div className={`flex flex-col gap-2.5 select-none text-slate-900 ${embedded ? '' : 'max-w-md mx-auto p-3'}`}>
      {/* Header Info Card */}
      <div className="bg-white border border-sky-200 rounded-2xl p-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-600 shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-900">Asset Vault</h3>
            <p className="text-[11px] text-slate-500 tabular-nums">
              {state.inventory.length} / {state.maxInventoryCapacity} slots · Tap tile to deploy
            </p>
          </div>
        </div>

        {state.maxInventoryCapacity < MAX_VAULT_SLOTS && (
          <button
            onClick={handleUpgradeCapacity}
            className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] px-2.5 py-1.5 rounded-xl active:scale-95 transition cursor-pointer whitespace-nowrap tabular-nums shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+4 ({upgradeCostCoins.toLocaleString()})</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Inventory Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
        {state.inventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-slate-500 gap-1.5">
            <Package className="w-8 h-8 stroke-[1.5] text-sky-400" />
            <p className="text-xs font-bold text-slate-800">Asset Vault is empty</p>
            <p className="text-[11px] text-slate-500 text-center max-w-xs">
              Select any item on the grid and tap Vault to store it here and keep your assembly slots clear.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {state.inventory.map((invItem, idx) => {
              const itemDef = getItemDef(invItem.category || 'wood', invItem.tier);

              return (
                <div
                  key={`${invItem.id}_${idx}`}
                  onClick={() => handleWithdrawItem(idx)}
                  className={`bg-gradient-to-br ${itemDef.bgGradient} rounded-xl p-1.5 flex flex-col items-center justify-between cursor-pointer transition hover:brightness-105 group relative aspect-square border shadow-sm`}
                  title="Tap to deploy back onto the assembly grid"
                >

                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      soundManager.playSound('click', state.settings.soundFx);
                      setInspectedItem(itemDef);
                    }}
                    className="absolute top-1 right-1 bg-white/90 hover:bg-white text-sky-700 rounded-full p-0.5 shadow cursor-pointer z-10"
                    title="View full item details"
                  >
                    <Info className="w-3 h-3" />
                  </button>

                  <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
                    {itemDef.image ? (
                      <img
                        src={itemDef.image}
                        alt={itemDef.name}
                        className="w-10 h-10 object-cover rounded-lg shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-2xl drop-shadow-sm">{itemDef.icon}</span>
                    )}
                  </div>

                  <div className="w-full text-center bg-slate-900/65 rounded-md px-1 py-0.5">
                    <span className="block text-[9px] font-bold text-white truncate">
                      {itemDef.name}
                    </span>
                    <span className="block text-[8px] text-amber-200 font-mono-num">
                      Tier {itemDef.tier}
                    </span>
                  </div>

                  <span className="hidden group-hover:flex absolute bottom-1 right-1 text-slate-950 bg-amber-300 p-0.5 rounded-md">
                    <ArrowUpRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {inspectedItem && (
        <ItemDetailModal item={inspectedItem} onClose={() => setInspectedItem(null)} />
      )}
    </div>
  );
};
