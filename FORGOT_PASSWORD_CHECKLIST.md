# Forgot Password - Setup Checklist

## ✅ Quick Setup Checklist

Follow these steps to fix the 404 error and get forgot password working:

---

### 1️⃣ Install Supabase CLI

```powershell
supabase --version
```

**If not installed:**
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

- [ ] Supabase CLI installed

---

### 2️⃣ Login to Supabase

```powershell
supabase login
```

- [ ] Logged in successfully

---

### 3️⃣ Get Resend API Key

1. Go to https://resend.com
2. Sign up (FREE)
3. Verify your email
4. Go to "API Keys" → "Create API Key"
5. Copy the key (starts with `re_`)

- [ ] Resend account created
- [ ] API key copied

---

### 4️⃣ Run Setup Script

```powershell
cd C:\Users\aryal\Desktop\Vehicle-Rental-System
.\scripts\setup-forgot-password.ps1
```

**The script will ask for:**
1. Your Resend API key
2. Your email address (for receiving test OTPs)

- [ ] Setup script completed successfully

---

### 5️⃣ Test the Feature

1. Open your login page
2. Click "Forgot password?"
3. Enter a registered email address
4. Click "Send reset code"
5. Check YOUR email inbox
6. Enter the 6-digit code
7. Enter new password
8. Click "Reset password"
9. Try logging in with new password

- [ ] Received OTP email
- [ ] Successfully reset password
- [ ] Can login with new password

---

## 🎉 Done!

Your forgot password feature is now working!

---

## 📋 Alternative: Manual Setup

If you prefer manual setup instead of the script:

### Step 1: Set Secrets

```powershell
cd C:\Users\aryal\Desktop\Vehicle-Rental-System

# Replace with your actual values
supabase secrets set RESEND_API_KEY="re_your_key_here"
supabase secrets set RESEND_DEV_REDIRECT_TO="your-email@gmail.com"
supabase secrets set PASSWORD_RESET_FROM_EMAIL="Rent A Vehicle <onboarding@resend.dev>"
supabase secrets set PASSWORD_RESET_CODE_PEPPER="$(New-Guid)$(New-Guid)"
```

- [ ] All secrets set

### Step 2: Deploy Function

```powershell
supabase functions deploy password-reset-code
```

- [ ] Function deployed successfully

### Step 3: Test

Follow testing steps from section 5️⃣ above.

---

## 🔍 Verification Commands

```powershell
# Check if function is deployed
supabase functions list

# Check secrets
supabase secrets list

# View logs
supabase functions logs password-reset-code
```

---

## ⚠️ Common Issues

### Email not arriving?
- [ ] Check spam folder
- [ ] Check Resend logs: https://resend.com/logs
- [ ] Verify `RESEND_DEV_REDIRECT_TO` is YOUR email

### "No account found"?
- [ ] Email is registered in your system
- [ ] User verification status is "approved"

### Function not found?
- [ ] Run: `supabase functions deploy password-reset-code`

---

## 📚 Documentation

- **Quick Guide:** `HOW_TO_FIX_FORGOT_PASSWORD.md`
- **Detailed Guide:** `FORGOT_PASSWORD_QUICK_FIX.md`
- **Summary:** `FORGOT_PASSWORD_SETUP_SUMMARY.md`

---

## 🚀 Quick Commands

```powershell
# Full setup
.\scripts\setup-forgot-password.ps1

# Just deploy
.\scripts\deploy-forgot-password.ps1

# View logs
supabase functions logs password-reset-code

# Check status
supabase status
```

---

## ✅ Final Checklist

- [ ] Supabase CLI installed
- [ ] Logged in to Supabase
- [ ] Resend account created
- [ ] API key obtained
- [ ] Secrets configured
- [ ] Edge Function deployed
- [ ] Feature tested successfully
- [ ] OTP email received
- [ ] Password reset works

---

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

**Current Status:** _____

**Completed Date:** _____

---

## 🆘 Need Help?

Run diagnostics:

```powershell
# Check everything
supabase status
supabase functions list
supabase secrets list

# View logs
supabase functions logs password-reset-code

# Test manually
$payload = '{"action":"request","email":"test@example.com"}'
supabase functions invoke password-reset-code --body $payload
```

---

**Ready to start?** Run: `.\scripts\setup-forgot-password.ps1` 🚀
