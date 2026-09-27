import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
vi.mock('../services/apiClient', () => ({ apiFetchJson: vi.fn(async (url: string) => ({ settingsState: { security: { twoFactorEnabled: url.endsWith('/verify'), lastPasswordChange: '1970-01-01T00:00:00.000Z' } }, revision: url.endsWith('/verify') ? 2 : 3 })), authJsonHeaders: () => ({}) }));
import { useSecuritySettings } from '../hooks/useSecuritySettings';
import { getDefaultSettings } from '../services/storageService';

it('publishes enabled and disabled 2FA status to the shared settings source', async () => {
  const { result } = renderHook(() => {
    const [settings, setSettings] = useState(getDefaultSettings());
    const security = useSecuritySettings(settings, key => key, vi.fn(), vi.fn(), update => {
      setSettings(previous => ({ ...previous, ...update.state }));
    });
    return { settings, security };
  });
  act(() => result.current.security.setTwoFaCode('123456'));
  await act(async () => { await result.current.security.verifyTwoFactor(); });
  expect(result.current.security.isTwoFactorActive).toBe(true);
  expect(result.current.settings.security.twoFactorEnabled).toBe(true);
  await act(async () => { await result.current.security.handleToggleTwoFactor(false); });
  expect(result.current.security.isTwoFactorActive).toBe(false);
  expect(result.current.settings.security.twoFactorEnabled).toBe(false);
});
