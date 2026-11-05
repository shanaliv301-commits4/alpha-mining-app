import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { initData } = req.body;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  if (!initData || !BOT_TOKEN) return res.status(400).json({ error: 'Missing initData or BOT_TOKEN' });

  // Validate Telegram Hash Signature
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  const paramsArray = [];
  for (const [key, value] of urlParams.entries()) {
    paramsArray.push(`${key}=${value}`);
  }
  paramsArray.sort();
  const dataCheckString = paramsArray.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calculatedHash !== hash) {
    return res.status(401).json({ error: 'Invalid security signature' });
  }

  const user = JSON.parse(urlParams.get('user'));
  const telegramId = user.id;

  let { data: profile } = await supabase.from('profiles').select('*').eq('telegram_id', telegramId).single();

  if (!profile) {
    const { data: newProfile } = await supabase.from('profiles').insert({
      telegram_id: telegramId,
      username: user.username || `miner_${telegramId}`,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      balance: 10000,
      wallet_status: 'unverified'
    }).select().single();
    profile = newProfile;
  }

  return res.status(200).json({ success: true, profile });
}
