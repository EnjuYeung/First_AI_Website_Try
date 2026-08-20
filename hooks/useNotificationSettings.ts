import { useEffect, useState } from 'react';
import { AppSettings, NotificationChannel } from '../types';
import { apiFetchJson, authJsonHeaders } from '../services/apiClient';
import { normalizeReminderTemplateString } from '../shared/reminderTemplate.js';
import { normalizeMonthlySummaryTemplateString } from '../shared/monthlySummaryTemplate.js';
import { SettingsAlert } from './settingsTypes';

const assertTemplate = (raw: string) => {
  const parsed = JSON.parse(raw || '');
  if (!Array.isArray(parsed?.lines) || !parsed.lines.length) throw new Error('invalid_template');
};

export const useNotificationSettings = (
  settings: AppSettings,
  onUpdate: (settings: AppSettings) => boolean | Promise<boolean>,
  t: (key: any) => string,
  setAlert: (alert: SettingsAlert) => void
) => {
  const [templateText, setTemplateText] = useState(settings.notifications.rules.template);
  const [monthlySummaryTemplateText, setMonthlySummaryTemplateText] = useState(
    settings.notifications.rules.monthlySummaryTemplate,
  );
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [isTestingMonthlySummary, setIsTestingMonthlySummary] = useState(false);
  useEffect(() => setTemplateText(settings.notifications.rules.template), [settings.notifications.rules.template]);
  useEffect(
    () => setMonthlySummaryTemplateText(settings.notifications.rules.monthlySummaryTemplate),
    [settings.notifications.rules.monthlySummaryTemplate],
  );

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    try {
      assertTemplate(templateText);
      await apiFetchJson('/api/notifications/test-telegram', {
        method: 'POST', headers: authJsonHeaders(), body: JSON.stringify({ template: templateText }),
      });
      setAlert({ isOpen: true, type: 'success', title: t('success_title'), message: t('test_message_sent') });
    } catch (err: any) {
      const message = err?.message === 'telegram_not_configured'
        ? t('telegram_not_configured')
        : err?.message === 'invalid_template'
          ? t('template_json_error')
          : err?.message || t('telegram_test_failed');
      setAlert({ isOpen: true, type: 'error', title: t('error_title'), message });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleTestMonthlySummaryTemplate = async () => {
    setIsTestingMonthlySummary(true);
    try {
      assertTemplate(monthlySummaryTemplateText);
      await apiFetchJson('/api/notifications/test-telegram', {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({
          template: monthlySummaryTemplateText,
          templateType: 'monthlySummary',
        }),
      });
      setAlert({ isOpen: true, type: 'success', title: t('success_title'), message: t('test_message_sent') });
    } catch (err: any) {
      const message = err?.message === 'telegram_not_configured'
        ? t('telegram_not_configured')
        : err?.message === 'invalid_template'
          ? t('template_json_error')
          : err?.message || t('monthly_summary_test_failed');
      setAlert({ isOpen: true, type: 'error', title: t('error_title'), message });
    } finally {
      setIsTestingMonthlySummary(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      assertTemplate(templateText);
      const template = normalizeReminderTemplateString(templateText);
      const saved = await onUpdate({
        ...settings,
        notifications: { ...settings.notifications, rules: { ...settings.notifications.rules, template } },
      });
      if (!saved) throw new Error('save_failed');
      setTemplateText(template);
      setAlert({ isOpen: true, type: 'success', title: t('success_title'), message: t('template_saved') });
    } catch (error) {
      const message = error instanceof Error && error.message === 'save_failed'
        ? t('connection_failed')
        : t('template_json_error');
      setAlert({ isOpen: true, type: 'error', title: t('error_title'), message });
    }
  };

  const handleSaveMonthlySummaryTemplate = async () => {
    try {
      assertTemplate(monthlySummaryTemplateText);
      const monthlySummaryTemplate = normalizeMonthlySummaryTemplateString(monthlySummaryTemplateText);
      const saved = await onUpdate({
        ...settings,
        notifications: {
          ...settings.notifications,
          rules: { ...settings.notifications.rules, monthlySummaryTemplate },
        },
      });
      if (!saved) throw new Error('save_failed');
      setMonthlySummaryTemplateText(monthlySummaryTemplate);
      setAlert({ isOpen: true, type: 'success', title: t('success_title'), message: t('template_saved') });
    } catch (error) {
      const message = error instanceof Error && error.message === 'save_failed'
        ? t('connection_failed')
        : t('template_json_error');
      setAlert({ isOpen: true, type: 'error', title: t('error_title'), message });
    }
  };

  const toggleReminderChannel = (channel: NotificationChannel, checked: boolean) => {
    const channels = settings.notifications.rules.channels || {
      renewalReminder: [],
      monthlySummary: [],
    };
    const current = channels.renewalReminder || [];
    const renewalReminder = checked
      ? Array.from(new Set([...current, channel]))
      : current.filter((item) => item !== channel);
    onUpdate({
      ...settings,
      notifications: {
        ...settings.notifications,
        rules: { ...settings.notifications.rules, channels: { ...channels, renewalReminder } },
      },
    });
  };

  const toggleMonthlySummaryChannel = (channel: NotificationChannel, checked: boolean) => {
    const channels = settings.notifications.rules.channels || {
      renewalReminder: [],
      monthlySummary: [],
    };
    const current = channels.monthlySummary || [];
    const monthlySummary = checked
      ? Array.from(new Set([...current, channel]))
      : current.filter((item) => item !== channel);
    onUpdate({
      ...settings,
      notifications: {
        ...settings.notifications,
        rules: { ...settings.notifications.rules, channels: { ...channels, monthlySummary } },
      },
    });
  };

  return {
    templateText, setTemplateText,
    monthlySummaryTemplateText, setMonthlySummaryTemplateText,
    isTestingTelegram, isTestingMonthlySummary,
    handleTestTelegram, handleTestTemplate: handleTestTelegram, handleSaveTemplate,
    handleTestMonthlySummaryTemplate,
    handleSaveMonthlySummaryTemplate,
    toggleReminderChannel, toggleMonthlySummaryChannel,
  };
};
