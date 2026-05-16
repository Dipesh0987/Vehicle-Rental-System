<#
.SYNOPSIS
    Quick setup script for Forgot Password feature

.DESCRIPTION
    This script helps you deploy the password-reset-code Edge Function
    and configure email sending via Resend.

.EXAMPLE
    .\scripts\setup-forgot-password.ps1
#>

param(
    [switch]$SkipSecrets,
    [switch]$DeployOnly
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Forgot Password Feature - Quick Setup Script          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
Write-Host "[1/5] Checking Supabase CLI..." -ForegroundColor Yellow
if (!(Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Supabase CLI not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install it first:" -ForegroundColor White
    Write-Host "  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git" -ForegroundColor Gray
    Write-Host "  scoop install supabase" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Don't have Scoop? Install it:" -ForegroundColor White
    Write-Host "  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Gray
    Write-Host "  irm get.scoop.sh | iex" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

$version = & supabase --version 2>&1
Write-Host "✅ Supabase CLI installed: $version" -ForegroundColor Green
Write-Host ""

# Check if logged in
Write-Host "[2/5] Checking Supabase login..." -ForegroundColor Yellow
$status = & supabase status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not logged in or project not linked!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run:" -ForegroundColor White
    Write-Host "  supabase login" -ForegroundColor Gray
    Write-Host "  supabase link --project-ref YOUR_PROJECT_REF" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
Write-Host "✅ Project linked successfully" -ForegroundColor Green
Write-Host ""

# Configure secrets (unless skipped)
if (-not $SkipSecrets -and -not $DeployOnly) {
    Write-Host "[3/5] Configuring environment secrets..." -ForegroundColor Yellow
    Write-Host ""
    
    # Get Resend API Key
    Write-Host "📧 Email Configuration (via Resend)" -ForegroundColor Cyan
    Write-Host "   Get your FREE API key from: https://resend.com" -ForegroundColor Gray
    Write-Host ""
    $resendKey = Read-Host "   Enter your Resend API Key (starts with re_)"
    
    if ([string]::IsNullOrWhiteSpace($resendKey)) {
        Write-Host "❌ Resend API Key is required!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "📬 Testing Configuration" -ForegroundColor Cyan
    Write-Host "   During testing, ALL password reset emails will be sent to YOUR email." -ForegroundColor Gray
    Write-Host "   (Resend free tier only delivers to verified account email)" -ForegroundColor Gray
    Write-Host ""
    $yourEmail = Read-Host "   Enter YOUR email address (for receiving test OTPs)"
    
    if ([string]::IsNullOrWhiteSpace($yourEmail)) {
        Write-Host "❌ Your email is required for testing!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "   Setting secrets..." -ForegroundColor Gray
    
    # Set secrets
    & supabase secrets set RESEND_API_KEY="$resendKey" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to set RESEND_API_KEY" -ForegroundColor Red
        exit 1
    }
    
    & supabase secrets set PASSWORD_RESET_FROM_EMAIL="Rent A Vehicle <onboarding@resend.dev>" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to set PASSWORD_RESET_FROM_EMAIL" -ForegroundColor Red
        exit 1
    }
    
    & supabase secrets set RESEND_DEV_REDIRECT_TO="$yourEmail" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to set RESEND_DEV_REDIRECT_TO" -ForegroundColor Red
        exit 1
    }
    
    $pepper = "$(New-Guid)$(New-Guid)"
    & supabase secrets set PASSWORD_RESET_CODE_PEPPER="$pepper" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to set PASSWORD_RESET_CODE_PEPPER" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Secrets configured successfully" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[3/5] Skipping secrets configuration..." -ForegroundColor Yellow
    Write-Host ""
}

# Check if database migration is applied
Write-Host "[4/5] Checking database migration..." -ForegroundColor Yellow
Write-Host "   Make sure migration 015_password_reset_otp_flow.sql is applied" -ForegroundColor Gray
Write-Host "   (Run it manually in Supabase SQL Editor if not done yet)" -ForegroundColor Gray
Write-Host ""
$continue = Read-Host "   Is the migration applied? (y/n)"
if ($continue -ne "y") {
    Write-Host "❌ Please apply the migration first!" -ForegroundColor Red
    Write-Host "   File: database/migrations/015_password_reset_otp_flow.sql" -ForegroundColor Gray
    exit 1
}
Write-Host "✅ Migration confirmed" -ForegroundColor Green
Write-Host ""

# Deploy Edge Function
Write-Host "[5/5] Deploying Edge Function..." -ForegroundColor Yellow
Write-Host ""
& supabase functions deploy password-reset-code

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                  ✅ Setup Complete!                        ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 Your forgot password feature is now live!" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Open your login page" -ForegroundColor White
Write-Host "   2. Click 'Forgot password?'" -ForegroundColor White
Write-Host "   3. Enter a registered email" -ForegroundColor White
Write-Host "   4. Check your inbox ($yourEmail)" -ForegroundColor White
Write-Host "   5. Enter the 6-digit code" -ForegroundColor White
Write-Host "   6. Set a new password" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Troubleshooting:" -ForegroundColor Yellow
Write-Host "   View logs:    supabase functions logs password-reset-code" -ForegroundColor Gray
Write-Host "   List secrets: supabase secrets list" -ForegroundColor Gray
Write-Host "   Redeploy:     supabase functions deploy password-reset-code" -ForegroundColor Gray
Write-Host ""
Write-Host "📚 Full guide: FORGOT_PASSWORD_QUICK_FIX.md" -ForegroundColor Cyan
Write-Host ""
