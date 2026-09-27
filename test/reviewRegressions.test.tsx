import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../services/storageService', async (original) => ({
  ...await original<typeof import('../services/storageService')>(),
  fetchAllData: vi.fn(), updateSettingsFields: vi.fn(), updateSubscription: vi.fn(),
  uploadIconFile: vi.fn(), deleteUploadedIcon: vi.fn(),
}));
import * as storage from '../services/storageService';
import { useAppData } from '../hooks/useAppData';
import SubscriptionForm from '../components/SubscriptionForm';
import Dashboard from '../components/Dashboard';
import NotificationsTab from '../components/settings/tabs/NotificationsTab';
import { getT } from '../services/i18n';
import { Frequency } from '../types';
import { createDefaultSettings } from '../shared/defaultSettings.js';
import { applyEditableSettings } from '../shared/settingsOwnership.js';
import { validateSettings } from '../shared/dataSchema.js';
import { convertToUSD } from '../services/currency';
import { matchesSubscriptionPriceRanges, useSubscriptionFilters } from '../hooks/useSubscriptionFilters';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
};
const sub = { id: 'one', name: 'Example', price: 10, currency: 'USD', frequency: Frequency.MONTHLY,
  category: 'Other', paymentMethod: 'Credit Card', status: 'active' as const,
  startDate: '2026-09-30', nextBillingDate: '2026-09-30', notificationsEnabled: true };
const snapshot = (revision = 1) => ({ settings: storage.getDefaultSettings(), subscriptions: [sub],
  notifications: [], serverTime: Date.now(), revisions: { subscriptions: revision, settings: revision, notifications: revision } });
beforeEach(() => { vi.resetAllMocks(); vi.mocked(storage.fetchAllData).mockResolvedValue(snapshot()); });
afterEach(() => { vi.useRealTimers(); });

