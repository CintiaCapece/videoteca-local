param([switch]$SoloComprobar)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Set-Location -LiteralPath $PSScriptRoot
$appRoot = $PSScriptRoot
$toolsDir = Join-Path $appRoot 'herramientas'
$downloadDir = Join-Path $toolsDir 'descargas'
$testDir = Join-Path $appRoot 'datos\pruebas'
$modelName = 'qwen3-vl:2b-instruct-q4_K_M'
. (Join-Path $appRoot 'Ollama-local.ps1')

function Get-WorkingPython {
    $candidates = @((Join-Path $appRoot '.venv\Scripts\python.exe'))
    foreach ($name in @('python','python3')) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) { $candidates += $command.Source }
    }
    $launcher = Get-Command py -ErrorAction SilentlyContinue
    if ($launcher) {
        try { $located = & $launcher.Source -3 -c 'import sys; print(sys.executable)' 2>$null; if ($LASTEXITCODE -eq 0) { $candidates += $located } } catch { }
    }
    $candidates += (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe')
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $candidate)) { continue }
        try { & $candidate -c 'import sys; assert (3,10) <= sys.version_info[:2] <= (3,13); assert sys.maxsize > 2**32' 2>$null; if ($LASTEXITCODE -eq 0) { return $candidate } } catch { }
    }
    throw 'No se encontro Python de 64 bits compatible. Instala Python 3.12 desde python.org y volve a ejecutar este archivo.'
}
function Download-File {
    param([string]$Url,[string]$Target)
    Write-Host "Descargando: $Url"
    # Una descarga parcial nunca se ejecuta ni se reutiliza como archivo completo.
    $partial = $Target + '.partial'
    Invoke-WebRequest -Uri $Url -OutFile $partial -UseBasicParsing -TimeoutSec 7200
    Move-Item -LiteralPath $partial -Destination $Target -Force
}
function Invoke-Checked {
    param([string]$Executable,[string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Fallo la herramienta: $Executable (codigo $LASTEXITCODE)." }
}
function Check-Executable {
    param([string]$Executable,[string[]]$Arguments)
    if (-not (Test-Path -LiteralPath $Executable)) { return $false }
    try { & $Executable @Arguments *> $null; return ($LASTEXITCODE -eq 0) } catch { return $false }
}

$ffmpeg = Join-Path $toolsDir 'ffmpeg.exe'
$ffprobe = Join-Path $toolsDir 'ffprobe.exe'
$python = Join-Path $appRoot '.venv\Scripts\python.exe'
$ollama = Join-Path $toolsDir 'ollama\ollama.exe'
if ($SoloComprobar) {
    $checks = [ordered]@{
        ffmpeg = (Check-Executable $ffmpeg @('-version'))
        ffprobe = (Check-Executable $ffprobe @('-version'))
        audio = (Check-Executable $python @('-c','import faster_whisper'))
        ollama = (Check-Executable $ollama @('--version'))
        modeloVisual = $false
        pruebaCompleta = (Test-Path -LiteralPath (Join-Path $testDir 'resultado.json'))
    }
    try { $tags = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3; $checks.modeloVisual = $modelName -in @($tags.models.name) } catch { }
    $checks | ConvertTo-Json
    exit 0
}

try {
    Write-Host 'VIDEOTECA LOCAL - Configuracion de herramientas'
    Write-Host 'Se descargaran FFmpeg, Ollama, dependencias de audio y modelos locales.'
    Write-Host 'Puede tardar bastante y utilizar varios GB. No se procesan tus videos.'
    New-Item -ItemType Directory -Force -Path $toolsDir,$downloadDir,$testDir | Out-Null
    $drive = Get-PSDrive -Name ([System.IO.Path]::GetPathRoot($appRoot).TrimEnd('\').TrimEnd(':')) -ErrorAction SilentlyContinue
    if ($drive -and $null -ne $drive.Free -and $drive.Free -lt 15GB) { throw 'Se recomiendan al menos 15 GB libres para descargas, extraccion y modelos.' }

    Write-Host '[1/5] FFmpeg y ffprobe'
    if (-not ((Check-Executable $ffmpeg @('-version')) -and (Check-Executable $ffprobe @('-version')))) {
        $archive = Join-Path $downloadDir 'ffmpeg-release-essentials.zip'
        Download-File 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' $archive
        $checksum = Join-Path $downloadDir 'ffmpeg-release-essentials.zip.sha256'
        Download-File 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip.sha256' $checksum
        $expected = [regex]::Match((Get-Content -LiteralPath $checksum -Raw),'(?i)\b[a-f0-9]{64}\b').Value
        if (-not $expected -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) { throw 'No coincide el SHA-256 de FFmpeg. Volve a ejecutar para descargarlo de nuevo.' }
        $extractDir = Join-Path $downloadDir 'ffmpeg-extraido'
        Expand-Archive -LiteralPath $archive -DestinationPath $extractDir -Force
        foreach ($exe in @('ffmpeg.exe','ffprobe.exe')) {
            $match = Get-ChildItem -LiteralPath $extractDir -Recurse -Filter $exe | Select-Object -First 1
            if (-not $match) { throw "No se encontro $exe en el paquete." }
            Copy-Item -LiteralPath $match.FullName -Destination (Join-Path $toolsDir $exe) -Force
        }
    }
    Invoke-Checked $ffmpeg @('-version')
    Invoke-Checked $ffprobe @('-version')

    Write-Host '[2/5] Python y faster-whisper (CPU)'
    if (-not (Test-Path -LiteralPath $python)) {
        $basePython = Get-WorkingPython
        Invoke-Checked $basePython @('-m','venv',(Join-Path $appRoot '.venv'))
    }
    Invoke-Checked $python @('-m','pip','install','--disable-pip-version-check','-r',(Join-Path $appRoot 'requirements-audio.txt'))
    Invoke-Checked $python @('-c','import faster_whisper; print("Audio disponible")')

    Write-Host '[3/5] Ollama para Windows x64'
    if (-not (Test-Path -LiteralPath $ollama)) {
        $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/ollama/ollama/releases/latest' -Headers @{'User-Agent'='VideotecaLocal-Setup'} -TimeoutSec 60
        $asset = $release.assets | Where-Object { $_.name -eq 'ollama-windows-amd64.zip' } | Select-Object -First 1
        if (-not $asset) { throw 'No se encontro el paquete oficial x64 de Ollama en su ultima version.' }
        $archive = Join-Path $downloadDir 'ollama-windows-amd64.zip'
        Download-File $asset.browser_download_url $archive
        if ($asset.digest -and $asset.digest.StartsWith('sha256:')) {
            if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $asset.digest.Substring(7)) { throw 'No coincide el SHA-256 de Ollama.' }
        }
        Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $toolsDir 'ollama') -Force
    }
    if (-not (Start-VideotecaOllama $appRoot)) { throw 'No se pudo iniciar Ollama.' }
    Write-Host '[4/5] Modelo visual local (descarga inicial)'
    Invoke-Checked $ollama @('pull',$modelName)

    Write-Host '[5/5] Pruebas con material sintetico'
    $wav = Join-Path $testDir 'frase.wav'
    Add-Type -AssemblyName System.Speech
    $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
        $speaker.SetOutputToWaveFile($wav)
        $speaker.Speak('This is a local video library test. We are checking that audio transcription works correctly on this computer.')
    } finally { $speaker.Dispose() }
    $video = Join-Path $testDir 'video-prueba.mp4'
    $image = Join-Path $testDir 'fotograma.jpg'
    Invoke-Checked $ffmpeg @('-nostdin','-v','error','-f','lavfi','-i','color=c=green:s=640x360:r=15','-i',$wav,'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',$video)
    Invoke-Checked $ffprobe @('-v','error','-show_entries','format=duration','-of','json',$video)
    Invoke-Checked $ffmpeg @('-nostdin','-v','error','-i',$video,'-frames:v','1','-y',$image)
    $frame = [Convert]::ToBase64String([IO.File]::ReadAllBytes($image))
    $request = @{model=$modelName;images=@($frame);prompt='Describe el color principal de esta imagen en una frase en espanol.';stream=$false;think=$false;keep_alive=0;options=@{num_ctx=2048;num_predict=100;temperature=0}} | ConvertTo-Json -Depth 6
    $vision = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/generate' -Method Post -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($request)) -TimeoutSec 600
    if (-not $vision.response) { throw 'Ollama no devolvio una descripcion.' }
    $audioJson = & $python (Join-Path $appRoot 'transcribir.py') $video (Join-Path $appRoot 'datos\modelos') 'cpu'
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la prueba de transcripcion.' }
    $audio = $audioJson | ConvertFrom-Json
    if (-not $audio.text) { throw 'La prueba de voz no produjo texto. Revisa el registro antes de procesar videos reales.' }
    $result = @{fecha=(Get-Date).ToString('o');ffmpeg=$true;ffprobe=$true;modeloVisual=$modelName;descripcion=$vision.response;transcripcion=$audio.text;audioDispositivo='cpu'}
    $result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $testDir 'resultado.json') -Encoding UTF8
    Write-Host 'Configuracion y pruebas completas.' -ForegroundColor Green
    Write-Host 'Cierra la ventana anterior de Videoteca y volve a abrir Iniciar.cmd.'
    Write-Host 'Resultado: datos/pruebas/resultado.json. Material de prueba: datos/pruebas/video-prueba.mp4.'
} catch {
    Write-Host ('No se pudo completar: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Los pasos ya terminados se conservan. Podes volver a ejecutar Configurar-herramientas.cmd.'
    exit 1
}
