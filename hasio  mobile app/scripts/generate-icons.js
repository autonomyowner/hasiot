/**
 * Icon Generator Script for Hasio App
 *
 * Run this script to generate app icons:
 * node scripts/generate-icons.js
 *
 * Requires: npm install canvas
 */

const fs = require('fs');
const path = require('path');

// Check if canvas is available
let createCanvas;
try {
  createCanvas = require('canvas').createCanvas;
} catch (e) {
  console.log('Canvas not installed. Creating placeholder SVG icons instead.');
  console.log('To generate PNG icons, run: npm install canvas');
  console.log('');
  createPlaceholderSVGs();
  process.exit(0);
}

const COLORS = {
  primary: '#0D7A5F',
  background: '#FAF7F2',
  text: '#FFFFFF',
};

function generateIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background - rounded rectangle effect with gradient
  ctx.fillStyle = COLORS.primary;
  ctx.fillRect(0, 0, size, size);

  // Add subtle gradient overlay
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Draw "H" letter for Hasio
  ctx.fillStyle = COLORS.text;
  ctx.font = `bold ${size * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', size / 2, size / 2);

  // Save to file
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(__dirname, '..', 'assets', 'images', filename);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${filename} (${size}x${size})`);
}

function generateSplashIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Transparent background for splash
  ctx.clearRect(0, 0, size, size);

  // Draw centered logo
  const logoSize = size * 0.4;
  const x = (size - logoSize) / 2;
  const y = (size - logoSize) / 2;

  // Logo background circle
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, logoSize / 2, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.primary;
  ctx.fill();

  // Draw "H" letter
  ctx.fillStyle = COLORS.text;
  ctx.font = `bold ${logoSize * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', size / 2, size / 2);

  // Save to file
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(__dirname, '..', 'assets', 'images', filename);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${filename} (${size}x${size})`);
}

function createPlaceholderSVGs() {
  const svgIcon = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#0D7A5F"/>
  <text x="512" y="512" font-family="Arial, sans-serif" font-size="512" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">H</text>
</svg>`;

  const svgSplash = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <circle cx="512" cy="512" r="300" fill="#0D7A5F"/>
  <text x="512" y="512" font-family="Arial, sans-serif" font-size="300" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">H</text>
</svg>`;

  const outputDir = path.join(__dirname, '..', 'assets', 'images');

  fs.writeFileSync(path.join(outputDir, 'icon.svg'), svgIcon);
  fs.writeFileSync(path.join(outputDir, 'splash-icon.svg'), svgSplash);
  fs.writeFileSync(path.join(outputDir, 'adaptive-icon.svg'), svgIcon);

  console.log('Created SVG placeholders in assets/images/');
  console.log('Convert these to PNG using an online tool or install canvas:');
  console.log('  npm install canvas && node scripts/generate-icons.js');
}

// Ensure output directory exists
const imagesDir = path.join(__dirname, '..', 'assets', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Generate icons
console.log('Generating Hasio app icons...\n');

generateIcon(1024, 'icon.png');
generateIcon(1024, 'adaptive-icon.png');
generateSplashIcon(1024, 'splash-icon.png');
generateIcon(48, 'favicon.png');

console.log('\nAll icons generated successfully!');
