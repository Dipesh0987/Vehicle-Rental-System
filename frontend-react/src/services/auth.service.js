import supabase from '../lib/supabase';

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertProfile(userId, updates) {
  const payload = { id: userId, ...updates, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadProfileImage(userId, file) {
  const ext = file.name.split('.').pop();
  const path = `${userId}/avatar.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from('profile-images')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage.from('profile-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function submitVerification(userId, documentType, frontFile, backFile) {
  const timestamp = Date.now();
  const uploadDoc = async (file, side) => {
    const ext = file.name.split('.').pop();
    const path = `${userId}/${documentType}_${side}_${timestamp}.${ext}`;
    const { error } = await supabase.storage
      .from('profile-images')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from('profile-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const frontUrl = await uploadDoc(frontFile, 'front');
  const backUrl = backFile ? await uploadDoc(backFile, 'back') : null;

  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      verification_status: 'pending',
      document_type: documentType,
      document_front_url: frontUrl,
      document_back_url: backUrl,
      verification_submitted_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;

  // Notify all admin users about new verification submission
  try {
    const { data: admins } = await supabase.from('user_profiles').select('id').eq('role', 'admin');
    if (admins && admins.length) {
      const customerName = data.full_name || data.email || 'A customer';
      const notifs = admins.map((a) => ({
        user_id: a.id,
        type: 'verification_submission',
        title: `New KYC Submission: ${customerName}`,
        body: `${customerName} submitted identity verification documents for review.`,
        channel: 'system',
        priority: 'high',
        read: false,
      }));
      await supabase.from('notifications').insert(notifs);
    }
  } catch (_) { /* notification is best-effort */ }

  return data;
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
