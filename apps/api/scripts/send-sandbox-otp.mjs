/**
 * ONE-SHOT LIVE Twilio WhatsApp Sandbox OTP send.
 *
 * Sends a REAL WhatsApp message via the Twilio WhatsApp Sandbox using the SAME TwilioOtpSender the
 * app uses in production (OTP_PROVIDER=twilio). It is a thin CLI over the compiled sender — no app boot.
 *
 * SAFETY: this script will NOT send anything unless you pass a destination phone number. It is the
 * only path that performs a real send; the verification harness never sends.
 *
 * PRECONDITIONS (owner must do these first — see bo-dev-lead handoff):
 *   1. Activate the Twilio WhatsApp Sandbox in the Twilio Console:
 *        Messaging → Try it out → Send a WhatsApp message.
 *   2. From the DESTINATION phone, send the join code (e.g. "join <two-words>") to +1 415 523 8886.
 *      This opts that number into the sandbox for a 24h window. Re-send the join code if the window lapsed.
 *   3. Repo-root .env must have: OTP_PROVIDER=twilio, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *      TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 (the sandbox sender; already set).
 *
 * USAGE (from apps/api):
 *   DOTENV_CONFIG_PATH=<repo>/.env node -r dotenv/config scripts/send-sandbox-otp.mjs +9655XXXXXXX [code] [ar|en]
 *
 *   <dest>  REQUIRED  E.164 destination, must be the number you opted into the sandbox.
 *   [code]  optional  6-digit code to send (default: random 6-digit).
 *   [lang]  optional  'ar' (default) or 'en'.
 *
 * Build first:  npm run build:types && npm run build --workspace=apps/api
 */
import { TwilioOtpSender } from '../dist/auth/providers/twilio-otp-sender.js';

const dest = process.argv[2];
const code = process.argv[3] ?? String(Math.floor(100000 + Math.random() * 900000));
const locale = process.argv[4] === 'en' ? 'en' : 'ar';

if (!dest) {
  console.error('REFUSING TO SEND: no destination phone number given.');
  console.error('Usage: node scripts/send-sandbox-otp.mjs +9655XXXXXXX [code] [ar|en]');
  console.error('The number MUST already be opted into the Twilio WhatsApp Sandbox (join code to +14155238886).');
  process.exit(2);
}
if (!/^\+[1-9]\d{6,14}$/.test(dest)) {
  console.error(`REFUSING TO SEND: "${dest}" is not a valid E.164 number (e.g. +96599998888).`);
  process.exit(2);
}
if (process.env.OTP_PROVIDER !== 'twilio') {
  console.error(`OTP_PROVIDER is "${process.env.OTP_PROVIDER ?? 'mock'}", expected "twilio". Check DOTENV_CONFIG_PATH / .env.`);
  process.exit(2);
}

const sender = new TwilioOtpSender();
const h = await sender.health();
if (!h.ok) {
  console.error('Twilio not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing).');
  process.exit(2);
}

console.log(`Sending LIVE WhatsApp OTP via Twilio Sandbox`);
console.log(`  From   : ${process.env.TWILIO_WHATSAPP_FROM}`);
console.log(`  To     : whatsapp:${dest}`);
console.log(`  Code   : ${code}  (locale=${locale})`);

try {
  const r = await sender.send({ phoneE164: dest, code, locale, channel: 'whatsapp' });
  console.log(`SENT. channel=${r.channel} messageId=${r.messageId}`);
  console.log(`Check WhatsApp on ${dest}. If nothing arrives within ~1 min, the number is not opted into the`);
  console.log(`sandbox (re-send the join code to +14155238886) or the 24h window lapsed.`);
} catch (err) {
  console.error(`SEND FAILED: ${err.message}`);
  console.error(`Most common cause: ${dest} has not sent the "join <code>" message to +14155238886 (or 24h window expired).`);
  process.exit(1);
}
