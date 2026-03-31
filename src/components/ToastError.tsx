import { useEffect } from 'react';

interface ToastErrorProps {
  message: string;
  onDismiss: () => void;
}

export function ToastError({ message, onDismiss }: ToastErrorProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#FCEBEB',
        border: '1px solid #F09595',
        color: '#A32D2D',
        padding: '12px 20px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: '500',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '90vw',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        animation: 'slideUp 0.3s ease'
      }}
      role="alert"
      aria-live="assertive"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#A32D2D',
          fontSize: '16px',
          padding: '0',
          lineHeight: '1'
        }}
        aria-label="Dismiss error"
      >
        ×
      </button>
    </div>
  );
}
