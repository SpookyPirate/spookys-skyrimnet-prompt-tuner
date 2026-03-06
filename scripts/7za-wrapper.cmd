@echo off
rem Wrapper for 7za.exe that converts exit code 2 (warning) to 0 (success).
rem Exit code 2 from 7-zip means "warning" (e.g. cannot create macOS symlinks on Windows
rem without Developer Mode). The extraction still succeeds for all non-symlink files.
rem electron-builder's winCodeSign-2.6.0.7z contains macOS symlinks that trigger this.
"%~dp0..\node_modules\7zip-bin\win\x64\7za.exe" %*
if %ERRORLEVEL% EQU 2 exit /b 0
exit /b %ERRORLEVEL%
