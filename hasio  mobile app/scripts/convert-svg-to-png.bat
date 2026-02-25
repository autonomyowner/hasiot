@echo off
echo Converting SVG icons to PNG...
echo.
echo You can use one of these methods:
echo.
echo 1. Online converter (easiest):
echo    - Go to https://svgtopng.com/
echo    - Upload each SVG from assets/images/
echo    - Download as PNG with these sizes:
echo      * icon.svg -> icon.png (1024x1024)
echo      * adaptive-icon.svg -> adaptive-icon.png (1024x1024)
echo      * splash-icon.svg -> splash-icon.png (1024x1024)
echo      * favicon.svg -> favicon.png (48x48)
echo.
echo 2. Using Inkscape (if installed):
echo    inkscape -w 1024 -h 1024 assets/images/icon.svg -o assets/images/icon.png
echo    inkscape -w 1024 -h 1024 assets/images/adaptive-icon.svg -o assets/images/adaptive-icon.png
echo    inkscape -w 1024 -h 1024 assets/images/splash-icon.svg -o assets/images/splash-icon.png
echo    inkscape -w 48 -h 48 assets/images/favicon.svg -o assets/images/favicon.png
echo.
echo 3. Using ImageMagick (if installed):
echo    magick convert -background none -resize 1024x1024 assets/images/icon.svg assets/images/icon.png
echo.
echo After converting, update app.json to reference the PNG files.
pause
