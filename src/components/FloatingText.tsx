import React, { useEffect } from 'react';
import { FloatingTextData } from '../types';

interface FloatingTextProps {
  items: FloatingTextData[];
  onRemoveItem: (id: string) => void;
}

export const FloatingText: React.FC<FloatingTextProps> = ({ items, onRemoveItem }) => {
  useEffect(() => {
    if (items.length === 0) return;
    const timer = setTimeout(() => {
      onRemoveItem(items[0].id);
    }, 1200);
    return () => clearTimeout(timer);
  }, [items, onRemoveItem]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {items.map(item => (
        <div
          key={item.id}
          className="absolute font-mono-num tabular-nums font-extrabold text-xs tracking-tight animate-floatUp"
          style={{
            left: `${item.x}px`,
            top: `${item.y}px`,
            color: item.color || '#D97706',
            textShadow: '0 1px 0 rgba(255,255,255,0.95), 0 2px 6px rgba(15,23,42,0.18)'
          }}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
};
