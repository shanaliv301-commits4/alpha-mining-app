import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { telegram_id, wallet_address, tx_hash, admin_deposit_address } = req.body;

  if (!telegram_id || !wallet_address || !tx_hash) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const { data, error } = await supabase.from('wallet_verifications').insert({
    telegram_id,
    wallet_address,
    tx_hash,
    admin_deposit_address: admin_deposit_address || 'UQBYW_alpha_master_vault_ton_771x',
    status: 'pending'
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('profiles').update({ wallet_status: 'pending', wallet_address }).eq('telegram_id', telegram_id);

  // Send Instant Telegram Notification to Admin
  if (process.env.ADMIN_CHAT_ID && process.env.TELEGRAM_BOT_TOKEN) {
    const text = `🔔 *New Wallet Verification Request*\nUser TG ID: \`${telegram_id}\`\nWallet: \`${wallet_address}\`\nTx Hash: \`${tx_hash}\`\n\nReview & Approve in Admin Panel!`;
    try {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.ADMIN_CHAT_ID, text, parse_mode: 'Markdown' })
      });
    } catch(e) {}
  }

  return res.status(200).json({ success: true, verification: data });
}
