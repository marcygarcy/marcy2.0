'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

export interface NestedDropdownItem {
  value: string;
  label: string;
  icon?: string;
  children?: { value: string; label: string; icon?: string }[];
}

interface NestedDropdownProps {
  trigger: React.ReactNode;
  items: NestedDropdownItem[];
  onSelect: (value: string) => void;
  className?: string;
}

export function NestedDropdown({ trigger, items, onSelect, className = '' }: NestedDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [subOpen, setSubOpen] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSubOpen(null);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleLeafSelect = (value: string) => {
    onSelect(value);
    setIsOpen(false);
    setSubOpen(null);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <div onClick={() => { setIsOpen(!isOpen); setSubOpen(null); }}>
        {trigger}
      </div>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 z-50 min-w-[220px] bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden flex"
          onMouseLeave={() => setSubOpen(null)}
        >
          {/* Nível 1 */}
          <div className="min-w-[220px] border-r border-slate-700">
            {items.map((item) => (
              <div
                key={item.value}
                className="relative"
                onMouseEnter={() => item.children?.length ? setSubOpen(item.value) : setSubOpen(null)}
              >
                {item.children?.length ? (
                  <div className="flex items-center justify-between px-4 py-3 text-slate-200 hover:bg-slate-700 cursor-pointer">
                    <span>{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                ) : (
                  <div
                    onClick={() => handleLeafSelect(item.value)}
                    className="px-4 py-3 text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    {item.label}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Sub-dropdown (nível 2) */}
          {subOpen && items.find((i) => i.value === subOpen)?.children && (
            <div className="min-w-[200px] bg-slate-800/95">
              {items
                .find((i) => i.value === subOpen)!
                .children!.map((sub) => (
                  <div
                    key={sub.value}
                    onClick={() => handleLeafSelect(sub.value)}
                    className="px-4 py-3 text-slate-200 hover:bg-amber-600/80 hover:text-white cursor-pointer"
                  >
                    {sub.label}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
