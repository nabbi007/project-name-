import React from 'react';

type BadgeColor = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  className?: string;
}

const colorMap: Record<BadgeColor, string> = {
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-surface-100 text-surface-700',
  purple: 'bg-purple-100 text-purple-800',
};

export const Badge: React.FC<BadgeProps> = ({ children, color = 'gray', className = '' }) => (
  <span className={`badge ${colorMap[color]} ${className}`}>{children}</span>
);
