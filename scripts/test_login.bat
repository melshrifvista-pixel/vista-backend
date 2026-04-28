@echo off
curl.exe -s -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\": \"testuser_063708\", \"password\": \"Password123!\"}"
echo.
