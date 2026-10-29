import { normalizeTemplate, type TemplateHabit } from './lib/template';
import { supabase } from './supabase';

/** The current default list from the server. Needs a connection. */
export async function fetchDefaultTemplate(): Promise<TemplateHabit[]> {
  const { data, error } = await supabase!.from('default_template').select('habits').eq('id', 1).maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeTemplate(data?.habits);
}

/** Replaces the default list. The database only allows this for admins. */
export async function saveDefaultTemplate(habits: TemplateHabit[], userId: string): Promise<void> {
  const { data, error } = await supabase!.from('default_template')
    .update({ habits: normalizeTemplate(habits), updated_at: new Date().toISOString(), updated_by: userId })
    .eq('id', 1)
    .select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Only admins can change the default list.');
}

/** Whether this account may edit the default list (false when offline or unknown). */
export async function checkIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase!.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  return !error && !!data;
}

/** Marks this account as having made its first-run choice, on every device. */
export async function markOnboarded(): Promise<void> {
  const { error } = await supabase!.auth.updateUser({ data: { onboarded: true } });
  if (error) throw new Error(error.message);
}
