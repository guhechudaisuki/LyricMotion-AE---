param(
  [Parameter(Mandatory = $true)][ValidateSet('Validate', 'Prepare', 'Register', 'Uninstall')][string]$Action,
  [Parameter(Mandatory = $true)][string]$Destination,
  [string]$ExtensionDirectory = (Join-Path $env:APPDATA 'Adobe\CEP\extensions\com.lyricmotion.ae.panel'),
  [string]$BackupDirectory = (Join-Path $env:LOCALAPPDATA 'LyricMotion-AE\previous-installations'),
  [string]$Version
)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$ErrorActionPreference = 'Stop'
$extensionId = 'com.lyricmotion.ae.panel'

function Full-Path([string]$Value) {
  return [IO.Path]::GetFullPath($Value).TrimEnd('\')
}
function Is-Within([string]$Value, [string]$Parent) {
  return $Value.StartsWith($Parent + '\', [StringComparison]::OrdinalIgnoreCase)
}
function Is-Link([string]$Value) {
  $item = Get-Item -LiteralPath $Value -Force -ErrorAction SilentlyContinue
  return $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
}
function Has-Panel([string]$Value) {
  $manifest = Join-Path $Value 'CSXS\manifest.xml'
  return (Test-Path -LiteralPath $manifest -PathType Leaf) -and
    ([IO.File]::ReadAllText($manifest).Contains('Extension Id="' + $extensionId + '"'))
}
function Read-Marker {
  if (!(Test-Path -LiteralPath $markerPath -PathType Leaf)) { return $null }
  $value = Get-Content -LiteralPath $markerPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($value.extensionId -ne $extensionId -or (Full-Path $value.directory) -ne $dest) { throw 'Installation identity does not match this directory.' }
  return $value
}
function Write-Marker([string]$Status) {
  $value = @{ extensionId = $extensionId; version = $Version; directory = $dest; extensionDirectory = $entry; status = $Status } | ConvertTo-Json
  [IO.File]::WriteAllText($markerPath, $value, (New-Object Text.UTF8Encoding($false)))
}
function Validate-Destination {
  if ($dest -notmatch '^[A-Za-z]:\\.+' -or $dest -eq (Full-Path ([IO.Path]::GetPathRoot($dest)))) { throw 'Choose a dedicated folder on a local drive, not a drive root.' }
  if ((Split-Path $entry -Leaf) -ne $extensionId) { throw 'Unexpected AE extension entry.' }
  if ((Is-Within $dest $entry) -or (Is-Within $entry $dest)) { throw 'The installation folder cannot contain or be inside the AE extension entry.' }
  if (Is-Link $dest) { throw 'Select the actual installation folder instead of an existing directory link.' }
  if (Test-Path -LiteralPath $dest) {
    if (!(Test-Path -LiteralPath $dest -PathType Container)) { throw 'The destination is not a folder.' }
    $marker = Read-Marker
    if (!$marker -and !(Has-Panel $dest) -and @(Get-ChildItem -LiteralPath $dest -Force).Count -gt 0) { throw 'Choose an empty folder or an existing LyricMotion installation.' }
  }
  if ($dest -ne $entry -and (Test-Path -LiteralPath $entry) -and !(Has-Panel $entry)) { throw 'The AE extension entry is occupied by an unrecognized folder.' }
}
function Remove-EntryLink([string]$ExpectedTarget) {
  if (!(Is-Link $entry)) { return }
  $item = Get-Item -LiteralPath $entry -Force
  if ($item.LinkType -ne 'Junction' -or (Full-Path $item.Target[0]) -ne $ExpectedTarget) { return }
  # Remove the junction itself, never recurse into its destination.
  [IO.Directory]::Delete($entry)
}
function Register-Entry {
  if (!(Has-Panel $dest)) { throw 'The installed panel manifest is missing.' }
  if ($dest -eq $entry) { Write-Marker 'installed'; return }
  $parent = Split-Path $entry -Parent
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  $staging = Join-Path $parent ($extensionId + '.pending-' + [Guid]::NewGuid().ToString('N'))
  $oldTarget = $null
  $backup = $null
  $activated = $false
  try {
    New-Item -ItemType Junction -Path $staging -Target ([WildcardPattern]::Escape($dest)) | Out-Null
    if (Is-Link $entry) {
      $previous = Get-Item -LiteralPath $entry -Force
      if ($previous.LinkType -ne 'Junction') { throw 'The existing entry is not a managed directory junction.' }
      $oldTarget = Full-Path $previous.Target[0]
      Remove-EntryLink $oldTarget
    } elseif (Test-Path -LiteralPath $entry) {
      if (!(Has-Panel $entry)) { throw 'The existing AE entry is not LyricMotion.' }
      $backupRoot = Full-Path $BackupDirectory
      $backup = Full-Path (Join-Path $backupRoot ([Guid]::NewGuid().ToString('N')))
      if ((Split-Path $entry -Parent) -ne $parent -or !(Is-Within $backup $backupRoot) -or $backupRoot -eq $dest -or (Is-Within $backupRoot $dest) -or $backupRoot -eq $entry -or (Is-Within $backupRoot $entry)) { throw 'Unsafe previous-installation backup directory.' }
      New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
      Move-Item -LiteralPath $entry -Destination $backup
    }
    Move-Item -LiteralPath $staging -Destination $entry
    $activated = $true
    Write-Marker 'installed'
    if ($backup) { Write-Output ('Previous installation retained at: ' + $backup) }
  } catch {
    if ($activated) { Remove-EntryLink $dest }
    if (!(Test-Path -LiteralPath $entry)) {
      if ($backup -and (Test-Path -LiteralPath $backup)) { Move-Item -LiteralPath $backup -Destination $entry }
      elseif ($oldTarget) { New-Item -ItemType Junction -Path $entry -Target ([WildcardPattern]::Escape($oldTarget)) | Out-Null }
    }
    throw
  } finally {
    if (Is-Link $staging) { [IO.Directory]::Delete($staging) }
  }
}
function Owned-Path([string]$Relative) {
  if (!$Relative -or $Relative -match '(^|/)\.\.?(/|$)|[\\:]|^/' -or [IO.Path]::IsPathRooted($Relative)) { throw 'Unsafe installation file list.' }
  $full = Full-Path (Join-Path $dest $Relative)
  if (!(Is-Within $full $dest)) { throw 'Installation file escaped the selected folder.' }
  return $full
}
function Has-LinkedParent([string]$File) {
  $parent = Split-Path $File -Parent
  while ($parent -ne $dest -and (Is-Within $parent $dest)) {
    if (Is-Link $parent) { return $true }
    $parent = Split-Path $parent -Parent
  }
  return $false
}
function Uninstall-Files {
  $marker = Read-Marker
  if (!$marker -or $marker.status -ne 'installed' -or (Full-Path $marker.extensionDirectory) -ne $entry -or (Is-Link $dest)) { throw 'This folder is not a completed LyricMotion installation.' }
  $core = Get-Content -LiteralPath (Join-Path $dest 'installation-files.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $resources = Get-Content -LiteralPath (Join-Path $dest 'resources\manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($core.extensionId -ne $extensionId) { throw 'Installed file list has the wrong extension identity.' }
  $relativeFiles = @($core.files | ForEach-Object { $_.path }) + @($resources.files | ForEach-Object { $_.path }) + @('installation-files.json', 'resources/manifest.json', 'resources/install-receipt.json', '.lyricmotion-install.json')
  $paths = @($relativeFiles | ForEach-Object { Owned-Path $_ })
  $directories = @{}
  Remove-EntryLink $dest
  foreach ($file in $paths) {
    if (Has-LinkedParent $file) { continue }
    if (Test-Path -LiteralPath $file -PathType Leaf) { Remove-Item -LiteralPath $file -Force }
    $parent = Split-Path $file -Parent
    while ($parent -ne $dest -and (Is-Within $parent $dest)) { $directories[$parent] = $true; $parent = Split-Path $parent -Parent }
  }
  foreach ($directory in @($directories.Keys | Sort-Object Length -Descending)) {
    if (!(Is-Link $directory) -and (Test-Path -LiteralPath $directory -PathType Container) -and @(Get-ChildItem -LiteralPath $directory -Force).Count -eq 0) { [IO.Directory]::Delete($directory) }
  }
  # NSIS removes its own uninstaller and then removes the root only if empty.
  Write-Output 'Removed installed files. User-added files are preserved.'
}
try {
  $dest = Full-Path $Destination
  $entry = Full-Path $ExtensionDirectory
  $markerPath = Join-Path $dest '.lyricmotion-install.json'
  if ($Action -eq 'Uninstall') { Uninstall-Files }
  else {
    Validate-Destination
    if ($Action -eq 'Prepare') {
      New-Item -ItemType Directory -Path $dest -Force | Out-Null
      if (!(Read-Marker)) { Write-Marker 'pending' }
    } elseif ($Action -eq 'Register') { Register-Entry }
  }
  Write-Output ($Action + ' complete: ' + $dest)
  exit 0
} catch {
  Write-Output $_.Exception.Message
  exit 1
}