describe('review regressions', () => {
  it('does not replay a stale subscription on conflict and reconciles remote cancellation', async () => {
    vi.mocked(storage.updateSubscription).mockRejectedValue(new storage.RevisionConflictError('revision_conflict', 2));
    const { result } = renderHook(() => useAppData(true));
    await waitFor(() => expect(result.current.hasLoadedData).toBe(true));
    const latest = snapshot(2);
    latest.subscriptions = [{ ...sub, status: 'cancelled' as any, nextBillingDate: '' }];
    vi.mocked(storage.fetchAllData).mockResolvedValue(latest);
    await act(async () => { expect(await result.current.saveSubscription({ ...sub, notes: 'draft' }, true)).toBe(false); });
    expect(storage.updateSubscription).toHaveBeenCalledTimes(1);
    expect(result.current.subscriptions[0].status).toBe('cancelled');
  });

  it('never upgrades an already queued stale settings write after a conflict', async () => {
    const { result } = renderHook(() => useAppData(true));
    await waitFor(() => expect(result.current.hasLoadedData).toBe(true));
    vi.mocked(storage.updateSettingsFields).mockRejectedValue(new storage.RevisionConflictError('revision_conflict', 2));
    vi.mocked(storage.fetchAllData).mockResolvedValue(snapshot(2));
    await act(async () => {
      await Promise.all([result.current.updateSettings(result.current.settings), result.current.updateSettings(result.current.settings)]);
    });
    expect(storage.updateSettingsFields).toHaveBeenCalledTimes(1);
  });

  it('ignores a GET arriving after a successful PUT, including its stale revision', async () => {
    const { result } = renderHook(() => useAppData(true));
    await waitFor(() => expect(result.current.hasLoadedData).toBe(true));
    const oldGet = deferred<ReturnType<typeof snapshot>>();
    vi.mocked(storage.fetchAllData).mockReturnValueOnce(oldGet.promise);
    let refresh!: ReturnType<typeof result.current.loadRemoteData>;
    act(() => { refresh = result.current.loadRemoteData(); });
    await waitFor(() => expect(storage.fetchAllData).toHaveBeenCalledTimes(2));
    const next = { ...result.current.settings, customCategories: ['New category'] };
    vi.mocked(storage.updateSettingsFields).mockResolvedValue({ data: next, revision: 2 });
    await act(async () => { await result.current.updateSettings(next); });
    await act(async () => { oldGet.resolve(snapshot()); await refresh; });
    expect(result.current.settings.customCategories).toEqual(['New category']);
    await act(async () => { await result.current.updateSettings(next); });
    expect(storage.updateSettingsFields).toHaveBeenLastCalledWith(next, 2);
  });

  it('preserves a save queued in the same turn as a refresh', async () => {
    const { result } = renderHook(() => useAppData(true));
    await waitFor(() => expect(result.current.hasLoadedData).toBe(true));
    const get = deferred<ReturnType<typeof snapshot>>();
    const put = deferred<{ data: ReturnType<typeof storage.getDefaultSettings>; revision: number }>();
    vi.mocked(storage.fetchAllData).mockReturnValueOnce(get.promise);
    vi.mocked(storage.updateSettingsFields).mockReturnValueOnce(put.promise);
    const next = { ...result.current.settings, customCategories: ['Keep draft'] };
    let refresh!: ReturnType<typeof result.current.loadRemoteData>;
    let save!: Promise<boolean>;
    act(() => {
      refresh = result.current.loadRemoteData();
      save = result.current.updateSettings(next);
    });
    await waitFor(() => expect(storage.fetchAllData).toHaveBeenCalledTimes(2));
    await act(async () => { get.resolve(snapshot()); await refresh; });
    expect(result.current.settings.customCategories).toEqual(['Keep draft']);
    await act(async () => { put.resolve({ data: next, revision: 2 }); await save; });
    expect(result.current.settings.customCategories).toEqual(['Keep draft']);
  });

  it('reloads authoritative settings after a dedicated update overlaps an older GET', async () => {
    const { result } = renderHook(() => useAppData(true));
    await waitFor(() => expect(result.current.hasLoadedData).toBe(true));
    const oldGet = deferred<ReturnType<typeof snapshot>>();
    const latest = snapshot(2);
    latest.settings.security.twoFactorEnabled = true;
    vi.mocked(storage.fetchAllData).mockReturnValueOnce(oldGet.promise).mockResolvedValue(latest);
    let refresh!: ReturnType<typeof result.current.loadRemoteData>;
    act(() => { refresh = result.current.loadRemoteData(); });
    await waitFor(() => expect(storage.fetchAllData).toHaveBeenCalledTimes(2));
    act(() => result.current.applyRemoteSettings({ state: { security: latest.settings.security } }));
    await act(async () => { oldGet.resolve(snapshot()); await refresh; });
    await waitFor(() => expect(storage.fetchAllData).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.isDataLoading).toBe(false));
    expect(result.current.settings.security.twoFactorEnabled).toBe(true);
    vi.mocked(storage.updateSettingsFields).mockResolvedValue({ data: latest.settings, revision: 3 });
    await act(async () => { await result.current.updateSettings(latest.settings); });
    expect(storage.updateSettingsFields).toHaveBeenLastCalledWith(latest.settings, 2);
  });

  it('ignores a late dedicated response older than the current settings revision', async () => {
    vi.mocked(storage.fetchAllData).mockResolvedValue(snapshot(5));
    const { result } = renderHook(() => useAppData(true));
    await waitFor(() => expect(result.current.hasLoadedData).toBe(true));
    act(() => result.current.applyRemoteSettings({ state: { security: { ...result.current.settings.security, twoFactorEnabled: true } }, revision: 4 }));
    expect(result.current.settings.security.twoFactorEnabled).toBe(false);
    expect(storage.fetchAllData).toHaveBeenCalledTimes(1);
  });

  it('sends independent queued setting patches against consecutive committed revisions', async () => {
    const { result } = renderHook(() => useAppData(true));
    await waitFor(() => expect(result.current.hasLoadedData).toBe(true));
    let stored = snapshot().settings;
    let revision = 1;
    vi.mocked(storage.updateSettingsFields).mockImplementation(async (patch, expected) => {
      expect(expected).toBe(revision);
      stored = applyEditableSettings(stored, patch);
      revision += 1;
      return { data: stored, revision };
    });
    await act(async () => {
      await Promise.all([
        result.current.updateSettings({ customCategories: ['My category'] }),
        result.current.updateSettings({ notifications: { rules: { monthlySummary: true } } }),
      ]);
    });
    expect(result.current.settings.customCategories).toEqual(['My category']);
    expect(result.current.settings.notifications.rules.monthlySummary).toBe(true);
    expect(storage.updateSettingsFields).toHaveBeenNthCalledWith(2, { notifications: { rules: { monthlySummary: true } } }, 2);
  });

  it('exposes first-load failure instead of declaring default data ready', async () => {
    vi.mocked(storage.fetchAllData).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAppData(true));
    await waitFor(() => expect(result.current.loadError).toBeTruthy());
    expect(result.current.hasLoadedData).toBe(false);
  });

  it('keeps configuration drafts while validating only complete saves', async () => {
    const settings = storage.getDefaultSettings();
    const save = vi.fn(async (value) => validateSettings(applyEditableSettings(createDefaultSettings(), value)) === null);
    const testConnection = vi.fn();
    render(<NotificationsTab settings={settings} t={getT('en')} onUpdateSettings={save}
      templateText={settings.notifications.rules.template} setTemplateText={vi.fn()}
      monthlySummaryTemplateText={settings.notifications.rules.monthlySummaryTemplate} setMonthlySummaryTemplateText={vi.fn()}
      handleSaveTemplate={vi.fn()} handleSaveMonthlySummaryTemplate={vi.fn()} handleTestTemplate={vi.fn()}
      handleTestMonthlySummaryTemplate={vi.fn()} isTestingTelegram={false} isTestingMonthlySummary={false}
      handleTestTelegram={testConnection} toggleReminderChannel={vi.fn()} toggleMonthlySummaryChannel={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Telegram Bot' }));
    fireEvent.change(screen.getByPlaceholderText('Bot Token'), { target: { value: 'token' } });
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Save ·/ }));
    await screen.findByRole('alert');
    expect(screen.getByDisplayValue('token')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Chat ID'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(testConnection).toHaveBeenCalledOnce());
    expect(validateSettings(applyEditableSettings(createDefaultSettings(), save.mock.calls.at(-1)![0]))).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Email' }));
    fireEvent.change(screen.getByPlaceholderText(getT('en')('email_address')), { target: { value: 'half@' } });
    expect(save).toHaveBeenCalledTimes(2);
    fireEvent.change(screen.getByPlaceholderText(getT('en')('email_address')), { target: { value: 'valid@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Save ·/ }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(validateSettings(applyEditableSettings(createDefaultSettings(), save.mock.calls.at(-1)![0]))).toBeNull();
  });

  it('protects an uploaded icon when closing or pressing Escape during save', async () => {
    const pending = deferred<boolean>();
    const onClose = vi.fn();
    const onSave = vi.fn(() => pending.promise);
    vi.mocked(storage.uploadIconFile).mockResolvedValue('/api/uploads/abc.png');
    const { container } = render(<SubscriptionForm isOpen initialData={sub} onClose={onClose} onSave={onSave}
      settings={storage.getDefaultSettings()} lang="en" />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['icon'], 'icon.png', { type: 'image/png' })] } });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave.mock.calls[0]).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(storage.deleteUploadedIcon).not.toHaveBeenCalled();
    await act(async () => pending.resolve(true));
    expect(onClose).toHaveBeenCalledOnce();
    expect(storage.deleteUploadedIcon).not.toHaveBeenCalled();
  });

  it('refreshes parent billing statistics when an open page crosses a Shanghai month boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T15:59:50Z'));
    vi.mocked(storage.fetchAllData).mockImplementation(async () => snapshot());
    const Page = () => {
      const data = useAppData(true);
      return <Dashboard subscriptions={data.subscriptions} settings={data.settings} serverClock={data.serverClock} lang="en" />;
    };
    render(<Page />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getAllByText('September 2026').length).toBeGreaterThan(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getAllByText('October 2026').length).toBeGreaterThan(0);
    expect(screen.queryByText('September 2026')).toBeNull();
    expect(storage.fetchAllData).toHaveBeenCalledTimes(2);
  });

  it('keeps unknown currencies out of numeric filters and sorts them last in both directions', () => {
    const unknown = { ...sub, id: 'jpy', currency: 'JPY', price: 10000 };
    expect(convertToUSD(10000, 'JPY', {})).toBeNull();
    expect(matchesSubscriptionPriceRanges(['low', 'mid', 'high'], unknown, {})).toBe(false);
    expect(matchesSubscriptionPriceRanges([], unknown, {})).toBe(true);
    const { result } = renderHook(() => useSubscriptionFilters([unknown, sub], {}));
    act(() => result.current.handleSort('price'));
    expect(result.current.filteredSubscriptions.at(-1)?.id).toBe('jpy');
    act(() => result.current.handleSort('price'));
    expect(result.current.filteredSubscriptions.at(-1)?.id).toBe('jpy');
  });
});
