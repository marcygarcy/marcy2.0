export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(num);
}

export function formatNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-PT').format(num);
}

export function formatDays(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `${num.toFixed(1)} dias`;
}

export function formatValue(value: number | string, format: 'currency' | 'number' | 'days' = 'number'): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'days':
      return formatDays(value);
    case 'number':
    default:
      return formatNumber(value);
  }
}

