@echo off
setlocal ENABLEEXTENSIONS
for %%D in (catalogo pedidos art financeiro suporte conta admin) do (
  mkdir "src\modules\%%D\ui" 2>nul
  mkdir "src\modules\%%D\services" 2>nul
  mkdir "src\modules\%%D\hooks" 2>nul
  mkdir "src\modules\%%D\tests" 2>nul
  type nul > "src\modules\%%D\.gitkeep"
  type nul > "src\modules\%%D\ui\.gitkeep"
  type nul > "src\modules\%%D\services\.gitkeep"
  type nul > "src\modules\%%D\hooks\.gitkeep"
  type nul > "src\modules\%%D\tests\.gitkeep"
)
echo Estrutura criada em src\modules\...
endlocal
