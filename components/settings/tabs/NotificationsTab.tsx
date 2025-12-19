import React from 'react';
import { Loader2, Mail, Save, Send } from 'lucide-react';
import { AppSettings, NotificationChannel } from '../../../types';

type Props = {
  t: (key: any) => string;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;

  templateText: string;
  setTemplateText: React.Dispatch<React.SetStateAction<string>>;
  handleSaveTemplate: () => void;
  handleTestTemplate: () => void;

  isTestingTelegram: boolean;
  handleTestTelegram: () => void;

  toggleReminderChannel: (channel: NotificationChannel, checked: boolean) => void;
};

const NotificationsTab: React.FC<Props> = ({
  t,
  settings,
  onUpdateSettings,
  templateText,
  setTemplateText,
  handleSaveTemplate,
  handleTestTemplate,
  isTestingTelegram,
  handleTestTelegram,
  toggleReminderChannel,
}) => {
  const telegram = settings.notifications.telegram;
  const email = settings.notifications.email;
  const rules = settings.notifications.rules;
  const selectedChannels = rules.channels?.renewalReminder || [];

  const setTelegram = (patch: Partial<typeof telegram>) =>
    onUpdateSettings({
      ...settings,
      notifications: { ...settings.notifications, telegram: { ...telegram, ...patch } },
    });

  const setEmail = (patch: Partial<typeof email>) =>
    onUpdateSettings({
      ...settings,
      notifications: { ...settings.notifications, email: { ...email, ...patch } },
    });

  const setRules = (patch: Partial<typeof rules>) =>
    onUpdateSettings({
      ...settings,
      notifications: { ...settings.notifications, rules: { ...rules, ...patch } },
    });

  return (
    <div className="space-y-8 max-w-4xl">
      <section className="space-y-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('channels')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl h-full space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send size={20} className="text-blue-500" />
                <span className="font-semibold dark:text-white">{t('telegram_bot')}</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegram.enabled}
                  onChange={(e) => setTelegram({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {telegram.enabled && (
              <div className="space-y-3">
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Bot Token"
                  className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white"
                  value={telegram.botToken}
                  onChange={(e) => setTelegram({ botToken: e.target.value })}
                />
                <div className="flex gap-2">
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Chat ID"
                    className="flex-1 px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white"
                    value={telegram.chatId}
                    onChange={(e) => setTelegram({ chatId: e.target.value })}
                  />
                  <button
                    onClick={handleTestTelegram}
                    disabled={isTestingTelegram || !telegram.botToken || !telegram.chatId}
                    className="px-4 py-2 bg-gray-100 dark:bg-slate-600 dark:text-white rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isTestingTelegram ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    <span>Test</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl h-full space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail size={20} className="text-blue-500" />
                <span className="font-semibold dark:text-white">{t('email')}</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={email.enabled}
                  onChange={(e) => setEmail({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {email.enabled && (
              <input
                type="email"
                placeholder="Email Address"
                className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white"
                value={email.emailAddress}
                onChange={(e) => setEmail({ emailAddress: e.target.value })}
              />
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('rules')}</h3>

        <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rules.renewalReminder}
              onChange={(e) => setRules({ renewalReminder: e.target.checked })}
              className="w-5 h-5 text-primary-600 rounded"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('renewal_reminder')}</span>
          </div>

          {rules.renewalReminder && (
            <>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <label className="text-sm text-gray-600 dark:text-gray-400">{t('remind_me')}</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="w-16 px-2 py-1 border rounded dark:bg-slate-900 dark:border-gray-600 dark:text-white text-center"
                  value={rules.reminderDays}
                  onChange={(e) => setRules({ reminderDays: parseInt(e.target.value || '0', 10) })}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('days_before')}</span>
              </div>

              <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                {(['telegram', 'email'] as NotificationChannel[]).map((ch) => {
                  const channelEnabled = (settings.notifications as any)[ch]?.enabled;
                  const selected = selectedChannels.includes(ch);
                  return (
                    <label
                      key={ch}
                      className={`flex items-center gap-2 text-sm ${
                        channelEnabled ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={!channelEnabled}
                        checked={selected}
                        onChange={(e) => toggleReminderChannel(ch, e.target.checked)}
                        className="w-4 h-4 accent-primary-600"
                      />
                      <span>{ch === 'telegram' ? t('telegram_bot') : t('email')}</span>
                      {!channelEnabled && <span className="text-xs">({t('enable_notifications')})</span>}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
          <div>
            <p className="text-gray-800 dark:text-white font-medium">通知模板 (JSON)</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              使用 lines 数组，支持 {'{{name}}'}, {'{{nextBillingDate}}'}, {'{{price}}'}, {'{{currency}}'}, {'{{paymentMethod}}'}
            </p>
          </div>
          <textarea
            value={templateText}
            onChange={(e) => setTemplateText(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border rounded-lg font-mono text-sm bg-gray-50 dark:bg-slate-800 dark:border-gray-700 dark:text-white"
          />
          <div className="flex gap-3">
            <button
              onClick={handleSaveTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Save size={16} /> 保存模板
            </button>
            <button
              onClick={handleTestTemplate}
              disabled={isTestingTelegram}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white ${
                isTestingTelegram ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isTestingTelegram ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} 测试模板
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default NotificationsTab;

