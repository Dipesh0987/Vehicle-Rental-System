# Forgot Password Setup - Summary

## Current Status

✅ **Edge Function Code:** Exists at `supabase/functions/password-reset-code/index.ts`  
✅ **Database Migration:** Exists at `database/migrations/015_password_reset_otp_flow.sql`  
✅ **Frontend Code:** Exists at `frontend/assets/js/forgot-password.js`  
✅ **Project Linked:** Your project is already linked to Supabase  
❌ **Edge Function Deployed:** NOT YET - This is what you need to do!

---

## What You Need to Do

The forgot password feature is **fully coded** but the Edge Function is **not deployed** to Supabase yet. That's why you're getting the 404 error.

### Quick Setup (5 minutes)

Run this automated setup script:

```powershell
cd C:\Users\aryal\Desktop\Vehicle-Rental-System
.\scripts\setup-forgot-password.ps1
```

The script will:
1. ✅ Check if Supabase CLI is installed
2. ✅ Verify you're logged in
3. 📧 Ask for your Resend API key (free at https://resend.com)
4. 📬 Ask for your email (for receiving test OTPs)
5. 🚀 Deploy the Edge Function

### What You'll Need

1. **Supabase CLI** - The script will tell you how to install if missing
2. **Resend Account** - Free at https://resend.com (for sending OTP emails)
3. **5 minutes** - That's it!

---

## How It Works

### Development/Testing Mode
- You set `RESEND_DEV_REDIRECT_TO` to YOUR email
- ALL password reset OTPs go to YOUR email (for testing)
- This is because Resend free tier only sends to verified emails

### Production Mode (Later)
- Verify your domain at https://resend.com/domains
- Remove `RESEND_DEV_REDIRECT_TO` setting
- OTPs will be sent to actual user emails

---

## Files Created/Updated

### New Files
- ✅ `FORGOT_PASSWORD_QUICK_FIX.md` - Detailed step-by-step guide
- ✅ `scripts/setup-forgot-password.ps1` - Automated setup script
- ✅ `scripts/deploy-forgot-password.ps1` - Quick redeploy script

### Existing Files (Already in your project)
- `supabase/functions/password-reset-code/index.ts` - Edge Function
- `frontend/assets/js/forgot-password.js` - Frontend code
- `database/migrations/015_password_reset_otp_flow.sql` - Database schema

---

## Quick Commands

```powershell
# Full setup (first time)
.\scripts\setup-forgot-password.ps1

# Just deploy (if secrets already set)
.\scripts\deploy-forgot-password.ps1

# View logs
supabase functions logs password-reset-code

# Check secrets
supabase secrets list

# Test the function
# Go to your login page → Click "Forgot password?" → Enter email
```

---

## Troubleshooting

### "Supabase CLI not found"
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### "Not logged in"
```powershell
supabase login
```

### "Email not arriving"
1. Check spam folder
2. Check Resend logs: https://resend.com/logs
3. Verify `RESEND_DEV_REDIRECT_TO` is set to YOUR email
4. Check function logs: `supabase functions logs password-reset-code`

---

## Next Steps

1. **Run the setup script:** `.\scripts\setup-forgot-password.ps1`
2. **Test it:** Go to login page → Click "Forgot password?"
3. **Check your email:** You should receive a 6-digit code
4. **Done!** The feature is now working

---

## Support

- **Detailed Guide:** See `FORGOT_PASSWORD_QUICK_FIX.md`
- **Function Logs:** `supabase functions logs password-reset-code`
- **Resend Dashboard:** https://resend.com/logs
- **Supabase Dashboard:** https://supabase.com/dashboard

---

## Summary

**Problem:** Edge Function not deployed → 404 error  
**Solution:** Run `.\scripts\setup-forgot-password.ps1`  
**Time:** 5 minutes  
**Cost:** FREE (Resend free tier: 100 emails/day)

That's it! 🎉
