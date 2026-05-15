# How to Fix Forgot Password (404 Error)

## 🔴 The Problem

When you click "Forgot password?" and enter an email, you get:

```
Error: Edge Function returned a non-2xx status code (HTTP 404)
```

## ✅ The Solution

The Edge Function exists in your code but is **NOT deployed** to Supabase. You need to deploy it!

---

## 🚀 Quick Fix (Choose One Method)

### Method 1: Automated Script (Easiest) ⭐

Open PowerShell and run:

```powershell
cd C:\Users\aryal\Desktop\Vehicle-Rental-System
.\scripts\setup-forgot-password.ps1
```

**The script will:**
1. Check if Supabase CLI is installed (tells you how to install if missing)
2. Verify you're logged in to Supabase
3. Ask for your Resend API key (get free at https://resend.com)
4. Ask for your email address (for receiving test OTPs)
5. Configure all secrets automatically
6. Deploy the Edge Function
7. Done! ✅

**Time:** 5 minutes  
**Cost:** FREE

---

### Method 2: Manual Setup

If you prefer to do it manually, follow these steps:

#### Step 1: Install Supabase CLI (if not installed)

```powershell
# Check if installed
supabase --version

# If not installed, install via Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### Step 2: Login to Supabase

```powershell
supabase login
```

This opens your browser. Login with your Supabase credentials.

#### Step 3: Get Resend API Key

1. Go to https://resend.com
2. Sign up (FREE)
3. Verify your email
4. Go to "API Keys"
5. Create new key
6. Copy it (starts with `re_`)

#### Step 4: Set Secrets

```powershell
cd C:\Users\aryal\Desktop\Vehicle-Rental-System

# Replace re_your_key with your actual Resend API key
supabase secrets set RESEND_API_KEY="re_your_key"

# Replace your-email@gmail.com with YOUR email
supabase secrets set RESEND_DEV_REDIRECT_TO="your-email@gmail.com"

# Set sender email
supabase secrets set PASSWORD_RESET_FROM_EMAIL="Rent A Vehicle <onboarding@resend.dev>"

# Set security pepper
supabase secrets set PASSWORD_RESET_CODE_PEPPER="$(New-Guid)$(New-Guid)"
```

#### Step 5: Deploy

```powershell
supabase functions deploy password-reset-code
```

#### Step 6: Test

1. Go to your login page
2. Click "Forgot password?"
3. Enter a registered email
4. Check YOUR email inbox (the one you set in Step 4)
5. You should receive a 6-digit code
6. Enter the code and new password
7. Done! ✅

---

## 📧 Important: Email Configuration

### During Testing (Now)

- Set `RESEND_DEV_REDIRECT_TO` to YOUR email
- ALL password reset emails will come to YOUR email
- This is because Resend free tier only sends to verified emails

**Example:**
```powershell
supabase secrets set RESEND_DEV_REDIRECT_TO="your-email@gmail.com"
```

### For Production (Later)

When you're ready to send emails to real users:

1. Verify your domain at https://resend.com/domains
2. Update sender email:
   ```powershell
   supabase secrets set PASSWORD_RESET_FROM_EMAIL="Rent A Vehicle <noreply@yourdomain.com>"
   ```
3. Remove redirect:
   ```powershell
   supabase secrets unset RESEND_DEV_REDIRECT_TO
   ```
4. Redeploy:
   ```powershell
   supabase functions deploy password-reset-code
   ```

---

## 🔍 Troubleshooting

### Email Not Arriving?

**Check:**
1. Spam/junk folder
2. Resend logs: https://resend.com/logs
3. Function logs: `supabase functions logs password-reset-code`
4. Verify `RESEND_DEV_REDIRECT_TO` is YOUR email: `supabase secrets list`

### "No account found for that email"?

**Check:**
1. Email is registered in your system
2. User's verification status is "approved" in database

### "Supabase CLI not found"?

**Install it:**
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Don't have Scoop? Install it first:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
```

### "Project not linked"?

**Link it:**
```powershell
supabase link --project-ref YOUR_PROJECT_REF
```

Get YOUR_PROJECT_REF from:
- Supabase Dashboard → Settings → General → Reference ID

---

## 📚 More Help

- **Detailed Guide:** `FORGOT_PASSWORD_QUICK_FIX.md`
- **Setup Summary:** `FORGOT_PASSWORD_SETUP_SUMMARY.md`
- **Deployment Script:** `scripts/setup-forgot-password.ps1`

---

## ✅ Checklist

Before you start:
- [ ] Supabase CLI installed
- [ ] Logged in to Supabase
- [ ] Resend account created
- [ ] Resend API key copied

After setup:
- [ ] Secrets configured
- [ ] Edge Function deployed
- [ ] Tested on login page
- [ ] Received OTP email
- [ ] Successfully reset password

---

## 🎯 Summary

**Problem:** Edge Function not deployed  
**Solution:** Run `.\scripts\setup-forgot-password.ps1`  
**Time:** 5 minutes  
**Result:** Forgot password feature works! 🎉

---

## 💡 What Happens Behind the Scenes

1. User enters email → Frontend calls Edge Function
2. Edge Function checks if email is registered and approved
3. Generates random 6-digit OTP code
4. Stores hashed code in database (`password_reset_otps` table)
5. Sends email via Resend API
6. User enters code → Frontend calls Edge Function again
7. Edge Function verifies code and updates password
8. Done! User can login with new password

---

## 🆘 Still Having Issues?

Run these diagnostic commands:

```powershell
# Check if function is deployed
supabase functions list

# View recent logs
supabase functions logs password-reset-code

# Check secrets
supabase secrets list

# Test function manually
$payload = '{"action":"request","email":"test@example.com"}'
supabase functions invoke password-reset-code --body $payload
```

---

**Ready? Let's fix it!** 🚀

Run: `.\scripts\setup-forgot-password.ps1`
