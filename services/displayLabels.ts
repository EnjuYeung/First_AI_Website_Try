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

