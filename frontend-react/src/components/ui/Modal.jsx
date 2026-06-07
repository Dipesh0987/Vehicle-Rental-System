import { useEffect } from 'react';

export default function Modal({ open, onClose, children, className = '' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${className}`}
        style={{ animation: 'panelRise 300ms cubic-bezier(0.22,1,0.36,1) both' }}>
        {children}
      </div>
    </div>
  );
}
