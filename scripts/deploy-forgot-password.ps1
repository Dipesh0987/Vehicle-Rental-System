<#
.SYNOPSIS
    Deploy the password-reset-code Edge Function

.DESCRIPTION
    Simple deployment script for the forgot password Edge Function.
    Use this when secrets are already configured.

.EXAMPLE
    .\scripts\deploy-forgot-password.ps1
    
.EXAMPLE
    .\scripts\deploy-forgot-password.ps1 -WithLogs
#>

param(
    [switch]$WithLogs
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🚀 Deploying password-reset-code Edge Function..." -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
if (!(Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Supabase CLI not found!" -ForegroundColor Red
    Write-Host "   Install: scoop install supabase" -ForegroundColor Gray
    exit 1
}

# Deploy
& supabase functions deploy password-reset-code

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check if logged in: supabase status" -ForegroundColor Gray
    Write-Host "  2. Check secrets: supabase secrets list" -ForegroundColor Gray
    Write-Host "  3. View logs: supabase functions logs password-reset-code" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment successful!" -ForegroundColor Green
Write-Host ""

if ($WithLogs) {
    Write-Host "📋 Viewing recent logs..." -ForegroundColor Cyan
    Write-Host ""
    & supabase functions logs password-reset-code --limit 20
}

Write-Host "🎉 Forgot password feature is ready!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test it:" -ForegroundColor Yellow
Write-Host "  1. Go to your login page" -ForegroundColor Gray
Write-Host "  2. Click 'Forgot password?'" -ForegroundColor Gray
Write-Host "  3. Enter your email" -ForegroundColor Gray
Write-Host "  4. Check your inbox for the 6-digit code" -ForegroundColor Gray
Write-Host ""
