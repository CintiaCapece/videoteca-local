param([string]$ZipPath = (Join-Path $PSScriptRoot '..\docs\downloads\VideotecaLocal.zip'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ZipPath).Path)
try {
    $names = @($archive.Entries | ForEach-Object { $_.FullName })
    foreach ($required in @('server.js','lib.js','catalog-storage.js','job-ledger.js','recuperar-catalogo.js','package.json','public/index.html','public/app.js','test/fixtures/catalog-holder.cjs','docs/adr/0001-base-tecnologica.md','docs/adr/0002-proteccion-catalogo.md','docs/adr/0003-recuperacion-por-video.md','test/job-recovery.test.js','test/fixtures/job-crash.cjs')) {
        if ($names -notcontains $required) { throw "Falta en el ZIP: $required" }
    }
    if ($names | Where-Object { $_ -match '(^|/)(datos|\.venv|\.git|herramientas|node_modules|__pycache__)/|\.(sqlite|sqlite-wal|sqlite-shm|mp4|wav|pyc)$|(^|/)\.env' }) { throw 'El paquete contiene archivos ajenos a la distribucion.' }
} finally { $archive.Dispose() }
$scratchRoot = [System.IO.Path]::GetTempPath()
$scratch = Join-Path $scratchRoot ('videoteca-paquete-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $scratch | Out-Null
try {
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $scratch
    $runtimePath = (Get-Command node -ErrorAction Stop).Source
    $tests = @(Get-ChildItem -LiteralPath (Join-Path $scratch 'test') -Filter '*.test.js' -File | ForEach-Object { $_.FullName })
    & $runtimePath --test @tests
    if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas de la aplicacion extraida del ZIP.' }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $scratch 'Iniciar.ps1') -SoloComprobar
    if ($LASTEXITCODE -ne 0) { throw 'Fallo el iniciador extraido del ZIP.' }
    Write-Host 'ZIP verificado: estructura, privacidad de archivos, pruebas y comprobacion de iniciador.'
} finally {
    $resolved = [System.IO.Path]::GetFullPath($scratch)
    $boundary = [System.IO.Path]::GetFullPath($scratchRoot).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($boundary,[System.StringComparison]::OrdinalIgnoreCase) -or -not ([System.IO.Path]::GetFileName($resolved)).StartsWith('videoteca-paquete-')) { throw 'Ruta temporal de limpieza invalida.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
