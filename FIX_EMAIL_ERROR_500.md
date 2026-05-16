# Fix: "Error sending recovery email" (HTTP 500)

## Problem

Getting error when trying to reset password:
```
AuthApiError: Error sending recovery email
HTTP 500 Internal Server Error
```

## Root Cause

Supabase's email service is not properly configured in your project settings.

---

## ✅ Solution: Configure Supabase Email Settings

### Step 1: Go to Supabase Dashboard

1. Open https://supabase.com/dashboard
2. Select your project: **qvlixrxinjyhfasbjjtr**

### Step 2: Configure Site URL and Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to:
   ```
   http://127.0.0.1:5501
   ```
3. Add to **Redirect URLs** (click "+ Add URL" for each):
   ```
   http://127.0.0.1:5501/**
   http://localhost:5501/**
   http://127.0.0.1:5501/frontend/reset-password.html
   http://localhost:5501/frontend/reset-password.html
   ```
4. Click **Save**

### Step 3: Enable Email Auth

1. Go to **Authentication** → **Providers**
2. Find **Email** provider
3. Make sure it's **Enabled** (toggle should be ON)
4. **Confirm email** should be OFF for development (or ON if you want email verification)

### Step 4: Configure SMTP Settings

You have 2 options:

#### Option A: Use Gmail (Easiest for Testing)

1. Go to **Authentication** → **Settings** → Scroll to **SMTP Settings**
2. Enable **"Enable Custom SMTP"**
3. Fill in these details:

```
Host: smtp.gmail.com
Port number: 587
Sender email: your-email@gmail.com
Sender name: Rent A Vehicle
Username: your-email@gmail.com
Password: YOUR_APP_PASSWORD
```

**How to get Gmail App Password:**
1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification** (if not already enabled)
3. Search for "App passwords" or go to https://myaccount.google.com/apppasswords
4. Select app: **Mail**
5. Select device: **Other** (enter "Supabase")
6. Click **Generate**
7. Copy the 16-character password (no spaces)
8. Paste it in the SMTP Password field

#### Option B: Use SendGrid (Better for Production)

1. Go to https://sendgrid.com and sign up (FREE - 100 emails/day)
2. Verify your email address
3. Go to **Settings** → **API Keys**
4. Click **Create API Key**
5. Name it "Supabase Password Reset"
6. Select **Full Access**
7. Click **Create & View**
8. **Copy the API key** (starts with `SG.`)

Then in Supabase:
1. Go to **Authentication** → **Settings** → **SMTP Settings**
2. Enable **"Enable Custom SMTP"**
3. Fill in:

```
Host: smtp.sendgrid.net
Port number: 587
Sender email: noreply@yourdomain.com (or your verified email)
Sender name: Rent A Vehicle
Username: apikey
Password: YOUR_SENDGRID_API_KEY
```

### Step 5: Test Email Template

1. Go to **Authentication** → **Email Templates**
2. Click **"Reset Password"**
3. Make sure the template looks good
4. You can customize it if needed
5. Click **Save**

### Step 6: Test the Feature

1. Open `frontend/login.html`
2. Click **"Forgot password?"**
3. Enter your email address
4. Click **"Send reset link"**
5. Check your email inbox (and spam folder!)
6. Click the reset link
7. Enter new password
8. Done! ✅

---

## 🆘 Still Not Working?

### Check Supabase Logs

1. Go to Supabase Dashboard
2. **Authentication** → **Logs**
3. Look for recent password reset attempts
4. Check for error messages

### Common Issues

#### Issue 1: "Invalid SMTP credentials"

**Solution:**
- Double-check your Gmail app password (no spaces!)
- Make sure 2-Step Verification is enabled in Gmail
- Try regenerating the app password

#### Issue 2: "Sender email not verified"

**Solution (SendGrid):**
1. Go to SendGrid → **Settings** → **Sender Authentication**
2. Verify your sender email or domain
3. Use the verified email in SMTP settings

**Solution (Gmail):**
- Use the same Gmail address for both "Sender email" and "Username"

#### Issue 3: Email not arriving

**Check:**
1. Spam/junk folder
2. Supabase logs for errors
3. SendGrid/Gmail logs
4. Make sure email is registered in your system
5. User verification status is "approved"

#### Issue 4: "Rate limit exceeded"

**Solution:**
- Wait 1 hour (Supabase limits password reset requests)
- Or configure custom SMTP for unlimited emails

---

## 🚀 Quick Test with Gmail

If you just want to test quickly:

1. **Use your personal Gmail account**
2. **Enable 2-Step Verification:** https://myaccount.google.com/security
3. **Generate App Password:** https://myaccount.google.com/apppasswords
4. **Configure in Supabase:**
   ```
   Host: smtp.gmail.com
   Port: 587
   Sender: your-email@gmail.com
   Username: your-email@gmail.com
   Password: [16-character app password]
   ```
5. **Save and test!**

---

## 📧 Alternative: Use Supabase's Built-in Email (Limited)

If you don't want to configure SMTP:

1. Go to **Authentication** → **Settings**
2. **Disable** "Enable Custom SMTP"
3. Supabase will use its built-in email service
4. **Limitation:** 4 emails per hour per user
5. **Best for:** Development/testing only

---

## ✅ Recommended Setup

**For Development:**
- Use Gmail SMTP (easy to set up)
- Or use Supabase's built-in (limited but works)

**For Production:**
- Use SendGrid (100 emails/day free)
- Or AWS SES (62,000 emails/month free)
- Or Mailgun (5,000 emails/month free)

---

## 📝 Summary

**Problem:** HTTP 500 error when sending password reset email  
**Cause:** SMTP not configured in Supabase  
**Solution:** Configure Gmail or SendGrid SMTP in Supabase Dashboard  
**Time:** 5-10 minutes  

**Steps:**
1. ✅ Configure Site URL and Redirect URLs
2. ✅ Enable Email provider
3. ✅ Configure SMTP (Gmail or SendGrid)
4. ✅ Test the feature

---

## 🎯 Next Steps

After configuring SMTP:

1. Test password reset with your email
2. Check that emails arrive (check spam!)
3. Verify reset link works
4. Customize email template (optional)
5. Done! Feature is production-ready

---

**Need help?** Check Supabase logs or contact support with your project ref: `qvlixrxinjyhfasbjjtr`
