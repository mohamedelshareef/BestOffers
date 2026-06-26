# Feature Screens — Owner-Requested Features (F-A1/A2/A3, F-C1, F-D1, F-D2)

> Owner: bo-ux-lead · Status: dev-ready draft · 2026-06-26
> Companion to `wireframes-and-design-system.md` (S1-2) and `flows-and-ia.md` (S1-1).
> Stack: React Native / Expo. Arabic-first, **RTL-default**, bilingual AR/EN. Visual identity = PLACEHOLDER semantic tokens (bo-brand-designer finalizes).
> **Reuses the existing design system** — color/type/spacing/components/accessibility rules from S1-2 §1. Only NEW components are defined here.
> Non-goals still honored elsewhere; this doc introduces the FIRST monetization + account surfaces, so payment UI appears here (paywall / manage) but **no in-app card capture** — Stripe Checkout/portal is hosted/native.
>
> **VISUAL-PASS FLAG:** the `sleek-design-mobile-apps` / `frontend-design` skills and the mockup-render module are **not reachable in this run** (not installed in this environment, no visualize tool in scope). These specs are therefore precise text wireframes. A visual mockup pass is OWED — see Handoff. Layouts below are mockup-ready (explicit anatomy, spacing tokens, states).

---

## 0. New routes (extends `flows-and-ia.md` §1.3)

| Route | Screen | Guard | Maps to |
|---|---|---|---|
| `/profile` | Profile (view) | authed | F-A1 |
| `/profile/edit` | Profile edit | authed | F-A1 |
| `/settings` | Settings (extended) | authed | F-A2, F-A3 |
| `/login/otp` | OTP verify (WhatsApp variant) | unauth | F-C1 |
| `/paywall` | Paywall (modal-route) | authed | F-D2 |
| `/subscription` | Subscription / Manage | authed | F-D1 |

- **Settings is the hub:** add rows linking to **Profile**, **Subscription**, plus inline **Biometric** and **Notifications** toggles. Profile reachable from Settings and from an avatar tap in the Intent-screen header (new).
- **Paywall** is a **modal-route** (slides up, dismissible only by subscribe or explicit "later" where allowed) presented over `/search`.

> Note: BA AC for F-* is still "to be detailed." Where an AC id is referenced below it is the UX-proposed mapping to the backlog story; BA to ratify exact AC numbers.

---

## NEW components (added to design system §1.4)

These are additions; everything else reuses S1-2 components.

**N1 — List row (settings/menu row)**
- Anatomy (RTL): `[leading icon] · Label (body) · [optional value/caption secondary] · [trailing control: chevron ▸ | switch | badge]`.
- Height ≥ 56; full-width tap target; `bg.canvas`, `border.default` 1px bottom divider. Pressed → `bg.surface`.
- Variants: **navigation** (trailing chevron, mirrors in RTL), **toggle** (trailing Switch, no chevron), **value** (trailing secondary text e.g. plan name), **destructive** (label `state.error`).
- A11y: row announces "label, value, control type". Switch announces on/off.

**N2 — Switch (toggle)**
- Native platform switch tinted `brand.primary` when on, `surfaceAlt` track when off. Min 44pt hit area incl. surrounding row.
- States: off · on · disabled (40% opacity, e.g. biometric on a non-capable device) · pending (brief spinner overlay while async permission/server call resolves, control locked).

**N3 — Avatar**
- Circle, sizes: `sm 40`, `md 64`, `lg 96`. Image cover-fit; **fallback** = brand-tinted circle with user initials (`type.h2`, `text.onBrand`) when no photo (never broken image).
- Editable variant: `lg` avatar + small camera-badge button (28pt, `brand.primary` fill, `text.onBrand` camera icon) pinned to the **trailing-bottom** corner (mirrors in RTL → leading-bottom in LTR).

**N4 — Image cropper (modal)**
- Full-screen modal. Square crop frame (1:1 for avatar), pinch-zoom + pan, grid overlay, scrim outside frame. Header: "اقتصاص الصورة / Crop photo", trailing "تم / Done", leading "إلغاء / Cancel" (X). Bottom: "اختيار صورة أخرى / Choose another".
- States: loading source · ready/adjusting · uploading (progress) · error (load/upload fail → retry).

