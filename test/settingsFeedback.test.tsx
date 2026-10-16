import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Settings from '../components/Settings';
import { getDefaultSettings } from '../services/storageService';

it('keeps keyboard focus in a settings error dialog and restores it on Escape', async () => {
  const settings = { ...getDefaultSettings(), language: 'en' as const };
  render(<Settings settings={settings} onUpdateSettings={vi.fn()} onApplyRemoteSettings={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Security' }));
  const update = screen.getByRole('button', { name: 'Update Password' });
  update.focus();
  fireEvent.click(update);

  expect(screen.getByRole('alertdialog').getAttribute('aria-modal')).toBe('true');
  const close = screen.getByRole('button', { name: 'Close' });
  await waitFor(() => expect(document.activeElement).toBe(close));
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: 'Escape' });
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(document.activeElement).toBe(update);
});
