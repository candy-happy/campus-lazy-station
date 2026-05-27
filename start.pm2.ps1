$pm2 = Join-Path $PSScriptRoot 'node_modules\.bin\pm2.cmd'
& $pm2 resurrect 2>$null
if ($LASTEXITCODE -ne 0) {
    & $pm2 start (Join-Path $PSScriptRoot 'server.js') --name campus-lazy 2>$null
    & $pm2 save 2>$null
}
