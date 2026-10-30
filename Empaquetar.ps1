$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
$destination = Join-Path $appRoot 'docs\downloads'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$allowedFiles = @('Iniciar.cmd','Iniciar.ps1','Configurar-herramientas.cmd','Configurar-herramientas.ps1','Ollama-local.ps1','requirements-audio.txt','LEEME.md','README.md','ARQUITECTURA.md','ESTABILIDAD.md','package.json','server.js','folder-picker.js','Elegir-carpeta.ps1','lib.js','catalog-storage.js','job-ledger.js','recuperar-catalogo.js','transcribir.py','transcription_progress.py','stream-progress.js','vision-response.js','meeting-minutes.js','Configurar-minutas.cmd','Configurar-minutas.ps1','preparar-modelo.py','Empaquetar.ps1')
$allowedFolders = @('public','test','docs\adr')
$codeExtensions = @('.js','.cjs','.mjs','.html','.css','.py','.md','.json','.txt','.ps1','.cmd','.sql')
$entries = @()
foreach ($relative in $allowedFiles) {
    $file = Join-Path $appRoot $relative
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Falta un archivo requerido: $relative" }
    $entries += [pscustomobject]@{ File=$file; Entry=$relative.Replace('\','/') }
}
foreach ($relativeFolder in $allowedFolders) {
    $folder = Join-Path $appRoot $relativeFolder
    if (-not (Test-Path -LiteralPath $folder -PathType Container)) { throw "Falta una carpeta requerida: $relativeFolder" }
    foreach ($file in Get-ChildItem -LiteralPath $folder -File -Recurse) {
        $relative = $file.FullName.Substring($appRoot.Length + 1).Replace('\','/')
        if ($relative -eq 'test/browser-demo.test.mjs') { continue }
        if ($relative -match '(^|/)(__pycache__|node_modules|datos|\.git|\.venv|herramientas)/') { continue }
        if ($codeExtensions -notcontains $file.Extension.ToLowerInvariant()) { continue }
        $entries += [pscustomobject]@{ File=$file.FullName; Entry=$relative }
    }
}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$temporary = Join-Path $destination ('VideotecaLocal-' + [guid]::NewGuid().ToString('N') + '.zip')
$archive = $null
try {
    $archive = [System.IO.Compression.ZipFile]::Open($temporary,[System.IO.Compression.ZipArchiveMode]::Create)
    foreach ($entry in $entries) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$entry.File,$entry.Entry,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
    $archive.Dispose(); $archive = $null
    Move-Item -LiteralPath $temporary -Destination (Join-Path $destination 'VideotecaLocal.zip') -Force
    Write-Host "Paquete actualizado: $($entries.Count) archivos de codigo y documentacion."
} finally {
    if ($archive) { $archive.Dispose() }
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
}
