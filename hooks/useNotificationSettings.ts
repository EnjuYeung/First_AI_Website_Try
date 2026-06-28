import { useEffect, useState } from 'react';
import { AppSettings, NotificationChannel } from '../types';
import { apiFetchJson, authJsonHeaders } from '../services/apiClient';
import { normalizeReminderTemplateString } from '../shared/reminderTemplate.js';
import { SettingsAlert } from './settingsTypes';

const assertTemplate = (raw: string) => {
  const parsed = JSON.parse(raw || '');
  if (!Array.isArray(parsed?.lines) || !parsed.lines.length) throw new Error('invalid_template');
};

export const useNotificationSettings = (
  settings: AppSettings,
  onUpdate: (settings: AppSettings) => void,
  t: (key: any) => string,
  setAlert: (alert: SettingsAlert) => void
) => {
  const [templateText, setTemplateText] = useState(settings.notifications.rules.template);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  useEffect(() => setTemplateText(settings.notifications.rules.template), [settings.notifications.rules.template]);

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    try {
      assertTemplate(templateText);
      await apiFetchJson('/api/notifications/test-telegram', {
        method: 'POST', headers: authJsonHeaders(), body: JSON.stringify({ template: templateText }),
      });
      setAlert({ isOpen: true, type: 'success', title: t('success_title'), message: 'Message sent successfully! Check your Telegram.' });
    } catch (err: any) {
      const message = err?.message === 'telegram_not_configured'
        ? 'Please enable Telegram notifications and fill Bot Token + Chat ID first.'
        : err?.message === 'invalid_template'
          ? '模板格式错误，请输入包含 lines 数组的 JSON。'
          : err?.message || 'Telegram test failed. Check your settings.';
      setAlert({ isOpen: true, type: 'error', title: t('error_title'), message });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleSaveTemplate = () => {
    try {
      assertTemplate(templateText);
      const template = normalizeReminderTemplateString(templateText);
      onUpdate({
        ...settings,
        notifications: { ...settings.notifications, rules: { ...settings.notifications.rules, template } },
      });
      setTemplateText(template);
      setAlert({ isOpen: true, type: 'success', title: t('success_title'), message: '模板已保存' });
    } catch {
      setAlert({ isOpen: true, type: 'error', title: t('error_title'), message: '模板格式错误，请输入包含 lines 数组的 JSON。' });
    }
  };

  const toggleReminderChannel = (channel: NotificationChannel, checked: boolean) => {
    const channels = settings.notifications.rules.channels || { renewalReminder: [] };
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

  return {
    templateText, setTemplateText, isTestingTelegram,
    handleTestTelegram, handleTestTemplate: handleTestTelegram, handleSaveTemplate,
    toggleReminderChannel,
  };
};
