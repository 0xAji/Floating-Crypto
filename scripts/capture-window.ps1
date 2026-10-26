param([string]$OutputPath)

if (-not $OutputPath) {
  $repositoryRoot = Split-Path -Parent $PSScriptRoot
  $OutputPath = Join-Path $repositoryRoot ".artifacts\app-screenshot.png"
}

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class FloatingWindowCapture {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

$process = Get-Process electron -ErrorAction Stop |
  Where-Object { $_.MainWindowTitle -eq "Floating Crypto" } |
  Select-Object -First 1

if (-not $process) {
  throw "Floating Crypto window was not found."
}

[FloatingWindowCapture]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 400

$rect = New-Object FloatingWindowCapture+RECT
if (-not [FloatingWindowCapture]::GetWindowRect($process.MainWindowHandle, [ref]$rect)) {
  throw "Unable to read the application window bounds."
}

$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)

$parent = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $parent)) {
  New-Item -ItemType Directory -Path $parent | Out-Null
}

$bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

Write-Output "${width}x${height} $OutputPath"
