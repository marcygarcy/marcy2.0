import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatValue } from '@/lib/utils/format';

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  format?: 'currency' | 'number' | 'days';
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  format = 'number',
  color = 'blue',
}: KPICardProps) {
  const formattedValue = formatValue(value, format);
  
  const colorClasses = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-300">
            {title}
          </CardTitle>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${colorClasses[color]}`}>
          {formattedValue}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        )}
        {trend && (
          <div className={`text-xs mt-2 ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}

