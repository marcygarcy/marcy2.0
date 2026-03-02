import React, { createContext, useContext, useState, useCallback } from 'react';
import { clsx } from 'clsx';

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

interface TabsProps {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value: controlledValue, onValueChange: controlledOnChange, defaultValue, children, className }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;
  const onValueChange = useCallback(
    (v: string) => {
      if (!isControlled) setInternalValue(v);
      controlledOnChange?.(v);
    },
    [isControlled, controlledOnChange]
  );
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={clsx('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'flex gap-2 mb-8 flex-wrap',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');
  const onValueChange = typeof context.onValueChange === 'function' ? context.onValueChange : undefined;
  const isActive = context.value === value;

  return (
    <button
      type="button"
      onClick={() => onValueChange?.(value)}
      className={clsx(
        'px-4 py-2 rounded-lg font-medium transition-all',
        {
          'bg-blue-600 text-white shadow-lg': isActive,
          'bg-slate-700 text-slate-300 hover:bg-slate-600': !isActive,
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const context = useContext(TabsContext);
  if (!context) {
    // Se não há contexto, pode ser um TabsContent usado fora de um Tabs (ex: em tabs aninhados)
    // Nesse caso, retornamos null silenciosamente
    return null;
  }

  if (context.value !== value) return null;

  return (
    <div className={clsx('w-full', className)} {...props}>
      {children}
    </div>
  );
}

