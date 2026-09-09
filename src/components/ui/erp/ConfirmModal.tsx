import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  onClose,
  variant = 'danger'
}) => {
  if (!isOpen) return null;
  const handleCancel = onCancel || onClose || (() => {});

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center bg-red-500/10">
            <AlertTriangle className={`w-6 h-6 ${variant === 'danger' ? 'text-red-500' : 'text-orange-500'}`} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-erp-text font-display mb-2">{title}</h2>
            <p className="text-sm text-erp-text/70">{message}</p>
          </div>
        </div>

        <div className="p-4 border-t border-erp-border bg-slate-900/30 flex justify-end gap-3">
          <Button variant="ghost" onClick={handleCancel}>{cancelText}</Button>
          <Button 
            variant="primary" 
            onClick={onConfirm}
            className={variant === 'danger' ? 'bg-red-500 hover:bg-red-600 border-red-500' : ''}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
