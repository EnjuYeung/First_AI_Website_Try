import React, { useEffect, useId, useRef } from 'react';

interface Props {
  title: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  actions: React.ReactNode;
  onClose: () => void;
  role?: 'dialog' | 'alertdialog';
  wide?: boolean;
}

export const ModalDialog: React.FC<Props> = ({ title, icon, children, actions, onClose, role = 'dialog', wide = false }) => {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>('button:not(:disabled)') || panel)?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...(panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
    ) || [])];
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <div className="dialog-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div ref={panelRef} role={role} aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={children ? `${id}-description` : undefined} tabIndex={-1} onKeyDown={handleKeyDown} className={`dialog-panel max-h-[92vh] w-full overflow-y-auto rounded-[20px] p-6 text-center animate-pop-in ${wide ? 'max-w-lg' : 'max-w-sm'}`}>
        {icon && <div className="mb-4 flex justify-center" aria-hidden="true">{icon}</div>}
        <h3 id={`${id}-title`} className="text-xl font-semibold text-[var(--ink)]">{title}</h3>
        {children && <div id={`${id}-description`} className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{children}</div>}
        <div className="mt-5">{actions}</div>
      </div>
    </div>
  );
};
