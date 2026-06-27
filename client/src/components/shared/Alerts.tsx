import React from 'react';

interface AlertProps {
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export const ErrorAlert: React.FC<AlertProps> = ({ children, onDismiss, className = '' }) => (
  <div className={`flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 animate-fade-in ${className}`}>
    <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <div className="flex-1">{children}</div>
    {onDismiss && (
      <button onClick={onDismiss} className="text-red-400 hover:text-red-600 flex-shrink-0" aria-label="Dismiss">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
);

export const SuccessAlert: React.FC<AlertProps> = ({ children, onDismiss, className = '' }) => (
  <div className={`flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 animate-fade-in ${className}`}>
    <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <div className="flex-1">{children}</div>
    {onDismiss && (
      <button onClick={onDismiss} className="text-green-400 hover:text-green-600 flex-shrink-0" aria-label="Dismiss">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
);
