import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NotificationsTab from '../components/settings/tabs/NotificationsTab';
import { getT } from '../services/i18n';
import { getDefaultSettings } from '../services/storageService';

describe('Notification settings', () => {
  it('keeps renewal reminders and monthly summaries independently configurable', () => {
    const settings = getDefaultSettings();
    settings.language = 'en';
    settings.notifications.rules.renewalReminder = true;
    settings.notifications.rules.monthlySummary = true;
    settings.notifications.telegram.enabled = true;
    const onUpdateSettings = vi.fn().mockResolvedValue(true);

    render(
      <NotificationsTab
        t={getT('en')}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        templateText={settings.notifications.rules.template}
        setTemplateText={vi.fn()}
        monthlySummaryTemplateText={settings.notifications.rules.monthlySummaryTemplate}
        setMonthlySummaryTemplateText={vi.fn()}
        handleSaveTemplate={vi.fn()}
        handleSaveMonthlySummaryTemplate={vi.fn()}
        handleTestTemplate={vi.fn()}
        isTestingTelegram={false}
        handleTestTelegram={vi.fn()}
        toggleReminderChannel={vi.fn()}
        toggleMonthlySummaryChannel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Renewal Reminder · JSON template')).toBeTruthy();
    expect(screen.getByLabelText('Monthly summary · JSON template')).toBeTruthy();
    expect(screen.getByText('Statistics with a zero value are omitted automatically.')).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Monthly summary' }));
    expect(onUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({
      notifications: expect.objectContaining({
        rules: expect.objectContaining({
          renewalReminder: true,
          monthlySummary: false,
        }),
      }),
    }));
  });
});
