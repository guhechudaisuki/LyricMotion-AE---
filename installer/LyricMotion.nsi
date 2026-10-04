Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!ifndef VERSION
  !error "Pass VERSION from scripts/package.mjs"
!endif
Name "映词 LyricMotion AE 动态歌词"
!ifndef LM_EXTENSION_DIRECTORY
  !define LM_EXTENSION_DIRECTORY "$APPDATA\Adobe\CEP\extensions\com.lyricmotion.ae.panel"
!endif
!ifndef LM_UNINSTALL_KEY
  !define LM_UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\LyricMotion-AE"
!endif
!ifndef LM_BACKUP_DIRECTORY
  !define LM_BACKUP_DIRECTORY "$LOCALAPPDATA\LyricMotion-AE\previous-installations"
!endif
!ifndef LM_RESOURCE_MANIFEST
  !define LM_RESOURCE_MANIFEST "..\resources\manifest.json"
!endif
!ifndef LM_RESOURCE_LOCK
  !define LM_RESOURCE_LOCK "..\config\resources-lock.json"
!endif
!ifndef LM_OUTFILE
  !define LM_OUTFILE "..\dist\LyricMotion-AE-${VERSION}-setup.exe"
!endif
OutFile "${LM_OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\LyricMotion-AE"
InstallDirRegKey HKCU "${LM_UNINSTALL_KEY}" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "LyricMotion ${VERSION}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "映词 LyricMotion ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "安装动态歌词面板。下一步可选择插件和 resources 的存放目录，安装器会自动建立 AE 扩展入口。安装时检查本地资源，只下载缺失或损坏的文件；更换目录时可复用原安装的资源。建议先关闭映词面板。"
!define MUI_FINISHPAGE_TITLE "安装完成"
!define MUI_FINISHPAGE_TEXT "插件和 resources 已安装到：$\r$\n$INSTDIR$\r$\n$\r$\n请自行打开或重启 AE，然后从窗口 > 扩展打开映词。"
!insertmacro MUI_PAGE_WELCOME
!define MUI_DIRECTORYPAGE_TEXT_TOP "选择插件和 resources 的存放目录。请选择空文件夹或已有的映词安装目录。安装器会自动在 AE 标准扩展目录建立入口。"
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "插件与 resources 的安装位置"
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE DirectoryLeave
!insertmacro MUI_PAGE_DIRECTORY
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
Var PreviousDirectory
Function .onInit
!ifdef LM_TEST
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "LyricMotion-AE-Installer-Test") p .r0 ?e'
!else
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "LyricMotion-AE-Installer") p .r0 ?e'
!endif
  Pop $1
  ${If} $1 == 183
    MessageBox MB_ICONEXCLAMATION "已有一个映词安装器正在运行。" /SD IDOK
    Abort
  ${EndIf}
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File "Manage-Installation.ps1"
  File "Install-Resources.ps1"
  File /oname=resources-lock.json "${LM_RESOURCE_LOCK}"
  File /oname=manifest.json "${LM_RESOURCE_MANIFEST}"
  File /oname=build-files.json "..\dist\build-files.json"
FunctionEnd
Function DirectoryLeave
  nsExec::ExecToStack 'powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\Manage-Installation.ps1" -Action Validate -Destination "$INSTDIR" -ExtensionDirectory "${LM_EXTENSION_DIRECTORY}"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_ICONEXCLAMATION "无法使用此目录，请选择空文件夹或已有的映词安装目录。$\r$\n$\r$\n$1"
    Abort
  ${EndIf}
FunctionEnd
Section "安装映词"
  SetShellVarContext current
  nsExec::ExecToStack 'powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\Manage-Installation.ps1" -Action Prepare -Destination "$INSTDIR" -ExtensionDirectory "${LM_EXTENSION_DIRECTORY}" -Version "${VERSION}"'
  Pop $0
  Pop $1
  DetailPrint "$1"
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "无法使用此安装目录。请查看安装详情并重新选择目录。" /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  ReadRegStr $PreviousDirectory HKCU "${LM_UNINSTALL_KEY}" "InstallLocation"
  GetFullPathName $INSTDIR "$INSTDIR"
  ${If} $PreviousDirectory == ""
    StrCpy $PreviousDirectory "${LM_EXTENSION_DIRECTORY}"
  ${EndIf}
  DetailPrint "安装位置：$INSTDIR"
  DetailPrint "正在检查并补全精选资源…"
  nsExec::ExecToLog 'powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\Install-Resources.ps1" -LockFile "$PLUGINSDIR\resources-lock.json" -ManifestFile "$PLUGINSDIR\manifest.json" -Destination "$INSTDIR" -ReuseDirectory "$PreviousDirectory"'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "资源下载或校验失败，安装已停止。请查看安装详情后重新运行安装器。" /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  SetOutPath "$INSTDIR"
  ClearErrors
  File /r /x resources "..\dist\com.lyricmotion.ae.panel\*.*"
  CopyFiles /SILENT "$PLUGINSDIR\build-files.json" "$INSTDIR\installation-files.json"
  WriteUninstaller "$INSTDIR\卸载映词.exe"
  ${If} ${Errors}
    MessageBox MB_ICONSTOP "部分文件无法写入，请关闭映词面板后重试。" /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  !include "..\dist\cleanup-legacy.nsh"
  nsExec::ExecToLog 'powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\Manage-Installation.ps1" -Action Register -Destination "$INSTDIR" -ExtensionDirectory "${LM_EXTENSION_DIRECTORY}" -BackupDirectory "${LM_BACKUP_DIRECTORY}" -Version "${VERSION}"'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "建立 AE 扩展入口失败。原入口已保留，请查看安装详情后重试。" /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
!ifndef LM_TEST
  WriteRegStr HKCU "Software\Adobe\CSXS.11" "PlayerDebugMode" "1"
  WriteRegStr HKCU "Software\Adobe\CSXS.12" "PlayerDebugMode" "1"
  WriteRegStr HKCU "Software\Adobe\CSXS.13" "PlayerDebugMode" "1"
  WriteRegStr HKCU "Software\Adobe\CSXS.14" "PlayerDebugMode" "1"
!endif
  WriteRegStr HKCU "${LM_UNINSTALL_KEY}" "DisplayName" "映词 LyricMotion AE 动态歌词"
  WriteRegStr HKCU "${LM_UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${LM_UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${LM_UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\卸载映词.exe"'
  WriteRegDWORD HKCU "${LM_UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${LM_UNINSTALL_KEY}" "NoRepair" 1
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  GetFullPathName $INSTDIR "$INSTDIR"
  ReadRegStr $PreviousDirectory HKCU "${LM_UNINSTALL_KEY}" "InstallLocation"
  ${If} $PreviousDirectory != ""
    GetFullPathName $PreviousDirectory "$PreviousDirectory"
  ${EndIf}
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File "Manage-Installation.ps1"
  nsExec::ExecToLog 'powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\Manage-Installation.ps1" -Action Uninstall -Destination "$INSTDIR" -ExtensionDirectory "${LM_EXTENSION_DIRECTORY}"'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "卸载未完成，请查看安装目录或文件是否被占用。" /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  Delete "$INSTDIR\卸载映词.exe"
  RMDir "$INSTDIR"
  ${If} $PreviousDirectory == $INSTDIR
    DeleteRegKey HKCU "${LM_UNINSTALL_KEY}"
  ${EndIf}
SectionEnd
