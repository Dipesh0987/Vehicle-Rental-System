# Forgot Password - Quick Fix Guide

## Problem
Getting "Edge Function returned a non-2xx status code (HTTP 404)" error when trying to use forgot password.

## Root Cause
The Edge Function `password-reset-code` exists in your code but is **NOT deployed** to Supabase yet.

## Solution
Deploy the Edge Function and configure email sending. Your project is already linked to Supabase, so this is quick!

---

## 🚀 Quick Start (Choose One)

### Option A: Automated Setup (Recommended)
Run the setup script that guides you through everything:

```powershell
cd C:\Users\aryal\Desktop\Vehicle-Rental-System
.\scripts\setup-forgot-password.ps1
```

### Option B: Manual Setup
Follow the step-by-step instructions below.

---

---

## Prerequisites Check

✅ **Edge Function code exists:** `supabase/functions/password-reset-code/index.ts`  
✅ **Database migration exists:** `database/migrations/015_password_reset_otp_flow.sql`  
✅ **Frontend code exists:** `frontend/assets/js/forgot-password.js`  
✅ **Project is linked to Supabase:** `.temp/linked-project.json` found  

**What's missing:** Edge Function deployment + Email configuration

---

## Quick Setup (5 Minutes)

### Step 1: Install Supabase CLI (if not installed)

Open PowerShell and check if installed:

```powershell
supabase --version
```

If you see a version number, **skip to Step 2**.

If not installed, run:

```powershell
# Install using Scoop (recommended)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Don't have Scoop?** Install it first:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
```

---

### Step 2: Login to Supabase

```powershell
supabase login
```

This opens your browser. Login with your Supabase account credentials.

---

### Step 3: Verify Project Link

```powershell
cd C:\Users\aryal\Desktop\Vehicle-Rental-System
supabase status
```

You should see your project info. If you see an error, run:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
```

**To find YOUR_PROJECT_REF:**
1. Go to https://supabase.com/dashboard
2. Open your project
3. Settings → General → Reference ID

---

### Step 4: Get Resend API Key (for sending emails)

**Resend** is a free email service. You need an API key to send OTP emails.

1. Go to **https://resend.com**
2. Click **"Sign Up"** (it's FREE)
3. Verify your email
4. Go to **"API Keys"** in the dashboard
5. Click **"Create API Key"**
6. Give it a name like "Vehicle Rental Password Reset"
7. **Copy the key** (starts with `re_`) - you'll need it in the next step

**Important:** Keep this key safe! You'll paste it in Step 5.

---

### Step 5: Configure Environment Secrets

Now we'll set up the secrets that the Edge Function needs. Run these commands **one by one** in PowerShell:

```powershell
# Navigate to your project
cd C:\Users\aryal\Desktop\Vehicle-Rental-System

# 1. Set your Resend API key (REQUIRED)
# Replace re_your_api_key_here with the key you copied from Resend
supabase secrets set RESEND_API_KEY="re_your_api_key_here"

# 2. Set sender email (REQUIRED for development)
supabase secrets set PASSWORD_RESET_FROM_EMAIL="Rent A Vehicle <onboarding@resend.dev>"

# 3. Set YOUR email for testing (REQUIRED when using @resend.dev)
# Replace your-email@gmail.com with YOUR actual email address
supabase secrets set RESEND_DEV_REDIRECT_TO="your-email@gmail.com"

# 4. Set security pepper (RECOMMENDED)
supabase secrets set PASSWORD_RESET_CODE_PEPPER="$(New-Guid)$(New-Guid)"
```

**What each secret does:**
- `RESEND_API_KEY`: Your Resend API key for sending emails
- `PASSWORD_RESET_FROM_EMAIL`: The "from" address in the email
- `RESEND_DEV_REDIRECT_TO`: During testing, ALL OTP emails go to this address (yours!)
- `PASSWORD_RESET_CODE_PEPPER`: Security salt for hashing OTP codes

**Why RESEND_DEV_REDIRECT_TO?**  
Resend's free tier only sends to YOUR verified email until you add a custom domain. This setting redirects all OTPs to your email for testing. Once you verify a domain at https://resend.com/domains, you can remove this setting.

---

### Step 6: Deploy the Edge Function

```powershell
# Deploy the password reset function
supabase functions deploy password-reset-code
```

**Expected output:**
```
Deploying Function password-reset-code...
Deployed Function password-reset-code on project YOUR_PROJECT
```

If you see this, **you're done!** 🎉

---

### Step 7: Test It!

1. Open your website: `http://localhost:5500/frontend/login.html` (or your live URL)
2. Click "Forgot password?"
3. Enter your registered email
4. Click "Send reset code"
5. Check your email inbox (the one you set in `RESEND_DEV_REDIRECT_TO`)
6. You should receive a 6-digit code
7. Enter the code and new password
8. Click "Reset password"
9. Done! Login with your new password

---

## Troubleshooting

### Error: "supabase: command not found"
**Solution:** Install Supabase CLI (see Step 1)

