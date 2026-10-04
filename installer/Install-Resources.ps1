param(
  [Parameter(Mandatory = $true)][string]$LockFile,
  [Parameter(Mandatory = $true)][string]$ManifestFile,
  [Parameter(Mandatory = $true)][string]$Destination,
  [string]$OfflineObjects,
  [string]$CacheDirectory,
  [int]$Concurrency = 8
)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.IO.Compression
$curl = Join-Path $env:SystemRoot 'System32\curl.exe'
if (Test-Path -LiteralPath (Join-Path $env:SystemRoot 'Sysnative\curl.exe')) { $curl = Join-Path $env:SystemRoot 'Sysnative\curl.exe' }
$processes = New-Object 'System.Collections.Generic.List[object]'
$dest = [IO.Path]::GetFullPath($Destination)
$resourceRoot = Join-Path $dest 'resources'
if (!$CacheDirectory) { $CacheDirectory = Join-Path $env:LOCALAPPDATA 'LyricMotion-AE\downloads' }
$cache = [IO.Path]::GetFullPath($CacheDirectory)
$downloaded = 0
$reused = 0
$cached = 0

function Test-Resource([string]$File, [string]$Hash, [long]$Bytes) {
  if (!(Test-Path -LiteralPath $File -PathType Leaf)) { return $false }
  if ((Get-Item -LiteralPath $File).Length -ne $Bytes) { return $false }
  $stream = [IO.File]::OpenRead($File)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try { $actual = [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
  finally { $algorithm.Dispose(); $stream.Dispose() }
  return $actual -eq $Hash
}
function Write-ObjectBytes([byte[]]$Bytes, $Entry) {
  $temporary = Join-Path $cache ($Entry.sha256 + '.partial')
  $inputStream = New-Object IO.MemoryStream(,$Bytes)
  $gzip = New-Object IO.Compression.GZipStream($inputStream, [IO.Compression.CompressionMode]::Decompress)
  $outputStream = [IO.File]::Create($temporary)
  try {
    $buffer = New-Object byte[] 65536
    $written = 0L
    while (($read = $gzip.Read($buffer, 0, $buffer.Length)) -gt 0) {
      $written += $read
      if ($written -gt $Entry.bytes) { throw 'Resource exceeds its declared size.' }
      $outputStream.Write($buffer, 0, $read)
    }
  } finally { $outputStream.Dispose(); $gzip.Dispose(); $inputStream.Dispose() }
  if (!(Test-Resource $temporary $Entry.sha256 $Entry.bytes)) {
    Remove-Item -LiteralPath $temporary -Force
    throw 'Downloaded resource failed size or SHA-256 validation.'
  }
  $verified = Join-Path $cache ($Entry.sha256 + '.verified')
  Move-Item -LiteralPath $temporary -Destination $verified -Force
  return $verified
}
function Start-Download($Job) {
  $arguments = @('-q', '--fail', '--location', '--proto', '=https', '--connect-timeout', '20', '--max-time', '300', '--silent', '--show-error', '--max-filesize', ([string]($Job.Entry.bytes + 1048576)), '--output', ('"' + $Job.File + '"'), ('"' + $Job.Url + '"'))
  $proxy = [Net.WebRequest]::GetSystemWebProxy().GetProxy([Uri]$Job.Url)
  if ($proxy -and $proxy.AbsoluteUri -ne $Job.Url) { $arguments = @('-q', '--proxy', ('"' + $proxy.AbsoluteUri + '"')) + $arguments[1..($arguments.Length-1)] }
  $process = New-Object Diagnostics.Process
  $process.StartInfo.FileName = $curl
  $process.StartInfo.Arguments = $arguments -join ' '
  $process.StartInfo.UseShellExecute = $false
  $process.StartInfo.CreateNoWindow = $true
  $process.StartInfo.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
  $process.StartInfo.RedirectStandardError = $true
  [void]$process.Start()
  $Job.ErrorTask = $process.StandardError.ReadToEndAsync()
  $processes.Add($process)
  return $process
}
try {
  $lock = Get-Content -LiteralPath $LockFile -Raw -Encoding UTF8 | ConvertFrom-Json
  $manifest = Get-Content -LiteralPath $ManifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($lock.baseUrl -notmatch '^https://raw\.githubusercontent\.com/guhechudaisuki/LyricMotion-AE---/[0-9a-f]{40}/$') { throw 'Resource URL must use an immutable repository commit.' }
  if ($lock.format -ne 'sha256-gzip-v1' -or $lock.files -ne $manifest.files.Count) { throw 'Resource manifest version mismatch.' }
  New-Item -ItemType Directory -Path $cache -Force | Out-Null
  $available = @{}
  $missing = New-Object 'System.Collections.Generic.List[object]'
  Write-Output 'Checking existing resources; valid files will not be downloaded...'
  foreach ($file in $manifest.files) {
    if ($file.path -notmatch '^resources/' -or $file.path -match '(^|/)\.\.(/|$)|[\\:]' -or $file.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Unsafe resource manifest.' }
    $target = Join-Path $dest $file.path
    if (Test-Resource $target $file.sha256 $file.bytes) { $available[$file.sha256] = $target; $reused++ }
    else { $missing.Add($file) }
  }
  $queue = New-Object 'System.Collections.Generic.Queue[object]'
  $queued = @{}
  foreach ($file in $missing) {
    if ($available.ContainsKey($file.sha256) -or $queued.ContainsKey($file.sha256)) { continue }
    $verified = Join-Path $cache ($file.sha256 + '.verified')
    if (Test-Resource $verified $file.sha256 $file.bytes) { $available[$file.sha256] = $verified; $cached++; continue }
    $queue.Enqueue($file); $queued[$file.sha256] = $true
  }
  $total = $queue.Count
  Write-Output ('Reused {0} installed files and {1} cached objects; {2} objects need downloading.' -f $reused, $cached, $total)
  if (!$OfflineObjects -and !(Test-Path -LiteralPath $curl)) { throw 'Windows curl.exe is required (Windows 10 1803 or newer).' }
  $active = New-Object 'System.Collections.Generic.List[object]'
  while ($queue.Count -gt 0 -or $active.Count -gt 0) {
    while ($queue.Count -gt 0 -and $active.Count -lt [Math]::Max(1, [Math]::Min(16, $Concurrency))) {
      $file = $queue.Dequeue()
      $relative = 'objects/' + $file.sha256.Substring(0, 2) + '/' + $file.sha256 + '.gz'
      if ($OfflineObjects) {
        $available[$file.sha256] = Write-ObjectBytes ([IO.File]::ReadAllBytes((Join-Path $OfflineObjects $relative))) $file
        $downloaded++
      } else {
        $job = @{ Entry = $file; Url = $lock.baseUrl + $relative; Attempt = 1; File = (Join-Path $cache ($file.sha256 + '.gz.partial')) }
        $job.Process = Start-Download $job
        $active.Add($job)
      }
    }
    if ($active.Count -gt 0) {
      $completed = $false
      for ($index = $active.Count - 1; $index -ge 0; $index--) {
        $job = $active[$index]
        if (!$job.Process.HasExited) { continue }
        $completed = $true
        try {
          $job.Process.WaitForExit()
          if ($job.Process.ExitCode -ne 0) { throw ('Download failed (curl ' + $job.Process.ExitCode + '): ' + $job.ErrorTask.GetAwaiter().GetResult()) }
          $data = [IO.File]::ReadAllBytes($job.File)
          $available[$job.Entry.sha256] = Write-ObjectBytes $data $job.Entry
          $downloaded++
          if ($downloaded % 20 -eq 0 -or $downloaded -eq $total) { Write-Output ('Downloaded {0}/{1} objects.' -f $downloaded, $total) }
          Remove-Item -LiteralPath $job.File -Force
          [void]$processes.Remove($job.Process)
          $job.Process.Dispose()
          $active.RemoveAt($index)
        } catch {
          if ($job.Attempt -ge 3) { throw }
          $job.Attempt++
          Write-Output ('Retry {0}/3 for {1}' -f $job.Attempt, $job.Entry.path)
          [void]$processes.Remove($job.Process)
          $job.Process.Dispose()
          $job.Process = Start-Download $job
        }
      }
      if (!$completed) { Start-Sleep -Milliseconds 75 }
    }
  }
  Write-Output 'Installing verified missing files...'
  foreach ($file in $missing) {
    $target = Join-Path $dest $file.path
    New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
    $temporary = $target + '.lyricmotion-new'
    Copy-Item -LiteralPath $available[$file.sha256] -Destination $temporary -Force
    if (!(Test-Resource $temporary $file.sha256 $file.bytes)) { throw 'Resource copy verification failed.' }
    Move-Item -LiteralPath $temporary -Destination $target -Force
  }
  New-Item -ItemType Directory -Path $resourceRoot -Force | Out-Null
  if ([IO.Path]::GetFullPath($ManifestFile) -ne (Join-Path $resourceRoot 'manifest.json')) { Copy-Item -LiteralPath $ManifestFile -Destination (Join-Path $resourceRoot 'manifest.json') -Force }
  # Remove only the verified cache objects used by this successful installation.
  foreach ($hash in $available.Keys) {
    $verified = Join-Path $cache ($hash + '.verified')
    if (Test-Path -LiteralPath $verified) { Remove-Item -LiteralPath $verified -Force }
  }
  $receipt = @{ version = $lock.version; installed = $missing.Count; reused = $reused; downloaded = $downloaded; cached = $cached; completedUtc = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json
  [IO.File]::WriteAllText((Join-Path $resourceRoot 'install-receipt.json'), $receipt, (New-Object Text.UTF8Encoding($false)))
  Write-Output ('Resources ready: installed={0}; reused={1}; downloaded={2}; cached={3}' -f $missing.Count, $reused, $downloaded, $cached)
  exit 0
} catch {
  Write-Output ('Resource installation failed: ' + $_.Exception.Message)
  Write-Output 'Verified downloads are cached. Re-run the installer to resume.'
  exit 1
} finally {
  foreach ($process in $processes) {
    if (!$process.HasExited) { $process.Kill() }
    $process.Dispose()
  }
}
