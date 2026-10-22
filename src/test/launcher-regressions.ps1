param([string]$Launcher = (Join-Path $PSScriptRoot '..\Launch-DFO.ps1'))
$ErrorActionPreference='Stop'
. $Launcher
$selectedNode=Select-CompanionNodePath @([pscustomobject]@{Source='C:\Program Files\nodejs\node.exe'},[pscustomobject]@{Source='C:\Other\node.exe'})
if ($selectedNode -ne 'C:\Program Files\nodejs\node.exe') { throw 'Multiple Node installations were combined or selected incorrectly' }
Write-Output 'PASS: multiple Node installations select one executable'
if (-not (Test-CompanionGamePageUrl 'dagger://game/play/index.html?online&load=1')) { throw 'Normal online query rejected' }
foreach ($invalidPage in @('https://game/play/index.html','dagger://elsewhere/play/index.html','dagger://game/play/other.html','dagger://game:9223/play/index.html','dagger://user@game/play/index.html','dagger://game/play/index.html#other')) {
    if (Test-CompanionGamePageUrl $invalidPage) { throw "Wrong game-page URL accepted: $invalidPage" }
}
Write-Output 'PASS: normal online query accepted; six wrong scheme/host/path/port/auth/fragment cases rejected'
$script:launches=0; $script:messages=@(); $script:events=@(); $script:queue=@(); $script:position=0
$script:readerState=[pscustomobject]@{available=$true;readerReady=$true;reason='LIVE_PLAYER_VERIFIED'}
function Get-CompanionReaderState { return $script:readerState }
function Write-CompanionLog([string]$Message) { $script:events += $Message }
function Show-CompanionMessage([string]$Message) { $script:messages += $Message }
function Start-Sleep { param($Milliseconds) }
function Start-Process {
    param($FilePath,$WorkingDirectory,$ArgumentList,$WindowStyle,[switch]$PassThru)
    if ($FilePath -ne $script:GameExecutable -or $ArgumentList -notcontains '--remote-debugging-port=9223' -or $ArgumentList -notcontains '--remote-debugging-address=127.0.0.1') { throw 'Incorrect launch arguments' }
    $script:launches++; return [pscustomobject]@{Id=42}
}
function Get-CompanionState {
    $i=[Math]::Min($script:position,$script:queue.Count-1); $script:position++; return $script:queue[$i]
}
function State($running,$flags,$endpoint,$page,$reason='NO_LISTENER',$pidValue=42) {
    return [pscustomobject]@{executablePresent=$true;gameRunning=$running;diagnosticFlagsPresent=$flags;endpointReady=$endpoint;gamePageReady=$page;reason=$reason;processIds=@($pidValue)}
}
function Scenario($name,$states,$code,$launchCount,$messagePattern='') {
    $script:queue=$states; $script:position=0; $script:launches=0; $script:messages=@(); $script:events=@()
    $actual=Invoke-CompanionLaunch -Attempts 6
    if ($actual -ne $code -or $script:launches -ne $launchCount) { throw "$name failed: code=$actual launches=$script:launches" }
    if ($messagePattern -and ($script:messages -join ' ') -notmatch $messagePattern) { throw "$name omitted useful explanation" }
    if ($script:events.Count -eq 0) { throw "$name omitted log" }
    Write-Output "PASS: $name"
}
$closed=State $false $false $false $false
$ready=State $true $true $true $true 'READY'
$loading=State $true $true $true $false 'WAITING_FOR_GAME_PAGE'
$dropped=State $true $false $false $false 'UPDATER_DROPPED_FLAGS' 99
Scenario 'existing updated game is preserved and explained' @($dropped) 2 0 'updated itself'
Scenario 'transient launcher endpoint does not hide updater handoff' @($closed,$closed,$loading,$dropped) 2 1 'updated itself'
Scenario 'closed game launches once and waits for game page' @($closed,$closed,$loading,$ready,$ready,$ready) 0 1
Scenario 'already loading game is observed without duplicate launch' @($loading,$ready,$ready,$ready) 0 0
Scenario 'user launch between checks prevents duplicate' @($closed,$ready,$ready,$ready,$ready) 0 0
Scenario 'existing flagless game is preserved and explained' @((State $true $false $false $false)) 2 0 'already running without'
Write-Output '6 launcher regressions passed; all process starts, messages, waits and logs mocked.'
$script:readerState=[pscustomobject]@{available=$false;readerReady=$false;reason='PLAYER_SOURCE_NOT_REVIEWED'}
Scenario 'source refusal preserves game and requests review rather than restart' @($ready) 2 0 'Keep DFO open'
$script:readerState=[pscustomobject]@{available=$false;readerReady=$false;reason='PLAYER_NOT_AVAILABLE'}
Scenario 'connection before character load never claims full ready' @($ready) 0 0
if (@($script:events | Where-Object { $_ -match '^READY ' }).Count) { throw 'Unverified character was reported ready' }
Write-Output '8 launcher regressions passed, including actual-player readiness gating.'
$script:readerState=[pscustomobject]@{available=$false;readerReady=$false;reason='NO_REVIEWED_EXECUTED_HOST'}
Scenario 'title menu waits for character without false compatibility popup' @($ready) 0 0
if ($script:messages.Count -ne 0 -or @($script:events | Where-Object { $_ -match '^READY ' }).Count) { throw 'Title menu was reported ready or showed a false compatibility popup' }
Write-Output '9 launcher regressions passed, including title-menu loading state.'
