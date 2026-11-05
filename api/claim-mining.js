import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { telegram_id } = req.body;

  const { data: cycle } = await supabase
    .from('mining_cycles')
    .select('*')
    .eq('telegram_id', telegram_id)
    .eq('claimed', false)
    .order('start_time', { ascending: false })
    .limit(1)
    .single();

  if (!cycle) return res.status(400).json({ error: 'No active cycle' });

  const startTime = new Date(cycle.start_time).getTime();
  const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

  if (elapsedSeconds < cycle.duration_seconds) {
    return res.status(400).json({ error: 'Cycle still running', remaining: cycle.duration_seconds - elapsedSeconds });
  }

  await supabase.from('mining_cycles').update({ claimed: true, claimed_at: new Date().toISOString() }).eq('id', cycle.id);
  
  // Update balance
  const { data: profile } = await supabase.from('profiles').select('balance').eq('telegram_id', telegram_id).single();
  await supabase.from('profiles').update({ balance: Number(profile.balance || 0) + Number(cycle.max_cap) }).eq('telegram_id', telegram_id);

  return res.status(200).json({ success: true, claimed: cycle.max_cap });
}
