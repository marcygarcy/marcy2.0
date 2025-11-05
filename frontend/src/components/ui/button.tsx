import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-blue-600 hover:bg-blue-700 text-white': variant === 'primary',
          'bg-slate-700 hover:bg-slate-600 text-white': variant === 'secondary',
          'bg-red-600 hover:bg-red-700 text-white': variant === 'danger',
          'bg-transparent hover:bg-slate-700 text-slate-300': variant === 'ghost',
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2': size === 'md',
          'px-6 py-3 text-lg': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

