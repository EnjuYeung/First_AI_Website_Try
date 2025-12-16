import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Apple,
  AppWindowMac,
  Bitcoin,
  BookOpen,
  BrainCircuit,
  Chrome,
  CircleDashed,
  Cloud,
  CreditCard,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  MessageCircle,
  Music,
  PlugZap,
  Popcorn,
  QrCode,
  Rocket,
  Shield,
  SmartphoneNfc,
  Shapes,
  Sparkles,
  Tv,
  Wallet,
  WalletCards,
} from 'lucide-react';

type Tone = {
  bg: string;
  fg: string;
};

const TONES: Record<
  'blue' | 'indigo' | 'cyan' | 'green' | 'amber' | 'orange' | 'pink' | 'purple' | 'gray',
  Tone
> = {
  blue: { bg: 'bg-blue-100/80 dark:bg-blue-900/25', fg: 'text-blue-700 dark:text-blue-300' },
  indigo: { bg: 'bg-indigo-100/80 dark:bg-indigo-900/25', fg: 'text-indigo-700 dark:text-indigo-300' },
  cyan: { bg: 'bg-cyan-100/80 dark:bg-cyan-900/25', fg: 'text-cyan-700 dark:text-cyan-300' },
  green: { bg: 'bg-emerald-100/80 dark:bg-emerald-900/25', fg: 'text-emerald-700 dark:text-emerald-300' },
  amber: { bg: 'bg-amber-100/80 dark:bg-amber-900/25', fg: 'text-amber-800 dark:text-amber-300' },
  orange: { bg: 'bg-orange-100/80 dark:bg-orange-900/25', fg: 'text-orange-800 dark:text-orange-300' },
  pink: { bg: 'bg-pink-100/80 dark:bg-pink-900/25', fg: 'text-pink-700 dark:text-pink-300' },
  purple: { bg: 'bg-purple-100/80 dark:bg-purple-900/25', fg: 'text-purple-700 dark:text-purple-300' },
  gray: { bg: 'bg-slate-100/80 dark:bg-slate-800/60', fg: 'text-slate-700 dark:text-slate-300' },
};

const RING = 'ring-1 ring-black/5 dark:ring-white/10';

function normalize(value: string) {
  return (value || '').trim().toLowerCase();
}

function resolveCategory(category: string): { icon: LucideIcon; tone: Tone } {
  const v = normalize(category);

  if (v.includes('music') || v.includes('音乐')) {
    return { icon: Music, tone: TONES.indigo };
  }

  if (v.includes('game') || v.includes('游戏')) {
    return { icon: Gamepad2, tone: TONES.orange };
  }

  if (
    v === 'ai' ||
    v.startsWith('ai ') ||
    v.endsWith(' ai') ||
    v.includes(' ai ') ||
    v.includes('ai-') ||
    v.includes('ai_') ||
    v.includes('人工智能') ||
    v.includes('智能') ||
    v.includes('machine learning') ||
    v.includes('ml')
  ) {
    return { icon: BrainCircuit, tone: TONES.purple };
  }

  if (v.includes('cloud') || v.includes('云服务') || v.includes('云')) {
    return { icon: Cloud, tone: TONES.cyan };
  }

  if (v.includes('read') || v.includes('reading') || v.includes('阅读') || v.includes('book')) {
    return { icon: BookOpen, tone: TONES.indigo };
  }

  if (v.includes('stream') || v.includes('streaming') || v.includes('流媒体') || v.includes('tv')) {
    return { icon: Tv, tone: TONES.blue };
  }

  if (v.includes('productiv') || v.includes('生产力') || v.includes('效率')) {
    return { icon: Rocket, tone: TONES.amber };
  }

  if (v.includes('insur') || v.includes('保险')) {
    return { icon: Shield, tone: TONES.green };
  }

  if (
    v.includes('entertain') ||
    v.includes('movie') ||
    v.includes('video') ||
    v.includes('娱乐') ||
    v.includes('影视') ||
    v.includes('综艺')
  ) {
    return { icon: Popcorn, tone: TONES.pink };
  }

  if (
    v.includes('software') ||
    v.includes('saas') ||
    v.includes('app') ||
    v.includes('工具') ||
    v.includes('软件') ||
    v.includes('应用')
  ) {
    return { icon: AppWindowMac, tone: TONES.blue };
  }

  if (
    v.includes('util') ||
    v.includes('bill') ||
    v.includes('water') ||
    v.includes('electric') ||
    v.includes('gas') ||
    v.includes('internet') ||
    v.includes('utility') ||
    v.includes('水') ||
    v.includes('电') ||
    v.includes('燃气') ||
    v.includes('宽带') ||
    v.includes('网费')
  ) {
    return { icon: PlugZap, tone: TONES.amber };
  }

  if (
    v.includes('life') ||
    v.includes('lifestyle') ||
    v.includes('fitness') ||
    v.includes('生活') ||
    v.includes('运动') ||
    v.includes('健身')
  ) {
    return { icon: Sparkles, tone: TONES.purple };
  }

  if (v.includes('health') || v.includes('健康') || v.includes('医疗') || v.includes('医')) {
    return { icon: HeartPulse, tone: TONES.green };
  }

  if (v.includes('educ') || v.includes('course') || v.includes('school') || v.includes('学习') || v.includes('教育') || v.includes('课程')) {
    return { icon: GraduationCap, tone: TONES.green };
  }

  return { icon: Shapes, tone: TONES.gray };
}

