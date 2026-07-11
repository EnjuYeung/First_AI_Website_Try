import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type PendingSave = {
  settings: any;
  resolve: (value: { data: any; revision: number }) => void;
};

const storageMock = vi.hoisted(() => ({
  pending: [] as PendingSave[],
  revision: 0,
}));

vi.mock('../services/storageService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/storageService')>();
  return {
    ...original,
    replaceSettings: vi.fn((settings: any) => new Promise((resolve) => {
      storageMock.pending.push({ settings, resolve });
    })),
  };
});

import { useAppData } from '../hooks/useAppData';

describe('useAppData mutation ordering', () => {
  beforeEach(() => {
    storageMock.pending.length = 0;
    storageMock.revision = 0;
  });

  it('does not let an older settings response overwrite newer optimistic input', async () => {
    const { result } = renderHook(() => useAppData(false));
    const firstSettings = {
      ...result.current.settings,
      notifications: {
        ...result.current.settings.notifications,
        telegram: {
          ...result.current.settings.notifications.telegram,
          botToken: 'a',
        },
      },
    };
    const secondSettings = {
      ...firstSettings,
      notifications: {
        ...firstSettings.notifications,
        telegram: { ...firstSettings.notifications.telegram, botToken: 'ab' },
      },
    };

    let firstSave!: Promise<boolean>;
    let secondSave!: Promise<boolean>;
    act(() => {
      firstSave = result.current.updateSettings(firstSettings);
      secondSave = result.current.updateSettings(secondSettings);
    });
    expect(result.current.settings.notifications.telegram.botToken).toBe('ab');

    await waitFor(() => expect(storageMock.pending).toHaveLength(1));
    await act(async () => {
      storageMock.pending[0].resolve({ data: firstSettings, revision: ++storageMock.revision });
      await firstSave;
    });
    expect(result.current.settings.notifications.telegram.botToken).toBe('ab');

    await waitFor(() => expect(storageMock.pending).toHaveLength(2));
    await act(async () => {
      storageMock.pending[1].resolve({ data: secondSettings, revision: ++storageMock.revision });
      await secondSave;
    });
    expect(result.current.settings.notifications.telegram.botToken).toBe('ab');
  });
});
