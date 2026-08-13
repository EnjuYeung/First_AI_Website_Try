import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING,
  renderMonthlySummaryTemplate,
} from '../../shared/monthlySummaryTemplate.js';
import { buildMonthlySummary, previousMonthPeriod } from '../lib/monthlySummary.js';
import { createReminders } from '../lib/reminders.js';

const telegramOk = () => ({
  ok: true,
  status: 200,
  async json() { return { ok: true }; },
});

test('monthly summary counts spend, active subscriptions, additions by cycle, and cancellations', () => {
  const period = previousMonthPeriod('UTC', new Date('2026-02-01T09:00:00Z'));
  const settings = { exchangeRates: { USD: 1, CNY: 7.2 } };
  const subscriptions = [
    {
      name: 'Monthly USD', price: 10, currency: 'USD', frequency: 'Monthly',
      startDate: '2025-12-15', createdAt: '2026-01-02', status: 'active',
    },
    {
      name: 'Quarterly CNY', price: 72, currency: 'CNY', frequency: 'Quarterly',
      startDate: '2026-01-05', createdAt: '2026-01-05', status: 'active',
    },
    {
      name: 'Cancelled yearly', price: 20, currency: 'USD', frequency: 'Yearly',
      startDate: '2026-01-10', createdAt: '2025-12-20', status: 'cancelled',
      cancelledAt: '2026-01-20',
    },
  ];

  assert.deepEqual(buildMonthlySummary(subscriptions, settings, period), {
    periodKey: '2026-01',
    month: '2026年1月',
    totalPaidUsd: 40,
    activeSubscriptions: 2,
    newSubscriptions: '月付 1 个、季付 1 个',
    cancelledSubscriptions: 1,
  });
});

test('monthly summary template omits only statistics whose value is zero', () => {
  const message = renderMonthlySummaryTemplate(DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING, {
    month: '2026年1月',
    totalPaidUsd: 12.5,
    activeSubscriptions: 3,
    newSubscriptions: '',
    cancelledSubscriptions: 0,
  });

  assert.match(message, /本月支出：\$12\.50/);
  assert.match(message, /有效订阅：3 个/);
  assert.doesNotMatch(message, /新增订阅/);
  assert.doesNotMatch(message, /取消订阅/);

  const emptyMessage = renderMonthlySummaryTemplate(DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING, {
    month: '2026年1月',
    totalPaidUsd: 0,
    activeSubscriptions: 0,
    newSubscriptions: '',
    cancelledSubscriptions: 0,
  });
  assert.equal(emptyMessage, '📊 2026年1月 月度总结');
});

test('monthly summary treats a missing exchange rate as zero instead of USD', () => {
  const period = previousMonthPeriod('UTC', new Date('2026-02-01T09:00:00Z'));
  const summary = buildMonthlySummary(
    [{
      name: 'CNY only', price: 72, currency: 'CNY', frequency: 'Monthly',
      startDate: '2026-01-05', createdAt: '2026-01-05', status: 'active',
    }],
    { exchangeRates: { USD: 1 } },
    period,
  );
  assert.equal(summary.totalPaidUsd, 0);
});

test('monthly summary sends once per channel after 09:00 on day one', async (t) => {
  let sendCount = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    sendCount += 1;
    return telegramOk();
  });
  const holder = {
    settings: {
      timezone: 'UTC',
      exchangeRates: { USD: 1 },
      notifications: {
        telegram: { enabled: true, botToken: '123456:test-token', chatId: 'chat-1' },
        email: { enabled: false, emailAddress: '' },
        rules: {
          renewalReminder: false,
          monthlySummary: true,
          monthlySummaryTemplate: DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING,
          channels: { renewalReminder: [], monthlySummary: ['telegram'] },
        },
      },
    },
    subscriptions: [{
      id: 'sub-1', name: 'Example', price: 10, currency: 'USD', frequency: 'Monthly',
      startDate: '2026-01-05', createdAt: '2026-01-02', status: 'active',
    }],
    notifications: [],
  };
  const storage = {
    async loadUserData() { return structuredClone(holder); },
    async updateUserData(_username, updater) {
      const next = (await updater(structuredClone(holder))) || holder;
      Object.assign(holder, structuredClone(next));
      return structuredClone(holder);
    },
  };
  const reminders = createReminders({
    config: { adminUser: 'admin', timeZone: 'UTC', debugTelegram: false },
    storage,
    email: { async sendEmailMessage() {} },
  });

  await reminders.processMonthlySummaries(new Date('2026-02-01T08:59:00Z'));
  assert.equal(sendCount, 0);
  await reminders.processMonthlySummaries(new Date('2026-02-01T09:00:00Z'));
  await reminders.processMonthlySummaries(new Date('2026-02-01T09:10:00Z'));

  assert.equal(sendCount, 1);
  assert.equal(holder.notifications.length, 1);
  assert.equal(holder.notifications[0].type, 'monthly_summary');
  assert.equal(holder.notifications[0].details.periodKey, '2026-01');
  assert.equal(holder.notifications[0].status, 'success');
});
