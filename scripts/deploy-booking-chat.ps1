<#
  deploy-booking-chat.ps1
  Deploys the Supabase Edge Function `booking-chat` and optionally invokes it for a health-check.

  Usage:
    .\scripts\deploy-booking-chat.ps1        # deploy only
    .\scripts\deploy-booking-chat.ps1 -Invoke # deploy and run a quick invoke (may require auth)
#>

param(
  [switch]$Invoke
)

Write-Host "Deploying booking-chat Edge Function..." -ForegroundColor Cyan
& supabase functions deploy booking-chat

if ($LASTEXITCODE -ne 0) { Write-Error "Deployment failed."; exit $LASTEXITCODE }

Write-Host "Deployed."

if ($Invoke) {
  Write-Host "Invoking booking-chat with a small health test..." -ForegroundColor Yellow
  $payload = @{ query = 'Hello'; timezone = (Get-TimeZone).Id; nowIso = (Get-Date).ToString('o') } | ConvertTo-Json
  & supabase functions invoke booking-chat --body "$payload"
}
