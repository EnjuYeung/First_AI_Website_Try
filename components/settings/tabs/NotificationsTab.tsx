import React, { useEffect, useRef, useState } from 'react';
import { BellRing, CalendarClock, Code2, Loader2, Mail, Save, Send } from 'lucide-react';
import { AppSettings, SettingsUpdate, NotificationChannel } from '../../../types';

type Props = {
  t: (key: any) => string;
  settings: AppSettings;
  onUpdateSettings: (patch: SettingsUpdate) => boolean | Promise<boolean>;
  templateText: string;
  setTemplateText: React.Dispatch<React.SetStateAction<string>>;
  monthlySummaryTemplateText: string;
  setMonthlySummaryTemplateText: React.Dispatch<React.SetStateAction<string>>;
  handleSaveTemplate: () => void;
  handleSaveMonthlySummaryTemplate: () => void;
  handleTestTemplate: () => void;
  handleTestMonthlySummaryTemplate: () => void;
  isTestingTelegram: boolean;
  isTestingMonthlySummary: boolean;
  handleTestTelegram: () => void;
  toggleReminderChannel: (channel: NotificationChannel, checked: boolean) => void;
  toggleMonthlySummaryChannel: (channel: NotificationChannel, checked: boolean) => void;
};

const Toggle = ({ checked, onChange, label }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) => (
  <label className="notification-toggle">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="sr-only peer"
      aria-label={label}
    />
    <span aria-hidden="true" />
  </label>
);

const ChannelPicker = ({ settings, selected, onToggle, t }: {
  settings: AppSettings;
  selected: NotificationChannel[];
  onToggle: (channel: NotificationChannel, checked: boolean) => void;
  t: (key: any) => string;
}) => (
  <div className="notification-channel-picker">
    {(['telegram', 'email'] as NotificationChannel[]).map((channel) => {
      const enabled = settings.notifications[channel].enabled;
      return (
        <label key={channel} data-disabled={!enabled}>
          <input
            type="checkbox"
            disabled={!enabled}
            checked={selected.includes(channel)}
            onChange={(event) => onToggle(channel, event.target.checked)}
          />
          {channel === 'telegram' ? <Send size={15} /> : <Mail size={15} />}
          <span>{channel === 'telegram' ? t('telegram_bot') : t('email')}</span>
          {!enabled && <small>{t('not_enabled')}</small>}
        </label>
      );
    })}
  </div>
);

const TemplateEditor = ({ value, onChange, onSave, hint, label, t, canTest, onTest, testing }: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  hint: React.ReactNode;
  label: string;
  t: (key: any) => string;
  canTest?: boolean;
  onTest?: () => void;
  testing?: boolean;
}) => (
  <div className="notification-template-editor">
    <div className="flex items-start gap-3">
      <span className="notification-code-mark"><Code2 size={16} /></span>
      <div>
        <strong>{t('json_template')}</strong>
        <p>{hint}</p>
      </div>
    </div>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={9}
      spellCheck={false}
      aria-label={`${label} · ${t('json_template')}`}
    />
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onSave} className="primary-action flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
        <Save size={15} />{t('save_template')}
      </button>
      {canTest && (
        <button type="button" onClick={onTest} disabled={testing} className="secondary-action flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {testing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {t('test_template')}
        </button>
      )}
    </div>
  </div>
);

