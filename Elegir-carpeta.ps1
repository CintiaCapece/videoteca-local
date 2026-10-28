$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles()
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$owner = New-Object System.Windows.Forms.Form
try {
    $dialog.Description = 'Elegi la carpeta que queres agregar a Videoteca Local'
    $dialog.ShowNewFolderButton = $false
    if ($dialog.PSObject.Properties['UseDescriptionForTitle']) { $dialog.UseDescriptionForTitle = $true }
    if ($env:VIDEOTECA_PICKER_INITIAL -and [IO.Directory]::Exists($env:VIDEOTECA_PICKER_INITIAL)) {
        $dialog.SelectedPath = $env:VIDEOTECA_PICKER_INITIAL
    }
    $owner.ShowInTaskbar = $false
    $owner.Opacity = 0
    $owner.TopMost = $true
    $owner.Show()
    if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
        @{root=$dialog.SelectedPath} | ConvertTo-Json -Compress
    } else {
        @{root=$null} | ConvertTo-Json -Compress
    }
} finally {
    $dialog.Dispose()
    $owner.Close()
    $owner.Dispose()
}
