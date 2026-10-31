!ifndef BUILD_UNINSTALLER

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var AiSetupCheckbox
Var AiSetupSelected

!macro customInit
  StrCpy $AiSetupSelected "0"
!macroend

!macro customWelcomePage
  Page custom AiSetupPage AiSetupLeave
!macroend

Function AiSetupPage
  nsDialogs::Create 1018
  Pop $0

  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0u 0u 100% 18u "WorkTracker - Optional AI Features"
  Pop $0

  ${NSD_CreateLabel} 0u 24u 100% 30u "WorkTracker works without AI. You can choose to set up local AI now or enable it later."
  Pop $0

  ${NSD_CreateCheckbox} 0u 65u 100% 16u "Enable local AI (existing installations will be reused)"
  Pop $AiSetupCheckbox

  ${If} $AiSetupSelected == "1"
    ${NSD_SetState} $AiSetupCheckbox ${BST_CHECKED}
  ${EndIf}

  ${NSD_CreateLabel} 0u 92u 100% 48u "Optional requirements: Ollama for Windows and the Qwen3 4B model (approximately 2.5 GB). An internet connection is needed for initial downloads."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function AiSetupLeave
  ${NSD_GetState} $AiSetupCheckbox $AiSetupSelected
FunctionEnd

!macro customInstall
  Delete "$INSTDIR\resources\ai-setup-requested.flag"

  ${If} $AiSetupSelected == "1"
    CreateDirectory "$INSTDIR\resources"
    FileOpen $0 "$INSTDIR\resources\ai-setup-requested.flag" w
    FileClose $0
  ${EndIf}
!macroend

!endif