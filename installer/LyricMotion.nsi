Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!ifndef VERSION
  !error "Pass VERSION from scripts/package.mjs"
!endif
Name "映词 LyricMotion AE 动态歌词"
OutFile "..\dist\LyricMotion-AE-${VERSION}-setup.exe"
InstallDir "$APPDATA\Adobe\CEP\extensions\com.lyricmotion.ae.panel"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "LyricMotion ${VERSION}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "映词 LyricMotion ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "安装动态歌词面板。安装时先检查本地资源，只从 GitHub 下载缺失或损坏的文件。下载中断后重新运行可继续，请保持网络连接，并预留约 3 GB 临时磁盘空间。建议先关闭映词面板。安装器不会启动 After Effects。"
!define MUI_FINISHPAGE_TITLE "安装完成"
!define MUI_FINISHPAGE_TEXT "请自行打开或重启 AE，然后从窗口 > 扩展打开映词。"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=2052 "ProductName" "映词 LyricMotion"
VIAddVersionKey /LANG=2052 "FileDescription" "映词 AE 动态歌词面板安装器"
VIAddVersionKey /LANG=2052 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=2052 "LegalCopyright" "LyricMotion"
Function .onInit
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "LyricMotion-AE-Installer") p .r0 ?e'
  Pop $1
  ${If} $1 == 183
    MessageBox MB_ICONEXCLAMATION "已有一个映词安装器正在运行。"
    Abort
  ${EndIf}
FunctionEnd
Section "安装映词"
  SetShellVarContext current
  StrCpy $INSTDIR "$APPDATA\Adobe\CEP\extensions\com.lyricmotion.ae.panel"
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File "Install-Resources.ps1"
  File "..\config\resources-lock.json"
  File "..\resources\manifest.json"
  DetailPrint "正在从 GitHub 下载并校验精选资源，请保持网络连接…"
  nsExec::ExecToLog 'powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\Install-Resources.ps1" -LockFile "$PLUGINSDIR\resources-lock.json" -ManifestFile "$PLUGINSDIR\manifest.json" -Destination "$INSTDIR"'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "资源下载或校验失败，安装已停止。请查看安装详情，确认可以访问 GitHub 后重新运行安装器。"
    SetErrorLevel 1
    Abort
  ${EndIf}
  SetOutPath "$INSTDIR"
  ClearErrors
  File /r /x resources "..\dist\com.lyricmotion.ae.panel\*.*"
  IfErrors 0 +3
    MessageBox MB_ICONSTOP "部分文件无法写入，请关闭映词面板后重试。"
    Abort
  !include "..\dist\cleanup-legacy.nsh"
  WriteRegStr HKCU "Software\Adobe\CSXS.11" "PlayerDebugMode" "1"
  WriteRegStr HKCU "Software\Adobe\CSXS.12" "PlayerDebugMode" "1"
  WriteRegStr HKCU "Software\Adobe\CSXS.13" "PlayerDebugMode" "1"
  WriteRegStr HKCU "Software\Adobe\CSXS.14" "PlayerDebugMode" "1"
  WriteUninstaller "$INSTDIR\卸载映词.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LyricMotion-AE" "DisplayName" "映词 LyricMotion AE 动态歌词"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LyricMotion-AE" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LyricMotion-AE" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LyricMotion-AE" "UninstallString" '"$INSTDIR\卸载映词.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LyricMotion-AE" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LyricMotion-AE" "NoRepair" 1
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  StrCpy $0 "$APPDATA\Adobe\CEP\extensions\com.lyricmotion.ae.panel"
  ${If} $INSTDIR != $0
    MessageBox MB_ICONSTOP "目录不匹配，已停止卸载。"
    Abort
  ${EndIf}
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LyricMotion-AE"
SectionEnd