const NotificationsTab: React.FC<Props> = ({
  t,
  settings,
  onUpdateSettings,
  templateText,
  setTemplateText,
  monthlySummaryTemplateText,
  setMonthlySummaryTemplateText,
  handleSaveTemplate,
  handleSaveMonthlySummaryTemplate,
  handleTestTemplate,
  handleTestMonthlySummaryTemplate,
  isTestingTelegram,
  isTestingMonthlySummary,
  handleTestTelegram,
  toggleReminderChannel,
  toggleMonthlySummaryChannel,
}) => {
  const [telegram, updateTelegram] = useState(settings.notifications.telegram);
  const [email, updateEmail] = useState(settings.notifications.email);
  const dirty = useRef({ telegram: false, email: false });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const rules = settings.notifications.rules;
  useEffect(() => {
    if (!dirty.current.telegram) updateTelegram(settings.notifications.telegram);
    if (!dirty.current.email) updateEmail(settings.notifications.email);
  }, [settings.notifications.telegram, settings.notifications.email]);
  const setTelegram = (patch: Partial<typeof telegram>) => {
    dirty.current.telegram = true;
    updateTelegram(value => ({ ...value, ...patch }));
  };
  const setEmail = (patch: Partial<typeof email>) => {
    dirty.current.email = true;
    updateEmail(value => ({ ...value, ...patch }));
  };
  const saveChannels = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const saved = await onUpdateSettings({
        notifications: { telegram, email },
      });
      if (!saved) throw new Error('save_failed');
      dirty.current = { telegram: false, email: false };
      return true;
    } catch {
      setSaveError(t('save_failed_detail'));
      return false;
    } finally { setSaving(false); }
  };
  const testConnection = async () => {
    if (await saveChannels()) handleTestTelegram();
  };
  const setRules = (patch: Partial<typeof rules>) => onUpdateSettings({
    notifications: { rules: patch },
  });

  return (
    <div className="max-w-4xl space-y-8">
      <section>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-[var(--ink)]">{t('channels')}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('channels_shared_hint')}</p>
        </div>
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
          <div className="notification-connection-card">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5"><Send size={18} /><strong>{t('telegram_bot')}</strong></div>
              <Toggle checked={telegram.enabled} onChange={(enabled) => setTelegram({ enabled })} label={t('telegram_bot')} />
            </div>
            {telegram.enabled && (
              <div className="mt-4 space-y-2.5">
                <input type="password" autoComplete="new-password" placeholder="Bot Token" value={telegram.botToken} onChange={(event) => setTelegram({ botToken: event.target.value })} />
                <div className="flex gap-2">
                  <input className="min-w-0 flex-1" type="password" autoComplete="new-password" placeholder="Chat ID" value={telegram.chatId} onChange={(event) => setTelegram({ chatId: event.target.value })} />
                  <button type="button" onClick={testConnection} disabled={saving || isTestingTelegram || !telegram.botToken || !telegram.chatId} className="secondary-action rounded-xl px-3 disabled:opacity-50" aria-label={t('test_connection')}>
                    {isTestingTelegram ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="notification-connection-card">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5"><Mail size={18} /><strong>{t('email')}</strong></div>
              <Toggle checked={email.enabled} onChange={(enabled) => setEmail({ enabled })} label={t('email')} />
            </div>
            {email.enabled && (
              <input className="mt-4" type="email" placeholder={t('email_address')} value={email.emailAddress} onChange={(event) => setEmail({ emailAddress: event.target.value })} />
            )}
          </div>
        </fieldset>
        <button type="button" disabled={saving} onClick={saveChannels} className="secondary-action mt-4 rounded-xl px-4 py-2">
          {t('save')} · {t('channels')}
        </button>
        {saveError && <p role="alert">{saveError}</p>}
      </section>

      <section>
        <h3 className="mb-4 text-lg font-bold text-[var(--ink)]">{t('rules')}</h3>
        <div className="space-y-5">
          <article className="notification-rule-card" data-kind="renewal">
            <header>
              <div className="notification-rule-icon"><BellRing size={20} /></div>
              <div className="min-w-0 flex-1">
                <h4>{t('renewal_reminder')}</h4>
                <p>{t('renewal_rule_hint')}</p>
              </div>
              <Toggle checked={rules.renewalReminder} onChange={(renewalReminder) => setRules({ renewalReminder })} label={t('renewal_reminder')} />
            </header>
            {rules.renewalReminder && (
              <div className="notification-rule-body">
                <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                  <span>{t('remind_me')}</span>
                  <input className="w-16 rounded-lg border px-2 py-1 text-center" type="number" min="0" max="365" value={rules.reminderDays} onChange={(event) => setRules({ reminderDays: Number(event.target.value) })} />
                  <span>{t('days_before')}</span>
                </div>
                <ChannelPicker settings={settings} selected={rules.channels.renewalReminder} onToggle={toggleReminderChannel} t={t} />
                <TemplateEditor
                  value={templateText}
                  onChange={setTemplateText}
                  onSave={handleSaveTemplate}
                  hint={<>{t('renewal_template_tokens')} {'{{name}} · {{nextBillingDate}} · {{price}} · {{currency}} · {{paymentMethod}}'}</>}
                  label={t('renewal_reminder')}
                  t={t}
                  canTest
                  onTest={handleTestTemplate}
                  testing={isTestingTelegram}
                />
              </div>
            )}
          </article>

          <article className="notification-rule-card" data-kind="summary">
            <header>
              <div className="notification-rule-icon"><CalendarClock size={20} /></div>
              <div className="min-w-0 flex-1">
                <h4>{t('monthly_summary')}</h4>
                <p>{t('monthly_summary_schedule')}</p>
              </div>
              <Toggle checked={rules.monthlySummary} onChange={(monthlySummary) => setRules({ monthlySummary })} label={t('monthly_summary')} />
            </header>
            {rules.monthlySummary && (
              <div className="notification-rule-body">
                <ChannelPicker settings={settings} selected={rules.channels.monthlySummary} onToggle={toggleMonthlySummaryChannel} t={t} />
                <TemplateEditor
                  value={monthlySummaryTemplateText}
                  onChange={setMonthlySummaryTemplateText}
                  onSave={handleSaveMonthlySummaryTemplate}
                  hint={<>{t('monthly_summary_tokens')} {'{{month}} · {{totalPaidUsd}} · {{activeSubscriptions}} · {{newSubscriptions}} · {{cancelledSubscriptions}}'}</>}
                  label={t('monthly_summary')}
                  t={t}
                  canTest
                  onTest={handleTestMonthlySummaryTemplate}
                  testing={isTestingMonthlySummary}
                />
                <p className="notification-zero-note">{t('monthly_summary_zero_note')}</p>
              </div>
            )}
          </article>
        </div>
      </section>
    </div>
  );
};

export default NotificationsTab;
