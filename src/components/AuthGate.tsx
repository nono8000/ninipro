import React, { useState } from 'react';
import { ThemeMode, SubscriptionUser } from '../types';
import { THEMES } from '../utils/theme';
import { ThemeSelector } from './ThemeSelector';
import { verifySubscriptionCode } from '../utils/subscription';
import { KeyRound, ShieldCheck, Sparkles, ArrowLeft, CheckCircle2, AlertCircle, Crown, Lock, Radio, ShoppingCart, Zap, HardDrive, Clock, MessageCircle, Copy, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AuthGateProps {
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onAuthenticated: (user: SubscriptionUser) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  currentTheme,
  onThemeChange,
  onAuthenticated,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [copiedContact, setCopiedContact] = useState(false);
  const theme = THEMES[currentTheme];

  const SUPPORT_CONTACT = '@SasaX60';

  const handleCopyContact = () => {
    navigator.clipboard.writeText(SUPPORT_CONTACT);
    setCopiedContact(true);
    setTimeout(() => setCopiedContact(false), 2000);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!code.trim()) {
      setError('لطفاً کد اشتراک معتبر وارد کنید.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    setTimeout(() => {
      const res = verifySubscriptionCode(code);
      setLoading(false);
      if (res.success && res.user) {
        // Trigger celebratory confetti for valid subscription activation
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: currentTheme === 'pink' ? ['#f43f5e', '#ec4899', '#fbcfe8'] : currentTheme === 'yellow' ? ['#eab308', '#facc15', '#fef08a'] : ['#ffffff', '#a1a1aa', '#71717a']
        });
        onAuthenticated(res.user);
      } else {
        setError(res.error || 'کد اشتراک نامعتبر است.');
      }
    }, 450);
  };

  return (
    <div
      id="auth-gate-container"
      className={`min-h-screen w-full transition-colors duration-500 ${theme.bgClass} flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-hidden`}
    >
      {/* Dynamic Ambient Background Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[140px] opacity-30 ${
            currentTheme === 'pink'
              ? 'bg-rose-500'
              : currentTheme === 'yellow'
              ? 'bg-yellow-500'
              : 'bg-zinc-400'
          }`}
        />
        <div
          className={`absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-[140px] opacity-25 ${
            currentTheme === 'pink'
              ? 'bg-fuchsia-600'
              : currentTheme === 'yellow'
              ? 'bg-amber-600'
              : 'bg-zinc-600'
          }`}
        />
      </div>

      {/* Header bar with theme selector */}
      <header className="w-full max-w-md flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-yellow-400 flex items-center justify-center shadow-md">
            <Radio className="w-4 h-4 text-black animate-pulse" />
          </div>
          <span className="font-mono text-lg font-black tracking-wider text-white">
            nini<span className={theme.accent}>pro</span>
          </span>
        </div>
        <ThemeSelector currentTheme={currentTheme} onSelectTheme={onThemeChange} compact />
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-md my-auto z-10">
        <div
          id="auth-card"
          className={`rounded-3xl border ${theme.cardBorder} ${theme.cardBg} p-6 sm:p-8 shadow-2xl transition-all duration-300 relative`}
        >
          {/* Top Logo / Icon */}
          <div className="flex flex-col items-center text-center mb-6">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 border ${theme.accentBorder} ${
                currentTheme === 'pink'
                  ? 'bg-pink-950/60 text-pink-400 shadow-pink-500/20'
                  : currentTheme === 'yellow'
                  ? 'bg-yellow-950/60 text-yellow-400 shadow-yellow-500/20'
                  : 'bg-zinc-900/80 text-white shadow-white/10'
              } shadow-xl`}
            >
              <KeyRound className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-2 bg-white/5 border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>سامانه هوشمند کانفیگ خور و پروکسی تلگرام</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              ورود به اپلیکیشن <span className={theme.accent}>ninipro</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              جهت دسترسی به سرورها و ابزارها، کد اشتراک خود را وارد کنید
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="subscription-code-input" className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>کد اشتراک (Subscription Code):</span>
                <span className="text-[11px] text-zinc-500 font-mono">حساس به حروف نیست</span>
              </label>

              <div className="relative">
                <input
                  id="subscription-code-input"
                  type="text"
                  dir="ltr"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (error) setError(null);
                    if (success) setSuccess(null);
                  }}
                  placeholder="کد اشتراک خریداری‌شده خود را وارد کنید"
                  className={`w-full px-4 py-3.5 rounded-2xl bg-black/60 border ${
                    error ? 'border-red-500/80 ring-2 ring-red-500/30' : 'border-white/15 focus:border-white/40'
                  } text-white font-mono text-center tracking-widest text-base placeholder:text-zinc-600 focus:outline-none transition-all`}
                  autoFocus
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/40 p-2.5 rounded-xl border border-red-800/40 animate-fade-in mt-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all duration-300 active:scale-98 ${theme.accentBg}`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>فعال‌سازی و ورود به برنامه</span>
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Purchase CTA */}
          <div className="mt-3">
            <button
              type="button"
              id="purchase-subscription-btn"
              onClick={() => setShowPurchase(true)}
              className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-500/20 hover:from-emerald-500/30 hover:to-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-black flex items-center justify-center gap-2 transition-all group shadow-sm"
            >
              <ShoppingCart className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>خرید کد اشتراک (فعال‌سازی فوری)</span>
            </button>
          </div>

          {/* Subscription Plans Highlight */}
          <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-black/30 border border-white/5">
              <Zap className="w-4 h-4 mx-auto text-yellow-400 mb-1" />
              <span className="block text-[10px] font-bold text-white">اشتراک ماهانه</span>
              <span className="block text-[10px] text-zinc-400 mt-0.5">۳۰ روز</span>
            </div>
            <div className="p-2 rounded-xl bg-black/30 border border-white/5">
              <Clock className="w-4 h-4 mx-auto text-pink-400 mb-1" />
              <span className="block text-[10px] font-bold text-white">اشتراک سالانه</span>
              <span className="block text-[10px] text-zinc-400 mt-0.5">۳۶۵ روز</span>
            </div>
            <div className="p-2 rounded-xl bg-black/30 border border-white/5">
              <HardDrive className="w-4 h-4 mx-auto text-cyan-400 mb-1" />
              <span className="block text-[10px] font-bold text-white">نامحدود</span>
              <span className="block text-[10px] text-zinc-400 mt-0.5">بدون محدودیت حجم</span>
            </div>
          </div>

          {/* Protocols Highlight */}
          <div className="mt-4 p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
            <span className="font-semibold text-zinc-300">پشتیبانی کامل از پروتکل‌ها:</span>
            <span className="font-mono font-bold text-white">VLESS • VMess • Trojan • SS • Hy2</span>
          </div>
        </div>
      </main>

      {/* Purchase Modal */}
      {showPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className={`w-full max-w-md rounded-3xl border ${theme.cardBorder} ${theme.cardBg} shadow-2xl overflow-hidden`}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-black flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white">خرید کد اشتراک ninipro</h2>
                  <p className="text-[11px] text-zinc-400">فعال‌سازی آنی پس از پرداخت</p>
                </div>
              </div>
              <button
                onClick={() => setShowPurchase(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plans */}
            <div className="p-5 space-y-3">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    اشتراک یک‌ماهه
                  </span>
                  <span className="font-mono font-black text-yellow-400 text-sm">۳۰ روزه</span>
                </div>
                <p className="text-[11px] text-zinc-400">دسترسی کامل به تمام سرورها و پروتکل‌ها با پشتیبانی ۲۴/۷</p>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-yellow-500/30 space-y-2 relative overflow-hidden">
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-[9px] font-bold">
                  پیشنهاد ویژه
                </span>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-yellow-400" />
                    اشتراک سالانه VIP
                  </span>
                  <span className="font-mono font-black text-yellow-400 text-sm">۳۶۵ روزه</span>
                </div>
                <p className="text-[11px] text-zinc-400">تمام امکانات + اولویت سرورهای کم‌پینگ + پشتیبانی اختصاصی</p>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    اشتراک نامحدود
                  </span>
                  <span className="font-mono font-black text-cyan-400 text-sm">♾️ دائمی</span>
                </div>
                <p className="text-[11px] text-zinc-400">بدون محدودیت زمان و حجم — مناسب استفاده حرفه‌ای</p>
              </div>

              {/* How to buy */}
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 space-y-2.5">
                <h3 className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4" />
                  نحوه خرید:
                </h3>
                <ol className="text-[11px] text-zinc-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>به پشتیبانی تلگرام پیام بدهید</li>
                  <li>نوع اشتراک و مدت زمان را انتخاب کنید</li>
                  <li>پس از پرداخت، کد اشتراک را دریافت می‌کنید</li>
                  <li>کد را در صفحه ورود وارد و فعال کنید</li>
                </ol>
                <button
                  type="button"
                  onClick={handleCopyContact}
                  className="w-full mt-1 py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                >
                  {copiedContact ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>کپی شد!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>آیدی پشتیبانی: {SUPPORT_CONTACT}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full max-w-md text-center text-xs text-zinc-500 py-2 z-10 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>سیستم رمزنگاری امن اختصاصی ninipro v3.5</span>
      </footer>
    </div>
  );
};
