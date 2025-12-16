import { Frequency } from '../types';

export type Lang = 'en' | 'zh';

const CATEGORY_ZH: Record<string, string> = {
  Entertainment: '娱乐',
  Software: '软件',
  Utilities: '公用事业',
  Lifestyle: '生活',
  Education: '教育',
  AI: 'AI',
  'Cloud Services': '云服务',
  Reading: '阅读',
  Streaming: '流媒体',
  Productivity: '生产力',
  Insurance: '保险',
  Other: '其他',
};

const PAYMENT_ZH: Record<string, string> = {
  'Credit Card': '信用卡',
  'Debit Card': '借记卡',
  'Apple Pay': 'Apple Pay',
  'Google Pay': 'Google Pay',
  'WeChat Pay': '微信支付',
  Alipay: '支付宝',
  Crypto: '加密货币',
  PayPal: 'PayPal',
  Other: '其他',
};

export function displayCategoryLabel(category: string, lang: Lang): string {
  if (lang !== 'zh') return category;
  return CATEGORY_ZH[category] || category;
}

export function displayPaymentMethodLabel(method: string, lang: Lang): string {
  if (lang !== 'zh') return method;
  return PAYMENT_ZH[method] || method;
}

const cleanKey = (value: string) =>
  (value || '')
    .trim()
    .replace(/[\/、，,]+$/g, '')
    .replace(/\s+/g, ' ');

export function canonicalCategoryKey(value: string): string {
  const raw = cleanKey(value);
  const v = raw.toLowerCase();

  const map: Record<string, string> = {
    entertainment: 'Entertainment',
    娱乐: 'Entertainment',
    software: 'Software',
    软件: 'Software',
    utilities: 'Utilities',
    utility: 'Utilities',
    公用事业: 'Utilities',
    lifestyle: 'Lifestyle',
    生活: 'Lifestyle',
    education: 'Education',
    教育: 'Education',
    ai: 'AI',
    云服务: 'Cloud Services',
    'cloud services': 'Cloud Services',
    cloud: 'Cloud Services',
    reading: 'Reading',
    阅读: 'Reading',
    streaming: 'Streaming',
    流媒体: 'Streaming',
    productivity: 'Productivity',
    生产力: 'Productivity',
    insurance: 'Insurance',
    保险: 'Insurance',
    other: 'Other',
    其他: 'Other',
  };

  if (map[v]) return map[v];
  if (raw.includes('公用事业')) return 'Utilities';
  return raw;
}

export function canonicalPaymentMethodKey(value: string): string {
  const raw = cleanKey(value);
  const v = raw.toLowerCase();

  const map: Record<string, string> = {
    'credit card': 'Credit Card',
    信用卡: 'Credit Card',
    'debit card': 'Debit Card',
    借记卡: 'Debit Card',
    'apple pay': 'Apple Pay',
    'google pay': 'Google Pay',
    'wechat pay': 'WeChat Pay',
    微信支付: 'WeChat Pay',
    alipay: 'Alipay',
    支付宝: 'Alipay',
    crypto: 'Crypto',
    加密货币: 'Crypto',
    paypal: 'PayPal',
    other: 'Other',
    其他: 'Other',
  };

  if (map[v]) return map[v];
  return raw;
}

export function displayFrequencyLabel(freq: Frequency | string, lang: Lang): string {
  if (lang !== 'zh') return String(freq);
  switch (freq) {
    case Frequency.MONTHLY:
      return '月度';
    case Frequency.QUARTERLY:
      return '季度';
    case Frequency.SEMI_ANNUALLY:
      return '半年';
    case Frequency.YEARLY:
      return '年度';
    default:
      return String(freq);
  }
}
