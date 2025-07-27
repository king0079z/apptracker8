; build-resources/installer.nsh
; Custom NSIS script for Enterprise Software Monitor

!macro preInit
  ; This macro is inserted at the beginning of the NSIS script
  SetRegView 64
!macroend

!macro customInit
  ; Check if running as administrator
  UserInfo::GetAccountType
  Pop $0
  ${If} $0 != "admin"
    MessageBox MB_ICONSTOP "Administrator privileges required!"
    SetErrorLevel 1223
    Quit
  ${EndIf}
!macroend

!macro customInstall
  ; Create firewall rules for the application
  DetailPrint "Configuring Windows Firewall..."
  
  ; Main application firewall rule (port 3443)
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Enterprise Monitor Server" dir=in action=allow protocol=TCP localport=3443 program="$INSTDIR\${PRODUCT_NAME}.exe"'
  
  ; Create application data directory
  CreateDirectory "$APPDATA\${PRODUCT_NAME}"
  
  ; Set permissions for the application directory
  AccessControl::GrantOnFile "$APPDATA\${PRODUCT_NAME}" "(S-1-5-32-545)" "FullAccess"
  
  ; Create start menu shortcuts
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_NAME}.exe"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  
  ; Register URL protocol for enterprise monitor
  WriteRegStr HKCR "enterprisemonitor" "" "URL:Enterprise Monitor Protocol"
  WriteRegStr HKCR "enterprisemonitor" "URL Protocol" ""
  WriteRegStr HKCR "enterprisemonitor\DefaultIcon" "" "$INSTDIR\${PRODUCT_NAME}.exe,0"
  WriteRegStr HKCR "enterprisemonitor\shell\open\command" "" '"$INSTDIR\${PRODUCT_NAME}.exe" "%1"'
  
  ; Install Visual C++ Redistributable if needed
  File /oname=$TEMP\vc_redist.x64.exe "${BUILD_RESOURCES_DIR}\vc_redist.x64.exe"
  ExecWait '"$TEMP\vc_redist.x64.exe" /quiet /norestart'
  Delete "$TEMP\vc_redist.x64.exe"
  
  ; Create scheduled task for auto-start
  DetailPrint "Creating scheduled task..."
  nsExec::ExecToLog 'schtasks /create /tn "Enterprise Monitor" /tr "$INSTDIR\${PRODUCT_NAME}.exe --hidden" /sc onlogon /rl highest /f'
!macroend

!macro customUnInstall
  ; Remove firewall rules
  DetailPrint "Removing Windows Firewall rules..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Enterprise Monitor Server"'
  
  ; Remove scheduled task
  DetailPrint "Removing scheduled task..."
  nsExec::ExecToLog 'schtasks /delete /tn "Enterprise Monitor" /f'
  
  ; Remove URL protocol registration
  DeleteRegKey HKCR "enterprisemonitor"
  
  ; Remove start menu shortcuts
  RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"
  
  ; Remove application data
  MessageBox MB_YESNO "Remove all application data and settings?" IDYES true IDNO false
  true:
    RMDir /r "$APPDATA\${PRODUCT_NAME}"
  false:
!macroend

; Custom pages
!macro customPageAfterChangeDir
  ; Add custom configuration page
  !insertmacro MUI_PAGE_HEADER_TEXT "Enterprise Configuration" "Configure enterprise settings"
  
  nsDialogs::Create 1018
  Pop $0
  
  ${NSD_CreateLabel} 0 0 100% 20u "Configure enterprise server connection (optional):"
  
  ${NSD_CreateLabel} 0 30u 30% 12u "Server URL:"
  ${NSD_CreateText} 35% 28u 60% 12u ""
  Pop $1
  
  ${NSD_CreateLabel} 0 50u 30% 12u "API Key:"
  ${NSD_CreatePassword} 35% 48u 60% 12u ""
  Pop $2
  
  ${NSD_CreateCheckbox} 0 75u 100% 12u "Enable automatic network scanning"
  Pop $3
  ${NSD_Check} $3
  
  nsDialogs::Show
!macroend