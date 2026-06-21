@echo off
setlocal enabledelayedexpansion
title 文本处理工具

cd /d "%~dp0"

REM ===== 检查 Python =====
where python >nul 2>nul
if errorlevel 1 (
    echo.
    echo [错误] 未检测到 Python，请先安装 Python 3。
    echo 下载地址：https://www.python.org/downloads/
    echo 安装时请勾选 "Add Python to PATH"。
    echo.
    pause
    exit /b 1
)

REM ===== 检查是否拖入了文件 =====
if "%~1"=="" (
    echo.
    echo ============================================
    echo   文本处理工具
    echo ============================================
    echo.
    echo  支持的格式：.txt .epub .mobi .azw3 .jpg .jpeg
    echo.
    echo  使用方法：
    echo   1. 把文件直接拖到这个 .bat 图标上
    echo   2. 松手后选择输出格式即可
    echo.
    echo  依赖说明：
    echo   .mobi / .azw3 需要安装 Calibre
    echo   .jpg  / .jpeg  需要安装 Tesseract OCR（含中文包）
    echo.
    pause
    exit /b 0
)

REM ===== 处理每一个拖入的文件 =====
:loop
if "%~1"=="" goto end

set "INPUT=%~1"
set "EXT=%~x1"
set "EXT=!EXT: =!"

REM 检查扩展名是否支持
set "OK=0"
for %%E in (.txt .epub .mobi .azw3 .jpg .jpeg) do (
    if /i "!EXT!"=="%%E" set "OK=1"
)
if "!OK!"=="0" (
    echo.
    echo [跳过] 不支持的格式：%~nx1
    shift
    goto loop
)

echo.
echo ============================================
echo  正在处理：%~nx1
echo ============================================

REM ===== 选择输出格式 =====
set /p FMT=请选择输出格式 [1=Markdown(默认)  2=纯文本] (回车=1):
if "!FMT!"=="" set FMT=1
if "!FMT!"=="1" set FMT=md
if "!FMT!"=="2" set FMT=txt
if not "!FMT!"=="md" if not "!FMT!"=="txt" set FMT=md

REM ===== 生成输出路径（同目录同名，仅改后缀）=====
set "OUTPUT=%~dpn1.!FMT!"

python text_tool.py "%INPUT%" -f !FMT! -o "%OUTPUT%"

if errorlevel 1 (
    echo.
    echo [失败] 转换出错，请查看上方提示。
) else (
    echo.
    echo [成功] 输出文件：%OUTPUT%
)

shift
goto loop

:end
echo.
echo ============================================
echo  全部完成！按任意键关闭窗口。
echo ============================================
pause >nul
