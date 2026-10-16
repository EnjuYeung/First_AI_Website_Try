import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ModalDialog } from '../components/ui/ModalDialog';

it('focuses the first action, wraps keyboard focus and returns to the trigger on Escape', () => {
  const Page = () => {
    const [open, setOpen] = useState(false);
    return <>
      <button onClick={() => setOpen(true)}>Open confirmation</button>
      {open && <ModalDialog title="Confirmation" onClose={() => setOpen(false)} actions={<>
        <button onClick={() => setOpen(false)}>Cancel</button>
        <button>Confirm</button>
      </>}><p>Confirm the change.</p></ModalDialog>}
    </>;
  };
  render(<Page />);
  const trigger = screen.getByRole('button', { name: 'Open confirmation' });
  trigger.focus();
  fireEvent.click(trigger);
  const cancel = screen.getByRole('button', { name: 'Cancel' });
  const confirm = screen.getByRole('button', { name: 'Confirm' });
  expect(screen.getByRole('dialog', { name: 'Confirmation' })).toBeTruthy();
  expect(document.activeElement).toBe(cancel);
  fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(confirm);
  fireEvent.keyDown(confirm, { key: 'Tab' });
  expect(document.activeElement).toBe(cancel);
  fireEvent.keyDown(cancel, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
