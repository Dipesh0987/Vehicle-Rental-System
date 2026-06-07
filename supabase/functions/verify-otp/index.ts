// Supabase Edge Function: Verify OTP and Login/Register User

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Format phone number
function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.length === 10 && cleaned.startsWith('9')) {
    cleaned = '977' + cleaned
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '977' + cleaned.substring(1)
  }
  
  return cleaned
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, otp } = await req.json()
    
    if (!phone || !otp) {
      throw new Error('Phone number and OTP are required')
    }
    
    // Format phone
    const formattedPhone = formatPhone(phone)
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Verify OTP
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', formattedPhone)
      .eq('otp', otp)
      .single()
    
    if (otpError || !otpRecord) {
      throw new Error('Invalid OTP')
    }
    
    // Check if expired
    const expiresAt = new Date(otpRecord.expires_at)
    if (expiresAt < new Date()) {
      // Delete expired OTP
      await supabase.from('otp_codes').delete().eq('phone', formattedPhone)
      throw new Error('OTP has expired')
    }
    
    // Delete used OTP
    await supabase.from('otp_codes').delete().eq('phone', formattedPhone)
    
    // Check if user exists
    const { data: existingUser, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('phone', formattedPhone)
      .single()
    
    let userId: string
    let isNewUser = false
    let email: string
    
    if (userError || !existingUser) {
      // Create new user
      isNewUser = true
      email = `${formattedPhone}@phone.selfcarrental.com`
      
      // Generate random password
      const password = `${otp}${formattedPhone}${Date.now()}`
      
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          phone: formattedPhone,
          full_name: `User ${formattedPhone.slice(-4)}`
        }
      })
      
      if (authError) {
        console.error('Auth error:', authError)
        throw new Error('Failed to create user account')
      }
      
      userId = authData.user.id
      
      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          user_id: userId,
          phone: formattedPhone,
          full_name: `User ${formattedPhone.slice(-4)}`,
          email: email,
          created_at: new Date().toISOString()
        })
      
      if (profileError) {
        console.error('Profile error:', profileError)
      }
      
    } else {
      // Existing user
      userId = existingUser.user_id || existingUser.id
      email = existingUser.email
    }
    
    // Generate session token
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email
    })
    
    if (sessionError) {
      console.error('Session error:', sessionError)
    }
    
    console.log(`✅ User ${isNewUser ? 'registered' : 'logged in'}: ${formattedPhone}`)
    
    return new Response(
      JSON.stringify({
        success: true,
        isNewUser: isNewUser,
        phone: formattedPhone,
        email: email,
        userId: userId,
        message: isNewUser ? 'Account created successfully' : 'Login successful'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
    
  } catch (error) {
    console.error('Error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
