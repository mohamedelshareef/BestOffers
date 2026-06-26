import type { Locale } from '@bestoffers/shared';

/**
 * Bilingual string table (AR-first; EN mirror). Keeps copy out of components so the RTL/AR-first
 * experience stays consistent (design system PART 1). Covers the demo flow W6→W7→W9 PLUS the
 * Phase-2b owner features: OTP login, profile, settings, paywall, subscription, quota pill.
 * A fuller i18n lib (ICU/plurals) is a later slice; `tn` does a tiny {n} interpolation for counts.
 */
const STRINGS = {
  // ── existing search flow ──
  appName: { ar: 'أفضل العروض', en: 'BestOffers' },
  sectorElectronics: { ar: 'إلكترونيات', en: 'Electronics' },
  sectorFood: { ar: 'الطعام', en: 'Food' },

  // ── category select (B1, screen 0) ──
  catEyebrow: { ar: 'أفضل العروض', en: 'BESTOFFERS' },
  catTitle: { ar: 'شنو تبي تلقّى اليوم؟', en: 'What do you want to find today?' },
  catSub: {
    ar: 'اختر القسم، ونلقّى لك أفضل عرض — بلا إعلانات مدفوعة.',
    en: "Pick a category and we'll find the best offer — no paid ads.",
  },
  catElectronics: { ar: 'الإلكترونيات', en: 'Electronics' },
  catFood: { ar: 'الطعام', en: 'Food' },
  catRealEstate: { ar: 'عقارات (شقق)', en: 'Real Estate (Flats)' },
  catFurniture: { ar: 'الأثاث', en: 'Furniture' },
  catCars: { ar: 'السيارات', en: 'Cars' },
  catSoon: { ar: 'قريباً', en: 'Soon' },
  catNote: {
    ar: 'نضيف أقساماً جديدة قريباً. ابدأ بالإلكترونيات أو الطعام أو العقارات.',
    en: 'New categories coming soon. Start with Electronics, Food or Real Estate.',
  },
  viewOnInstagram: { ar: 'شوف على إنستقرام', en: 'View on Instagram' },
  intentTitle: { ar: 'شنو تدوّر؟', en: 'What are you looking for?' },
  intentPlaceholder: { ar: 'مثال: آيفون 17 برو ماكس', en: 'e.g. iPhone 17 Pro Max' },
  searchCta: { ar: 'ابحث', en: 'Search' },
  newSearch: { ar: 'بحث جديد', en: 'New search' },
  skip: { ar: 'تخطّي', en: 'Skip' },
  searching: { ar: 'نبحث في المتاجر…', en: 'Searching providers…' },
  resultsTitle: { ar: 'أفضل العروض', en: 'Best offers' },
  emptyTitle: { ar: 'لا نتائج — وسّع أو عدّل البحث', en: 'No results — broaden or edit your search' },
  goToStore: { ar: 'اذهب للمتجر', en: 'Go to store' },
  langToggle: { ar: 'EN', en: 'ع' },
  questionOf: { ar: 'سؤال', en: 'Question' },
  progressOf: { ar: 'من', en: 'of' },
  narrowingTitle: { ar: 'نضيّق نتائجك', en: 'Narrowing your results' },
  retry: { ar: 'إعادة المحاولة', en: 'Retry' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  save: { ar: 'حفظ', en: 'Save' },
  done: { ar: 'تم', en: 'Done' },
  back: { ar: 'رجوع', en: 'Back' },

  // ── quota pill (N8 / D1, F-D2) ──
  quotaFreeLeft: { ar: '{n} عمليات بحث مجانية', en: '{n} free searches left' },
  quotaLastFree: { ar: 'بحث مجاني أخير', en: '1 free search left' },
  quotaSubscribe: { ar: 'اشترك للمتابعة', en: 'Subscribe to continue' },
  proBadge: { ar: 'مشترك', en: 'Pro' },

  // ── OTP login (C1/C2, F-C1) ──
  signIn: { ar: 'سجّل الدخول', en: 'Sign in' },
  signInHint: { ar: 'سنرسل رمزاً عبر واتساب', en: "We'll send a code via WhatsApp" },
  phoneLabel: { ar: 'رقم الهاتف', en: 'Phone number' },
  sendViaWhatsapp: { ar: 'إرسال عبر واتساب', en: 'Send via WhatsApp' },
  sendViaSms: { ar: 'إرسال عبر SMS بدلاً من ذلك', en: 'Send via SMS instead' },
  channelWhatsapp: { ar: 'واتساب', en: 'WhatsApp' },
  channelSms: { ar: 'SMS', en: 'SMS' },
  otpTitle: { ar: 'أدخل الرمز', en: 'Enter the code' },
  otpSentVia: { ar: 'أرسلنا رمزاً عبر {ch} إلى {dest}', en: 'Code sent via {ch} to {dest}' },
  resendIn: { ar: 'إعادة الإرسال خلال {s}', en: 'Resend in {s}' },
  resend: { ar: 'إعادة الإرسال', en: 'Resend' },
  changeNumber: { ar: 'تغيير الرقم', en: 'Change number' },
  tryViaSms: { ar: 'لم يصلك؟ جرّب SMS', en: "Didn't get it? Try SMS" },
  otpWrong: { ar: 'رمز غير صحيح', en: 'Incorrect code' },
  otpExpired: { ar: 'انتهت صلاحية الرمز', en: 'Code expired' },
  waUndeliverable: { ar: 'تعذّر الإرسال عبر واتساب', en: "Couldn't send via WhatsApp" },
  devCodeHint: { ar: 'وضع تجريبي: الرمز 000000', en: 'Mock mode: code is 000000' },

  // ── profile (P1/P2, F-A1) ──
  profileTitle: { ar: 'الملف الشخصي', en: 'Profile' },
  edit: { ar: 'تعديل', en: 'Edit' },
  editProfile: { ar: 'تعديل الملف', en: 'Edit profile' },
  nameLabel: { ar: 'الاسم', en: 'Name' },
  emailLabel: { ar: 'البريد الإلكتروني', en: 'Email' },
  emailReverifyHelper: {
    ar: 'تغيير البريد يتطلب تحقّقاً جديداً',
    en: 'Changing email requires re-verification',
  },
  addEmail: { ar: 'أضف بريداً إلكترونياً', en: 'Add email' },
  verifyEmailBanner: { ar: 'تحقّق من بريدك الإلكتروني', en: 'Verify your email' },
  emailPending: { ar: 'بانتظار التحقق', en: 'Pending' },
  verifyNow: { ar: 'تأكيد الآن', en: 'Verify now' },
  emailVerified: { ar: 'تم تأكيد البريد', en: 'Email verified' },
  phoneLabelRow: { ar: 'الهاتف', en: 'Phone' },
  planLabel: { ar: 'الخطة', en: 'Plan' },
  planFree: { ar: 'مجاني', en: 'Free' },
  planPro: { ar: 'Pro', en: 'Pro' },
  changeAvatar: { ar: 'تغيير الصورة', en: 'Change photo' },
  saved: { ar: 'تم الحفظ', en: 'Saved' },

  // ── settings (S1, F-A2/A3) ──
  settingsTitle: { ar: 'الإعدادات', en: 'Settings' },
  sectionAccount: { ar: 'الحساب', en: 'Account' },
  sectionSecurity: { ar: 'الأمان', en: 'Security' },
  sectionNotifications: { ar: 'الإشعارات', en: 'Notifications' },
  sectionGeneral: { ar: 'عام', en: 'General' },
  rowProfile: { ar: 'الملف الشخصي', en: 'Profile' },
  rowSubscription: { ar: 'الاشتراك', en: 'Subscription' },
  biometricLogin: { ar: 'تسجيل الدخول بالبصمة', en: 'Biometric login' },
  biometricUnavailable: { ar: 'غير متوفر على هذا الجهاز', en: 'Not available on this device' },
  notifications: { ar: 'الإشعارات', en: 'Notifications' },
  notifDenied: {
    ar: 'مرفوض — فعّله من إعدادات الجهاز',
    en: 'Denied — enable in device settings',
  },
  openSettings: { ar: 'فتح الإعدادات', en: 'Open Settings' },
  language: { ar: 'اللغة', en: 'Language' },
  signOut: { ar: 'تسجيل الخروج', en: 'Sign out' },
  version: { ar: 'الإصدار', en: 'Version' },
  enable: { ar: 'تفعيل', en: 'Enable' },
  notNow: { ar: 'ليس الآن', en: 'Not now' },
  biometricExplainTitle: { ar: 'تفعيل الدخول بالبصمة؟', en: 'Enable biometric login?' },
  biometricExplainBody: {
    ar: 'استخدم بصمتك لتسجيل دخول أسرع في المرة القادمة.',
    en: 'Use your fingerprint/Face ID for faster sign-in next time.',
  },
  notifExplainTitle: { ar: 'ابقَ على اطلاع بأفضل العروض', en: 'Stay on top of the best offers' },
  notifExplainBody: {
    ar: 'نُنبّهك عند انخفاض الأسعار على ما تتابعه.',
    en: "We'll alert you when prices drop on what you follow.",
  },

  // ── paywall (D2, F-D1/D2) ──
  paywallHeadline: { ar: 'واصل العثور على أفضل العروض', en: 'Keep finding the best offers' },
  paywallSub: { ar: 'استهلكت عمليات البحث المجانية الخمس.', en: "You've used your 5 free searches." },
  planName: { ar: 'Best Offers Pro', en: 'Best Offers Pro' },
  priceMonthly: { ar: '1$ / شهر', en: '$1 / month' },
  priceCaption: { ar: 'يُجدّد شهرياً، ألغِ في أي وقت', en: 'Renews monthly, cancel anytime' },
  bulletUnlimited: { ar: 'بحث غير محدود', en: 'Unlimited searches' },
  bulletAlerts: { ar: 'تنبيهات انخفاض الأسعار', en: 'Price-drop alerts' },
  subscribeCta: { ar: 'اشترك مقابل 1$ شهرياً', en: 'Subscribe for $1/month' },
  later: { ar: 'لاحقاً', en: 'Later' },
  billedUsd: { ar: 'يُحصّل بالدولار الأمريكي', en: 'Billed in USD' },
  devConfirmSub: { ar: 'تأكيد الاشتراك (وضع تجريبي)', en: 'Confirm subscription (mock)' },
  subscribed: { ar: 'تم الاشتراك!', en: 'Subscribed!' },
  subscribing: { ar: 'جارٍ الاشتراك…', en: 'Subscribing…' },

  // ── subscription / manage (M1, F-D1) ──
  subscriptionTitle: { ar: 'الاشتراك', en: 'Subscription' },
  statusActive: { ar: 'نشِط', en: 'Active' },
  statusCanceled: { ar: 'مُلغى', en: 'Canceled' },
  statusPastDue: { ar: 'متأخر السداد', en: 'Past due' },
  statusFree: { ar: 'مجاني', en: 'Free' },
  renewsOn: { ar: 'يُجدّد في {date}', en: 'Renews on {date}' },
  endsOn: { ar: 'ينتهي في {date}', en: 'Ends on {date}' },
  cancelSub: { ar: 'إلغاء الاشتراك', en: 'Cancel subscription' },
  resumeSub: { ar: 'استئناف', en: 'Resume' },
  updatePayment: { ar: 'تحديث طريقة الدفع', en: 'Update payment' },
  subscribeNow: { ar: 'اشترك', en: 'Subscribe' },
  paymentIssue: { ar: 'مشكلة في الدفع', en: 'Payment issue' },
  cancelConfirmTitle: { ar: 'إلغاء اشتراكك؟', en: 'Cancel your subscription?' },
  cancelConfirmBody: { ar: 'ستحتفظ بالميزات حتى نهاية الفترة.', en: "You'll keep features until the period ends." },
  confirmCancel: { ar: 'تأكيد الإلغاء', en: 'Confirm cancel' },
  keepSub: { ar: 'تراجع', en: 'Keep subscription' },
  genericError: { ar: 'حدث خطأ، حاول مجدداً', en: 'Something went wrong, try again' },
} as const;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, locale: Locale): string {
  return STRINGS[key][locale];
}

/** Interpolating variant: replaces {token} occurrences with `vars[token]`. */
export function tn(key: StringKey, locale: Locale, vars: Record<string, string | number>): string {
  return t(key, locale).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