### Error: "Project not linked"
**Solution:** Run `supabase link --project-ref YOUR_PROJECT_REF` (see Step 3)

### Error: "Email send failed"
**Possible causes:**
1. Invalid Resend API key
2. `RESEND_DEV_REDIRECT_TO` not set
3. Email not verified in Resend

**Solution:**
```powershell
# Check your secrets
supabase secrets list

# Update if needed
supabase secrets set RESEND_API_KEY="re_your_correct_key"
supabase secrets set RESEND_DEV_REDIRECT_TO="your-verified-email@gmail.com"

# Redeploy
supabase functions deploy password-reset-code
```

### Error: "No account found for that email"
**Solution:** 
- Make sure the email is registered in your system
- Check that user's verification status is "approved" in database

### Email not arriving
**Check:**
1. Spam/junk folder
2. Resend dashboard → Logs (https://resend.com/logs)
3. Make sure `RESEND_DEV_REDIRECT_TO` is set to YOUR email
4. Check function logs: `supabase functions logs password-reset-code`

### Error: "Reset code is invalid or expired"
**Causes:**
- Code was already used
- Code expired (default: 10 minutes)
- Too many incorrect attempts (default: 5 max)

**Solution:** Request a new code

---

## Moving to Production

Once you're ready to send emails to real users (not just your test email):

### Step 1: Verify a Domain in Resend

1. Go to https://resend.com/domains
2. Click "Add Domain"
3. Add your domain (e.g., `rentavehicle.com`)
4. Add the DNS records shown
5. Wait for verification (usually a few minutes)

### Step 2: Update Sender Email

```powershell
# Use your verified domain
supabase secrets set PASSWORD_RESET_FROM_EMAIL="Rent A Vehicle <noreply@yourdomain.com>"
```

### Step 3: Remove Test Redirect

```powershell
# Remove the redirect so emails go to actual users
supabase secrets unset RESEND_DEV_REDIRECT_TO
```

### Step 4: Redeploy

```powershell
supabase functions deploy password-reset-code
```

Now password reset emails will be sent to the actual user's email address!

---

## Quick Commands Reference

```powershell
# Check if function is deployed
supabase functions list

# View function logs
supabase functions logs password-reset-code

# Check secrets
supabase secrets list

# Redeploy function
supabase functions deploy password-reset-code

# Test function manually
$payload = '{"action":"request","email":"test@example.com"}'
supabase functions invoke password-reset-code --body $payload
```

---

## Complete Setup Script

Save this as `setup-forgot-password.ps1` and run it:

```powershell
# Setup Forgot Password Feature
Write-Host "=== Forgot Password Setup ===" -ForegroundColor Cyan

# Check if Supabase CLI is installed
if (!(Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Supabase CLI..." -ForegroundColor Yellow
    scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
    scoop install supabase
}

# Get user inputs
$resendKey = Read-Host "Enter your Resend API Key (from resend.com)"
$yourEmail = Read-Host "Enter YOUR email address (for receiving test OTPs)"

# Set secrets
Write-Host "Setting secrets..." -ForegroundColor Yellow
supabase secrets set RESEND_API_KEY="$resendKey"
supabase secrets set PASSWORD_RESET_FROM_EMAIL="Rent A Vehicle <onboarding@resend.dev>"
supabase secrets set RESEND_DEV_REDIRECT_TO="$yourEmail"
supabase secrets set PASSWORD_RESET_CODE_PEPPER="$(New-Guid)$(New-Guid)"

# Deploy function
Write-Host "Deploying Edge Function..." -ForegroundColor Yellow
supabase functions deploy password-reset-code

Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host "Test it by clicking 'Forgot password?' on your login page" -ForegroundColor Cyan
```

---

## What Happens Behind the Scenes

1. **User enters email** → Frontend calls Edge Function
2. **Edge Function checks** → Is email registered? Is user approved?
3. **Generate OTP** → Creates random 6-digit code
4. **Store in database** → Saves hashed code in `password_reset_otps` table
5. **Send email** → Uses Resend API to send OTP to user's email
6. **User enters code** → Frontend calls Edge Function again
7. **Verify code** → Checks if code matches and isn't expired
8. **Update password** → Changes password in Supabase Auth
9. **Done!** → User can login with new password

---

## Need Help?

1. Check function logs: `supabase functions logs password-reset-code`
2. Check Resend logs: https://resend.com/logs
3. Make sure all secrets are set: `supabase secrets list`
4. Redeploy if you changed secrets: `supabase functions deploy password-reset-code`

---

## Summary (TL;DR)

```powershell
# 1. Install CLI
scoop install supabase

# 2. Login
supabase login

# 3. Link project
supabase link --project-ref YOUR_PROJECT_REF

# 4. Set secrets
supabase secrets set RESEND_API_KEY="re_your_key"
supabase secrets set RESEND_DEV_REDIRECT_TO="your-email@gmail.com"

# 5. Deploy
supabase functions deploy password-reset-code

# 6. Test on your login page!
```

That's it! Your forgot password feature should now work! 🎉
