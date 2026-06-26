import { TwilioOtpSender } from './twilio-otp-sender';

/**
 * Asserts the Twilio sender replicates the transport Supabase uses for the MohaFootball project:
 * a POST to the Twilio Messages REST endpoint over the WhatsApp channel (`whatsapp:` From/To pair),
 * authenticated with Basic <sid:token>. SMS is the fallback (plain From/To, same endpoint). The
 * Twilio HTTP call is fully mocked — NO real message is sent.
 */
describe('TwilioOtpSender (replicates Football/Supabase Twilio-WhatsApp transport)', () => {
  const SID = 'AC00000000000000000000000000000000'; // dummy test sid (real creds live only in .env)
  const TOKEN = 'test_auth_token';
  const NUMBER = '+15005550006'; // dummy test number (Twilio magic test number)
  const realFetch = global.fetch;
  let calls: { url: string; init: RequestInit }[];

  function mockTwilioOk(sid = 'SM_test_123') {
    calls = [];
    global.fetch = (async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      return { ok: true, status: 201, json: async () => ({ sid }) } as any;
    }) as any;
  }

  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = SID;
    process.env.TWILIO_AUTH_TOKEN = TOKEN;
    process.env.TWILIO_PHONE_NUMBER = NUMBER;
    delete process.env.TWILIO_WHATSAPP_FROM;
    delete process.env.TWILIO_SMS_FROM;
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
  });

  it('POSTs to the Twilio Messages.json endpoint with Basic auth + form encoding', async () => {
    mockTwilioOk();
    await new TwilioOtpSender().send({ phoneE164: '+96512345678', code: '123456', locale: 'en', channel: 'whatsapp' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`);
    expect(calls[0].init.method).toBe('POST');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from(`${SID}:${TOKEN}`).toString('base64')}`);
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('sends over the WhatsApp channel: whatsapp: prefix on BOTH From and To (the Football/Supabase shape)', async () => {
    mockTwilioOk();
    const r = await new TwilioOtpSender().send({
      phoneE164: '+96598765432', code: '654321', locale: 'en', channel: 'whatsapp',
    });
    expect(r.channel).toBe('whatsapp');
    expect(r.messageId).toBe('SM_test_123');
    const body = new URLSearchParams((calls[0].init.body as URLSearchParams).toString());
    expect(body.get('From')).toBe(`whatsapp:${NUMBER}`);
    expect(body.get('To')).toBe('whatsapp:+96598765432');
    expect(body.get('Body')).toContain('654321');
  });

  it('SMS fallback uses plain From/To (no whatsapp: prefix) on the same endpoint', async () => {
    mockTwilioOk('SM_sms_1');
    const r = await new TwilioOtpSender().send({
      phoneE164: '+96511112222', code: '000111', locale: 'en', channel: 'sms',
    });
    expect(r.channel).toBe('sms');
    expect(calls[0].url).toContain('/Messages.json');
    const body = new URLSearchParams((calls[0].init.body as URLSearchParams).toString());
    expect(body.get('From')).toBe(NUMBER);
    expect(body.get('To')).toBe('+96511112222');
  });

  it('honours per-channel overrides (TWILIO_WHATSAPP_FROM) but defaults to TWILIO_PHONE_NUMBER', async () => {
    process.env.TWILIO_WHATSAPP_FROM = '+19998887777';
    mockTwilioOk();
    await new TwilioOtpSender().send({ phoneE164: '+96512345678', code: '222333', locale: 'en', channel: 'whatsapp' });
    const body = new URLSearchParams((calls[0].init.body as URLSearchParams).toString());
    expect(body.get('From')).toBe('whatsapp:+19998887777');
  });

  it('emits an Arabic body when locale=ar', async () => {
    mockTwilioOk();
    await new TwilioOtpSender().send({ phoneE164: '+96512345678', code: '445566', locale: 'ar', channel: 'whatsapp' });
    const body = new URLSearchParams((calls[0].init.body as URLSearchParams).toString());
    expect(body.get('Body')).toContain('445566');
    expect(body.get('Body')).toMatch(/[؀-ۿ]/); // contains Arabic
  });

  it('throws on a non-OK Twilio response so AuthService can fall back whatsapp→sms', async () => {
    global.fetch = (async () => ({ ok: false, status: 401, text: async () => 'auth error' }) as any) as any;
    await expect(
      new TwilioOtpSender().send({ phoneE164: '+96512345678', code: '1', locale: 'en', channel: 'whatsapp' }),
    ).rejects.toThrow(/Twilio whatsapp send failed \(401\)/);
  });

  it('throws (no network) when credentials are absent', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    let fetched = false;
    global.fetch = (async () => { fetched = true; return {} as any; }) as any;
    await expect(
      new TwilioOtpSender().send({ phoneE164: '+96512345678', code: '1', locale: 'en', channel: 'whatsapp' }),
    ).rejects.toThrow(/Twilio not configured/);
    expect(fetched).toBe(false);
  });

  it('health() is true only when sid+token are present', async () => {
    expect(await new TwilioOtpSender().health()).toEqual({ ok: true });
    delete process.env.TWILIO_AUTH_TOKEN;
    expect(await new TwilioOtpSender().health()).toEqual({ ok: false });
  });
});
