$keys = @(
  'NEXT_PUBLIC_ASSOCIATION_CUI','ASSOCIATION_LEGAL_NAME','NEXT_PUBLIC_FORM_230_FISCAL_YEAR','FORM_230_FISCAL_YEAR',
  'ASSOCIATION_IBAN','NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET',
  'ADMIN_PASSWORD','EMAIL_FROM','NEXT_PUBLIC_APP_URL','RESEND_API_KEY','BETTER_AUTH_URL','BETTER_AUTH_SECRET',
  'NEXT_PUBLIC_GA_MEASUREMENT_ID','ADMIN_EMAIL','CRON_SECRET','TURSO_AUTH_TOKEN','TURSO_DATABASE_URL','BLOB_READ_WRITE_TOKEN',
  'CONTACT_EMAIL','FORM_230_DEFAULT_PERCENT','FORM_177_FISCAL_YEAR','NEXT_PUBLIC_FORM_177_FISCAL_YEAR',
  'SPONSORSHIP_BENEFICIARY_NAME','SPONSORSHIP_BENEFICIARY_CIF','SPONSORSHIP_BENEFICIARY_IBAN','SPONSORSHIP_BENEFICIARY_BANK',
  'SPONSORSHIP_BENEFICIARY_REPRESENTATIVE_ROLE','BENEFICIARY_ANAF_REGISTRY_CONFIRMED'
)
$out = New-Object System.Collections.Generic.List[string]
foreach ($k in $keys) {
  $v = [Environment]::GetEnvironmentVariable($k)
  if ($null -ne $v -and $v -ne '') {
    $escaped = $v.Replace('\', '\\').Replace('"', '\"').Replace("`r", '').Replace("`n", '\n')
    $out.Add("$k=`"$escaped`"")
    Write-Host ("OK {0} len={1}" -f $k, $v.Length)
  } else {
    Write-Host "MISSING $k"
  }
}
Set-Content -Path '.env.old-production-full' -Value ($out -join "`n") -Encoding utf8
Write-Host ("Wrote {0} vars" -f $out.Count)
