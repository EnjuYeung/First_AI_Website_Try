import { useEffect } from 'react';

let lockCount = 0;
let previousOverflow = '';

/** Nested form/error dialogs share a lock and restore the prior body style. */
export const useDialogScrollLock = (open = true) => {
  useEffect(() => {
    if (!open) return;
    if (lockCount++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      if (--lockCount === 0) document.body.style.overflow = previousOverflow;
    };
  }, [open]);
};
