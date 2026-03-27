@echo off
chcp 65001 >nul
setlocal

set PROJECT_DIR=E:\cebms_dev
set BACKEND_DIR=%PROJECT_DIR%\backend
set FRONTEND_DIR=%PROJECT_DIR%\frontend
set POSTGRES_CONTAINER=cebms-postgres

if "%~1"=="" goto help
if /I "%~1"=="start" goto start
if /I "%~1"=="stop" goto stop
if /I "%~1"=="restart" goto restart
if /I "%~1"=="logs" goto logs
if /I "%~1"=="clean" goto clean
goto help

:start
echo ===== 启动 Docker 服务 =====
cd /d "%PROJECT_DIR%"

echo [1/4] 清理可能冲突的旧容器...
docker rm -f %POSTGRES_CONTAINER% 2>nul

echo [2/4] 停止旧服务...
docker compose down

echo [3/4] 启动 Docker 服务...
docker compose up -d
if errorlevel 1 (
    echo.
    echo Docker 启动失败，请检查 compose 配置或容器日志。
    pause
    exit /b 1
)

echo.
echo ===== 启动 Backend =====
cd /d "%BACKEND_DIR%"
start "CEBMS Backend" cmd /k "uvicorn app.main:app --reload"

echo.
echo ===== 启动 Frontend =====
cd /d "%FRONTEND_DIR%"
start "CEBMS Frontend" cmd /k "npm run dev"

echo.
echo ===== 全部启动完成 =====
exit /b 0

:stop
echo ===== 停止 Docker 服务 =====
cd /d "%PROJECT_DIR%"
docker compose down
echo ===== 已停止 =====
exit /b 0

:restart
call "%~f0" stop
call "%~f0" start
exit /b 0

:logs
echo ===== 查看 Docker 日志 =====
cd /d "%PROJECT_DIR%"
docker compose logs -f
exit /b 0

:clean
echo ===== 清理冲突容器 =====
docker rm -f %POSTGRES_CONTAINER% 2>nul
cd /d "%PROJECT_DIR%"
docker compose down --remove-orphans
echo ===== 清理完成 =====
exit /b 0

:help
echo.
echo 用法：
echo   dev.bat start    启动 Docker + Backend + Frontend
echo   dev.bat stop     停止 Docker 服务
echo   dev.bat restart  重启全部服务
echo   dev.bat logs     查看 Docker 日志
echo   dev.bat clean    清理冲突容器和孤儿容器
echo.
pause
exit /b 0