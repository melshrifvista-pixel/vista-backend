@echo off
set BASE_URL=http://localhost:3000/api
set TIMESTAMP=%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set USERNAME=testuser_%TIMESTAMP: =0%
set EMAIL=test_%TIMESTAMP: =0%@example.com

echo Testing Registration for %USERNAME%...
curl.exe -s -X POST %BASE_URL%/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"username\": \"%USERNAME%\", \"password\": \"Password123!\", \"fullName\": \"Test User\", \"email\": \"%EMAIL%\"}"

echo.
echo Testing Login for %USERNAME%...
curl.exe -s -X POST %BASE_URL%/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\": \"%USERNAME%\", \"password\": \"Password123!\"}"

echo.