**N5 — OTP code input** (promote W3's 6-box to a reusable component)
- 6 boxes, `bg.surface`, border, radius 10, ≥48×56 each, `type.h2` digit. Auto-advance, paste-aware (fills all), auto-submit on full. Focused box = `brand.primary` 2px border. Error = all boxes `state.error` border + shake (respects reduce-motion → no shake, color+text only). Digits LTR even in RTL; boxes FILL in reading order (right→left in RTL).

**N6 — Banner (inline, persistent)**
- Full-width strip under header. Variants: `info` (surface + brand icon), `warning` (`state.warning`), `error` (`state.error`), `success` (`state.success`). Icon + text + optional inline action link. Used for: email-reverify pending, past-due subscription, OS-permission-denied. Dismissible only where non-critical.

**N7 — Plan / price block** (paywall + manage)
- Centered: plan name (h2), **price** (`type.display`, `brand.primary`) "1$ / شهر" with period caption, value bullets (icon + body rows). Reuses `brand.accent` only for a "best value"/savings marker if ever shown — neutral by default.

**N8 — Searches-remaining indicator (counter pill)**
- Small pill in the Intent-screen header (trailing side of the sector chip). `bg.surface`, border, radius 10, height 28, `type.caption`.
- Content: "٣ عمليات بحث مجانية / 3 free searches left" → tightens to "٣ مجانية / 3 free". Icon = small spark/magnifier (non-directional).
- Color logic (never color-alone — always the number+text): `text.secondary` at 5–2 left; `state.warning` text+icon at 1 left; on 0 it becomes a **"اشترك / Subscribe"** chip (`brand.primary` text + border) that opens the paywall.
- Subscribed users: indicator hidden entirely (replaced by nothing, or a small "مشترك / Pro" badge in `brand.primary` if brand wants — optional).

---

## SCREEN SPECS

> Format: **Screen → layout → elements → states (empty/loading/error/success) → RTL → story/AC map.**

---

### P1 — Profile (view)  `/profile`  · maps **F-A1**

**Layout (top→bottom, RTL default):**
1. Header: back chevron (▸ trailing in RTL), title "الملف الشخصي / Profile", trailing "تعديل / Edit" text button → `/profile/edit`.
2. Hero block: **Avatar `lg`** centered, **name** (h1) under it, **email** (body, secondary) under that.
3. (Conditional) **N6 Banner `warning`**: "تحقّق من بريدك الإلكتروني / Verify your email" + "إعادة الإرسال / Resend" link — shown only when email is unverified or a change is pending re-verify.
4. Info rows (N1 value rows, read-only here): Phone (masked "…٦٧"), Member since (optional), Plan (value = "مجاني / Free" or "Pro" → tap routes `/subscription`).
5. Footer link row (N1 nav): "الإعدادات / Settings".

**States:**
- **Loading:** avatar + name + email as skeletons (`surfaceAlt` shimmer); rows skeleton.
- **Empty (no avatar):** N3 initials fallback. No email set (legacy WhatsApp-only user) → email row shows "أضف بريداً إلكترونياً / Add email" as an action link → edit.
- **Error (load fail):** centered inline error + "إعادة المحاولة / Retry"; never blank.
- **Success:** populated hero + rows.
- **Re-verify pending:** banner (item 3) persists until verified; email shown with a small "بانتظار التحقق / Pending" caption in `state.warning`.

**RTL:** back chevron + Edit swap to trailing/leading mirror; avatar/name/email are centered (direction-neutral); banner icon leads.
**Map:** F-A1 (view name/email/avatar; surface re-verify state).

---

### P2 — Profile edit  `/profile/edit`  · maps **F-A1**

**Layout:**
1. Header: leading "إلغاء / Cancel" (X), title "تعديل الملف / Edit profile", trailing "حفظ / Save" (primary text button; disabled until a field changes & is valid).
2. **Editable avatar** (N3 editable variant) centered. Tap → action sheet: "التقاط صورة / Take photo", "اختيار من المعرض / Choose from library", "إزالة الصورة / Remove photo" (destructive, only if photo exists), "إلغاء / Cancel". Selecting a source → **N4 cropper**.
3. **Name field** (text input, S2-1 style, auto-direction). Label "الاسم / Name".
4. **Email field** (email keyboard, LTR-forced inside field since emails are Latin). Label "البريد الإلكتروني / Email", helper caption: "تغيير البريد يتطلب تحقّقاً جديداً / Changing email requires re-verification".

**States:**
- **Empty/unchanged:** Save disabled.
- **Editing/valid:** Save enabled.
- **Invalid email:** inline `state.error` under field; Save disabled.
- **Avatar uploading:** camera badge → spinner; Save shows pending; upload progress in cropper.
- **Saving:** Save → loading spinner (label width preserved).
- **Success (no email change):** toast "تم الحفظ / Saved" → back to P1.
- **Success WITH email change:** route to **P2b re-verify state** (below), Profile banner becomes active.
- **Error (save/upload fail):** toast `state.error` + retry; fields keep entered values (no data loss).

**P2b — Email re-verify state** (sheet or inline after email change):
- Copy: "أرسلنا رابط/رمز تحقق إلى {newEmail} / We sent a verification to {newEmail}." with "إعادة الإرسال / Resend" (cooldown timer, reuses OTP resend pattern) and "تغيير البريد / Change email".
- New email is **pending** — old email stays the verified login identity until the new one is confirmed (security). Banner on P1 reflects this.
- States: sent · resend-cooldown · resent · verify-failed/expired ("انتهت صلاحية الرابط / Link expired" → resend) · verified (banner clears, email updates).

**RTL:** Cancel/Save mirror; name field auto-direction; email field LTR; cropper controls mirror (Done/Cancel swap).
**Map:** F-A1 (edit name/email/avatar upload+crop; email re-verify).

---

### S1 — Settings (extended)  `/settings`  · maps **F-A2, F-A3** (+ existing A2/A3/F1)

> Extends W11. Existing rows (language toggle, sign out, version) stay; ADD account + biometric + notifications.

**Layout (sections, each a grouped list of N1 rows):**
- **Section: الحساب / Account**
  - Profile nav row (avatar `sm` + name + chevron) → `/profile`.
  - Subscription nav row (value = "مجاني / Free" or "Pro · يُجدّد …/ renews …") → `/subscription`.
- **Section: الأمان / Security**
  - **Biometric toggle** (N1 toggle + N2): "تسجيل الدخول بالبصمة / Biometric login".
- **Section: الإشعارات / Notifications**
  - **Notifications toggle** (N1 toggle + N2): "الإشعارات / Notifications" — controls push (price-drop alerts etc.).
- **Section: عام / General**
  - Language toggle AR↔EN (existing, F1.2).
  - Sign out (destructive, existing, A3.2).
  - App version (value row, non-interactive).

**Biometric toggle behavior + states (F-A2):**
- **Default off (capable device, never enabled):** toggling ON → **first-time enable explainer sheet**:
  - Icon (face/fingerprint, non-directional), title "تفعيل الدخول بالبصمة؟ / Enable biometric login?", body "استخدم Face ID/بصمتك لتسجيل دخول أسرع في المرة القادمة. / Use Face ID/your fingerprint for faster sign-in next time.", primary "تفعيل / Enable", text "ليس الآن / Not now".
  - Enable → OS biometric prompt → success: toggle ON + toast "تم التفعيل / Enabled". Cancel/OS-fail → toggle returns OFF (no error shouting; optional caption).
- **On → toggling OFF:** immediate, confirm toast "تم الإيقاف / Turned off" (no destructive confirm needed).
- **Device not capable / not enrolled:** toggle **disabled** (N2 disabled) + caption "غير متوفر على هذا الجهاز / Not available on this device" or "أضِف بصمة في إعدادات الجهاز / Add biometrics in device settings".
- **Pending:** N2 pending spinner during OS prompt.

**Notifications toggle behavior + states (F-A3) — OS permission states:**
- **State A — permission undetermined (first time), toggle OFF:** toggling ON → brief **pre-permission explainer sheet** (soft-ask, best practice to protect the one-shot OS prompt): title "ابقَ على اطلاع بأفضل العروض / Stay on top of the best offers", body "نُنبّهك عند انخفاض الأسعار على ما تتابعه. / We'll alert you when prices drop on what you follow.", primary "تفعيل الإشعارات / Turn on notifications", text "ليس الآن / Not now".
  - Primary → fires **OS permission prompt**. Granted → toggle ON + toast. Denied → toggle stays OFF + caption "مرفوض — يمكنك التفعيل من إعدادات الجهاز / Denied — enable in device settings".
  - "Not now" → toggle stays OFF, no OS prompt consumed.
- **State B — permission granted:** toggle reflects app-level pref ON; toggling OFF = app-level mute (does not revoke OS permission). Toggling back ON = immediate, no OS prompt.
- **State C — permission denied at OS level (previously), user toggles ON:** cannot re-prompt OS → show **N6 banner/sheet**: "الإشعارات معطّلة في إعدادات الجهاز / Notifications are off in device settings" + button "فتح الإعدادات / Open Settings" (deep-links to OS app settings). Toggle stays OFF until OS-level granted.
- **Pending:** N2 pending while permission resolves.

**General states:** loading (skeleton rows) · language-switching (may trigger RTL restart, S1-1 §6) · signing-out.

**RTL:** all rows mirror (icon leads, chevron/switch trail); section headers right-aligned; switches are physically same side via logical props.
**Map:** F-A2 (biometric toggle + first-time explainer), F-A3 (notifications toggle + OS-permission states), plus existing A2/A3/F1.

---

### C1 — WhatsApp OTP — request (phone entry)  `/login`  · maps **F-C1**

> Updates W2. Same phone-entry layout; the **channel is WhatsApp-first with SMS fallback**.

**Layout:**
1. Title (h1) "سجّل الدخول / Sign in", helper caption "سنرسل رمزاً عبر واتساب / We'll send a code via WhatsApp".
2. **Phone field** `+965` prefix (editable, numeric keypad), auto-format.
3. **Channel hint row** (caption + WhatsApp glyph, non-directional): "الرمز عبر واتساب / Code via WhatsApp".
4. Primary button "إرسال عبر واتساب / Send via WhatsApp".
5. Secondary text link (initially hidden) "إرسال عبر SMS بدلاً من ذلك / Send via SMS instead" — appears after a WhatsApp send fails OR after a short delay with no delivery.

**States:**
- **Empty:** CTA disabled.
- **Valid:** CTA enabled.
- **Invalid format:** inline `state.error`.
- **Sending:** button loading.
- **WhatsApp-undeliverable** (number has no WhatsApp / API error): inline note "تعذّر الإرسال عبر واتساب / Couldn't send via WhatsApp" + surface the **SMS fallback** link prominently.
- **Network error:** retry toast.

**Behavior:** success → `/login/otp` with channel + masked destination passed.
**RTL:** label/prefix mirror; digits LTR in field; WhatsApp glyph non-directional.
**Map:** F-C1 (request OTP via WhatsApp, SMS fallback).

---

### C2 — WhatsApp OTP — code entry / verify  `/login/otp`  · maps **F-C1**

> Updates W3. Uses **N5 OTP input**. Shows the channel used.

**Layout:**
1. Header back (▸) → change number.
2. Title "أدخل الرمز / Enter the code".
3. Masked destination + channel: "أرسلنا رمزاً عبر **واتساب** إلى …٦٧ / Code sent via **WhatsApp** to …67" (channel word emphasized; if SMS fallback was used, says "عبر SMS / via SMS").
4. **N5 OTP 6-box input.**
5. **Resend area:** "إعادة الإرسال خلال 0:30 / Resend in 0:30" (countdown) → enabled "إعادة الإرسال / Resend". After enable, a small disclosure "لم يصلك؟ جرّب SMS / Didn't get it? Try SMS" toggling the channel for the resend.
6. Text link "تغيير الرقم / Change number".

**States (empty/loading/error/success):**
- **Entering:** boxes filling.
- **Verifying (loading):** boxes locked + inline spinner / button loading.
- **Wrong code (error):** N5 error style + "رمز غير صحيح — المحاولات المتبقية: N / Incorrect code — N attempts left".
- **Lockout (error):** banner (N6 error) "حاولت كثيراً، انتظر دقيقة / Too many attempts, wait a minute" (A1.4 parity).
- **Expired (error):** "انتهت صلاحية الرمز / Code expired" → CTA becomes "اطلب رمزاً جديداً / Request a new code".
- **Resend disabled→enabled:** timer → tappable; resend resets timer.
- **SMS fallback success:** channel label updates to "via SMS"; resend timer restarts.
- **Success:** correct + in-TTL → first-ever sign-in? → **biometric opt-in (W4)** else `/sectors` (A1.3 parity).

**RTL:** OTP boxes fill in reading order (right→left), digits LTR; back chevron + countdown mirror.
**Map:** F-C1 (code entry, resend/expiry, error states, SMS fallback). Reuses A1.3/A1.4/A1.5 behaviors.

---

### D1 — Searches-remaining indicator (in Intent UI)  `/search`  · maps **F-D2**

> Not a screen — a header element on the **Intent screen (W6)**. Uses **N8 counter pill**.

**Placement:** Intent-screen header row = `[sector chip "Electronics ▾"] … [N8 pill]`. Pill sits on the trailing side (leading in LTR after mirror). Also acceptable: just under the hero search box as a caption line if header is crowded — header preferred for persistence.

**Content & states:**
- **5..2 left:** "{n} عمليات بحث مجانية / {n} free searches left", `text.secondary`.
- **1 left:** `state.warning` text+icon, "بحث مجاني أخير / 1 free search left".
- **0 left:** pill becomes **"اشترك للمتابعة / Subscribe to continue"** (`brand.primary`) → tapping it (or attempting search #6) opens **Paywall (D2)**.
- **Loading (count not fetched yet):** pill skeleton (small).
- **Subscribed:** indicator hidden; optional "Pro" badge.
- **Error fetching count:** fail-open UX — hide the pill rather than block (don't punish on metering error); backend remains source of truth at search submit.

**Behavior:** decrements after a **successful search submit** (definition of "a search" = one intent→results cycle; refinements within the same clarifier session do NOT decrement — UX assumption, BA/architect to confirm metering boundary). On reaching the gate, search submission is intercepted → Paywall.
**RTL:** pill mirrors to opposite side of sector chip; numerals Western (per S0-3 default) but counter copy bilingual.
**Map:** F-D2 (5 free searches indicator + gate trigger).

---

### D2 — Paywall  `/paywall` (modal-route)  · maps **F-D2 → F-D1**

> Shown when free quota hits 0 and the user attempts search #6 (or taps the 0-state pill). Modal slide-up over `/search`.

**Layout (top→bottom):**
1. Grabber/close: small "X" leading (or "لاحقاً / Later" text) — **dismissible** back to a read-only state (they keep prior results but cannot run a new search). Confirm with BA whether dismiss is allowed or hard-gated; UX recommends **soft dismiss** (less hostile) with the pill remaining at "Subscribe".
2. Headline (h1): "واصل العثور على أفضل العروض / Keep finding the best offers".
3. Sub (body, secondary): "استهلكت عمليات البحث المجانية الخمس. / You've used your 5 free searches."
4. **N7 plan/price block:** "Best Offers Pro", **price "1$ / شهر"** (display, `brand.primary`), period caption "يُجدّد شهرياً، ألغِ في أي وقت / Renews monthly, cancel anytime". Value bullets:
   - بحث غير محدود / Unlimited searches
   - تنبيهات انخفاض الأسعار / Price-drop alerts
   - (truthful bullets only — no fake scarcity)
5. **Primary CTA:** "اشترك مقابل 1$ شهرياً / Subscribe for $1/month" → launches **Stripe Checkout** (hosted/native sheet — no in-app card form).
6. **Restore / sign-in row:** "لديك اشتراك بالفعل؟ استعادة الشراء / Already subscribed? Restore purchase" + (if not signed in on this device) "تسجيل الدخول / Sign in".
7. Fine print (caption): currency note "يُحصّل بالدولار الأمريكي / Billed in USD" (KWD-display note per F-D1), terms/privacy links.

**States (empty/loading/error/success):**
- **Default:** offer shown.
- **Pricing loading:** N7 price as skeleton (price comes from Stripe/config — never hardcode silently if remote).
- **Subscribe pressed (loading):** CTA spinner while Checkout opens.
- **Checkout success:** dismiss paywall → toast "تم الاشتراك! / Subscribed!" → unlock search; pill hidden; route back to `/search`.
- **Checkout cancelled:** return to paywall (still gated); no error shout.
- **Checkout/payment error:** N6 error banner "تعذّر إتمام الدفع / Payment couldn't be completed" + retry; never lose context.
- **Restore — found:** unlock + "تمت استعادة اشتراكك / Subscription restored".
- **Restore — none found:** info note "لم نجد اشتراكاً / No subscription found".
- **Offline:** disable CTA + "تحقّق من اتصالك / Check your connection".

**RTL:** X/Later mirror; price block centered (neutral); bullets right-aligned with leading check icons; CTA full-width.
**Map:** F-D2 (gate UI after 5 searches), F-D1 ($1/mo, subscribe CTA, restore/sign-in).

---

### M1 — Subscription / Manage  `/subscription`  · maps **F-D1**

> Reached from Settings/Profile "Subscription" row. Shows status + actions; receipts. Cancel/renew via Stripe customer portal (hosted/native) — in-app shows status & launches portal.

**Layout:**
1. Header back (▸), title "الاشتراك / Subscription".
2. **Status block (state-dependent — see below):** plan name, price, status pill, next billing / end date.
3. **Primary action** (state-dependent): Subscribe / Cancel / Renew / Update payment.
4. **Receipts / billing history** list (N1 value rows): date + amount + status → tap opens receipt (Stripe-hosted) or PDF. Empty if none.
5. Secondary: "إدارة الدفع في Stripe / Manage billing in Stripe" link (portal), restore purchase.

**Status states (the core of this screen):**
- **Free (no subscription):** status "مجاني / Free"; primary = "اشترك / Subscribe" → Paywall/Checkout. No receipts.
- **Active:** status pill `state.success` "نشِط / Active"; "Pro · 1$/شهر"; "يُجدّد في {date} / Renews on {date}"; primary = "إلغاء الاشتراك / Cancel subscription" (destructive style, opens confirm). Receipts listed.
- **Active, cancellation scheduled (canceled-but-not-expired):** status `state.warning` "مُلغى — ينتهي في {date} / Canceled — ends {date}"; banner explains access continues until period end; primary = "استئناف / Resume" (un-cancel). Receipts listed.
- **Past due:** N6 error banner "مشكلة في الدفع / Payment issue"; status `state.error` "متأخر السداد / Past due"; primary = "تحديث طريقة الدفع / Update payment" → portal; note grace-period behavior re: search access (architect to define — UX shows the warning, keeps access until backend says otherwise).
- **Expired / lapsed:** status "منتهٍ / Expired"; primary = "اشترك من جديد / Subscribe again". Past receipts remain.

**Cancel confirm sheet:** "إلغاء اشتراكك؟ / Cancel your subscription?" body "ستحتفظ بالميزات حتى {date}. / You'll keep features until {date}." primary destructive "تأكيد الإلغاء / Confirm cancel", text "تراجع / Keep subscription".

**States (empty/loading/error/success):**
- **Loading:** status block + receipts skeleton.
- **Empty receipts:** "لا توجد فواتير بعد / No invoices yet".
- **Action loading:** button spinner while portal opens / mutation resolves.
- **Success:** status updates + toast (canceled/resumed/updated).
- **Error:** N6 error + retry; status reflects last-known server truth, never optimistic-wrong.

**RTL:** back + status pill mirror; date/amount in receipts use Western digits + KWD/USD per F-D1; list rows mirror.
**Map:** F-D1 (active/canceled/past-due, cancel/renew, receipts, currency display).

---

## Cross-cutting

- **Currency (F-D1):** Stripe bills **USD ($1/mo)**; KWD elsewhere in app. Show price as "$1/month" with a fine-print "billed in USD" note; do not silently convert. Architect owns KWD/USD handling — UX surfaces the note. (Reuses Western-digit default, S0-3 [R?].)
- **No in-app card capture:** all payment entry is Stripe Checkout/portal (PCI offload). App only shows status + launches hosted flows.
- **Metering boundary (F-D2):** "a search" = one intent→results cycle. Clarifier refinements in the same session don't decrement (UX assumption — **BA/architect confirm**).
- **Fail-open on metering errors** in the indicator (don't block UX on a counter glitch); backend enforces the real gate at submit.
- **Accessibility:** all new components meet S2-1 §1.5 — AA contrast, ≥44pt targets, logical-prop RTL, screen-reader labels (switch on/off, OTP boxes, plan price, status pill announce text+state not color-alone), reduce-motion (no OTP shake → color+text).
- **Bilingual copy:** every new string AR+EN via i18n keys; no hard-coded strings.

---

## Story → screen traceability (new features)

| Story | Where satisfied |
|---|---|
| F-A1 Edit profile (name/email/avatar) | P1 Profile view, P2 Profile edit, P2b email re-verify, N3 avatar, N4 cropper |
| F-A2 Biometric toggle | S1 Settings → biometric toggle + first-time explainer |
| F-A3 Notifications toggle | S1 Settings → notifications toggle + OS-permission states A/B/C |
| F-C1 WhatsApp OTP | C1 request (WhatsApp-first + SMS fallback), C2 verify (N5, resend/expiry/error/SMS) |
| F-D1 Stripe $1/mo subscription | D2 Paywall (price/CTA/restore), M1 Subscription/Manage (states, cancel/renew, receipts) |
| F-D2 Freemium gate (5 free) | D1 searches-remaining indicator (N8), D2 Paywall gate |
| F-B1 Supabase backend | No new screen — backend/architecture (avatar storage powers N4 upload; auth powers C1/C2). Flagged to architect. |

---

## Handoff

- **Done:** Dev-ready text specs for all owner-requested NEW screens/flows — Profile view + edit (avatar upload/crop, email re-verify), extended Settings (biometric toggle + first-time explainer; notifications toggle + OS-permission states A/B/C), WhatsApp OTP request + verify (resend/expiry/error/SMS fallback), Paywall (after 5 free searches, $1/mo, subscribe/restore/sign-in), Subscription/Manage (active/canceled/past-due/expired, cancel/renew, receipts), and the searches-remaining indicator. New routes, 8 new components (N1–N8) added on top of the existing design system, full states (empty/loading/error/success), RTL behavior per screen, and story→screen traceability. All reuse S1-2 semantic tokens + accessibility rules.
- **Next (bo-dev-lead):** scaffold new routes (`/profile`, `/profile/edit`, `/settings` extended, `/login/otp` WhatsApp variant, `/paywall` modal-route, `/subscription`); build N1–N8 against semantic tokens; wire Stripe Checkout/portal (hosted — no in-app card form), WhatsApp OTP provider + SMS fallback, biometric + notification OS-permission flows (incl. "Open Settings" deep link for denied state), avatar upload→Supabase Storage + cropper. Confirm the metering boundary (does a clarifier refinement count as a search?) and past-due search-access grace behavior.
- **Next (bo-brand-designer):** finalize tokens for the NEW surfaces — status pills (success/warning/error), the paywall price treatment (display weight on `brand.primary`, neutral — no fake-scarcity styling), avatar initials fallback, WhatsApp channel glyph styling, "Pro" badge if adopted. Keep WCAG AA + neutrality; confirm Arabic font.
- **Next (bo-business-analyst):** ratify the UX-proposed AC mappings and the open product questions: paywall hard-gate vs soft-dismiss, metering boundary, search-quota reset rules, email-change identity rule (old email stays login until new verified).
- **Owner:** bo-ux-lead (design); bo-dev-lead (build); bo-brand-designer (identity); bo-business-analyst (AC); bo-tech-architect (Supabase/Stripe/WhatsApp/metering decisions per backlog flags).
- **Blockers/risks:** **Visual mockup pass OWED** — `sleek-design-mobile-apps`/`frontend-design` skills + the mockup-render module were not reachable in this run (not installed here), so deliverables are precise text specs; PO should run the visual pass when the design tooling is available. Currency UX (USD billing vs KWD app) needs architect's final handling. Metering boundary + paywall dismiss policy unconfirmed (BA). OS-permission deep-link "Open Settings" behavior differs iOS/Android (dev to verify). Numeral preference still **[R? S0-3]** (Western default).
```