function resolvePayment(method: string): { icon: LucideIcon; tone: Tone } {
  const v = normalize(method);

  if (v.includes('apple pay') || v.includes('applepay') || v.includes('苹果支付')) return { icon: Apple, tone: TONES.gray };
  if (v.includes('google pay') || v.includes('googlepay') || v.includes('gpay')) return { icon: Chrome, tone: TONES.blue };
  if (v.includes('wechat') || v.includes('微信') || v.includes('wx')) return { icon: MessageCircle, tone: TONES.green };
  if (v.includes('alipay') || v.includes('支付宝')) return { icon: QrCode, tone: TONES.cyan };

  if (v.includes('nfc') || v.includes('tap')) return { icon: SmartphoneNfc, tone: TONES.indigo };
  if (v.includes('credit') || v.includes('信用')) return { icon: CreditCard, tone: TONES.blue };
  if (v.includes('debit') || v.includes('借记')) return { icon: WalletCards, tone: TONES.indigo };
  if (v.includes('crypto') || v.includes('btc') || v.includes('eth') || v.includes('币') || v.includes('加密')) return { icon: Bitcoin, tone: TONES.orange };
  if (v.includes('paypal') || v.includes('pp') || v.includes('贝宝')) return { icon: Wallet, tone: TONES.cyan };

  if (v.includes('other') || v.includes('其他')) return { icon: CircleDashed, tone: TONES.gray };

  return { icon: Wallet, tone: TONES.gray };
}

type BaseGlyphProps = {
  size?: number;
  containerSize?: number;
  className?: string;
  title?: string;
};

function Glyph({
  icon: Icon,
  tone,
  size = 14,
  containerSize = 28,
  className,
  title,
}: BaseGlyphProps & { icon: LucideIcon; tone: Tone }) {
  return (
    <span
      style={{ width: containerSize, height: containerSize }}
      className={`inline-flex items-center justify-center rounded-[10px] ${tone.bg} ${tone.fg} ${RING} ${className || ''}`}
      title={title}
      aria-hidden="true"
    >
      <Icon size={size} strokeWidth={2} />
    </span>
  );
}

export function CategoryGlyph({ category, ...rest }: BaseGlyphProps & { category: string }) {
  const { icon, tone } = resolveCategory(category);
  return <Glyph icon={icon} tone={tone} title={category} {...rest} />;
}

export function PaymentGlyph({ method, ...rest }: BaseGlyphProps & { method: string }) {
  const { icon, tone } = resolvePayment(method);
  return <Glyph icon={icon} tone={tone} title={method} {...rest} />;
}
