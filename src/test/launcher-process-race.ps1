$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '..\Launch-DFO.ps1')
function Get-CimInstance { @() }
function Get-NetTCPConnection { [pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=9292} }
function Get-Process { throw 'Cannot find a process with the process identifier 9292.' }
$state=Get-CompanionState
if($state.reason -ne 'LISTENER_CHANGED_DURING_CHECK'){throw 'Disappearing process was not handled'}
if($state.endpointReady){throw 'A vanished process must never establish readiness'}
'PASS: updater process disappears without crashing or claiming readiness'
