// Supabase Edge Function: Send OTP via SMS
// This function generates OTP and sends it via Twilio or Sparrow SMS

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// SMS Provider Configuration
const SMS_PROVIDER = Deno.env.get('SMS_PROVIDER') || 'twilio' // 'twilio' or 'sparrowsms'

// Twilio Configuration
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

// Sparrow SMS Configuration
const SPARROW_SMS_TOKEN = Deno.env.get('SPARROW_SMS_TOKEN')
const SPARROW_SENDER_ID = Deno.env.get('SPARROW_SENDER_ID') || 'SelfCar'

// Generate 4-digit OTP
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// Format phone number for Nepal
function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  
  // Handle Nepal formats
  if (cleaned.length === 10 && cleaned.startsWith('9')) {
    cleaned = '977' + cleaned
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '977' + cleaned.substring(1)
  } else if (cleaned.startsWith('977')) {
    // Already formatted
  } else if (cleaned.startsWith('+977')) {
    cleaned = cleaned.substring(1)
  }
  
  return cleaned
}

// Send SMS via Twilio
async function sendTwilioSMS(phone: string, message: string): Promise<boolean> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
  
  const formattedPhone = '+' + formatPhone(phone)
  
  const body = new URLSearchParams({
    To: formattedPhone,
    From: TWILIO_PHONE_NUMBER!,
    Body: message
  })
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body
  })
  
  if (!response.ok) {
    const error = await response.text()
    console.error('Twilio error:', error)
    throw new Error('Failed to send SMS via Twilio')
  }
  
  return true
}

// Send SMS via Sparrow SMS
async function sendSparrowSMS(phone: string, message: string): Promise<boolean> {
  const url = 'https://api.sparrowsms.com/v2/sms'
  
  const formattedPhone = formatPhone(phone).replace('977', '') // Remove country code for Sparrow
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SPARROW_SMS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token: SPARROW_SMS_TOKEN,
      from: SPARROW_SENDER_ID,
      to: formattedPhone,
      text: message
    })
  })
  
  if (!response.ok) {
    const error = await response.text()
    console.error('Sparrow SMS error:', error)
    throw new Error('Failed to send SMS via Sparrow')
  }
  
  return true
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone } = await req.json()
    
    if (!phone) {
      throw new Error('Phone number is required')
    }
    
    // Format phone number
    const formattedPhone = formatPhone(phone)
    
    // Validate Nepal phone number
    if (!formattedPhone.match(/^977(98|97)\d{8}$/)) {
      throw new Error('Invalid Nepal phone number')
    }
    
    // Generate OTP
    const otp = generateOTP()
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Store OTP in database
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    
    const { error: dbError } = await supabase
      .from('otp_codes')
      .upsert({
        phone: formattedPhone,
        otp: otp,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      })
    
    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error('Failed to store OTP')
    }
    
    // Create SMS message
    const message = `🏎️ SelfCarRental\n\nYour verification code is: ${otp}\n\nValid for 5 minutes. Do not share this code with anyone.`
    
    // Send SMS based on provider
    let smsSent = false
    
    if (SMS_PROVIDER === 'twilio') {
      smsSent = await sendTwilioSMS(formattedPhone, message)
    } else if (SMS_PROVIDER === 'sparrowsms') {
      smsSent = await sendSparrowSMS(formattedPhone, message)
    } else {
      throw new Error('Invalid SMS provider configured')
    }
    
    console.log(`✅ OTP sent to ${formattedPhone} via ${SMS_PROVIDER}`)
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'OTP sent successfully',
        phone: formattedPhone,
        // For development only - remove in production
        devOtp: Deno.env.get('ENVIRONMENT') === 'development' ? otp : undefined
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
