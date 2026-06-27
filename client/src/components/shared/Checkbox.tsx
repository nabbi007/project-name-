import React, { forwardRef } from 'react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, id, className = '', ...props }, ref) => {
    const checkboxId = id || label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className={`flex flex-col ${className}`}>
        <label htmlFor={checkboxId} className="flex items-start gap-3 cursor-pointer group">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-surface-300 text-primary-600 
                       focus:ring-primary-500 focus:ring-2 focus:ring-offset-1 cursor-pointer"
            {...props}
          />
          <span className="text-sm text-surface-700 group-hover:text-surface-900">{label}</span>
        </label>
        {error && <p className="mt-1 ml-7 text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
