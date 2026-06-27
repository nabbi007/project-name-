import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  hover?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = true,
  hover = false,
  onClick,
}) => (
  <div
    className={`card ${padding ? 'p-5' : ''} ${hover ? 'hover:shadow-md hover:border-primary-200 transition-all duration-200 cursor-pointer' : ''} ${className}`}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
  >
    {children}
  </div>
);
