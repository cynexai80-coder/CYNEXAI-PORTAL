import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'info' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
};

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const baseStyles = 'relative inline-flex items-center justify-center font-bold text-center rounded-2xl transition-all duration-150 active:translate-y-1 active:shadow-none uppercase tracking-wide whitespace-nowrap shrink-0';
  
  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs rounded-xl',
    md: 'px-6 py-3 text-sm rounded-2xl',
    lg: 'px-8 py-4 text-base rounded-2xl'
  };

  const variants = {
    primary: 'bg-erp-primary text-white shadow-erp-btn-primary hover:opacity-90',
    secondary: 'bg-erp-secondary text-white shadow-erp-btn-secondary hover:opacity-90',
    danger: 'bg-erp-danger text-white shadow-erp-btn-danger hover:opacity-90',
    info: 'bg-erp-info text-white shadow-erp-btn-info hover:opacity-90',
    ghost: 'bg-transparent text-erp-text hover:bg-erp-border shadow-none active:translate-y-0 active:shadow-none'
  };

  const disabledStyles = 'opacity-50 cursor-not-allowed active:translate-y-0 active:shadow-none';

  return (
    <button
      className={`
        ${baseStyles}
        ${sizes[size]}
        ${variants[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${props.disabled ? disabledStyles : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};
