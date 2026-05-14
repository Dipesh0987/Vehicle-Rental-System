<#
  set-supabase-secrets.ps1
  Prompts for required values and sets Supabase Edge Function secrets.

  Usage: Run in PowerShell where `supabase` CLI is authenticated:
    .\scripts\set-supabase-secrets.ps1

  This script does NOT store keys in the repo. It uses the Supabase CLI to set secrets.
#>

Write-Host "Supabase secrets setup helper" -ForegroundColor Cyan

function Read-SecurePlainText($prompt) {
  $secure = Read-Host -Prompt $prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

$geminiKey = Read-SecurePlainText "Enter GEMINI_API_KEY (paste, then Enter)"
if (-not $geminiKey) { Write-Error "GEMINI_API_KEY is required."; exit 1 }

$model = Read-Host -Prompt "Booking model (press Enter to use gemini-2.0-flash)"
if (-not $model) { $model = "gemini-2.0-flash" }

$supportEmail = Read-Host -Prompt "Support email (default: support@rentavehiclenepal.com)"
if (-not $supportEmail) { $supportEmail = "support@rentavehiclenepal.com" }

$supportPhone = Read-Host -Prompt "Support phone (optional)"

Write-Host "Setting Supabase secrets..." -ForegroundColor Yellow

& supabase secrets set GEMINI_API_KEY="$geminiKey"
& supabase secrets set BOOKING_AI_MODEL="$model"
& supabase secrets set BOOKING_SUPPORT_EMAIL="$supportEmail"
if ($supportPhone) { & supabase secrets set BOOKING_SUPPORT_PHONE="$supportPhone" }

Write-Host "Done. Deploy the function with the deploy script or run: supabase functions deploy booking-chat" -ForegroundColor Green
