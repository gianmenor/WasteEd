// Simple script to create PWA icon placeholders
// Run this file with: node create-pwa-icons.js

const fs = require('fs');
const path = require('path');

// Create a simple SVG icon
const createSVG = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#16a34a"/>
  <g transform="translate(${size/2}, ${size/2})">
    <text 
      x="0" 
      y="0" 
      font-size="${size * 0.4}" 
      font-family="Arial, sans-serif" 
      font-weight="bold" 
      fill="white" 
      text-anchor="middle" 
      dominant-baseline="middle">
      ♻️
    </text>
  </g>
  <text 
    x="${size/2}" 
    y="${size * 0.85}" 
    font-size="${size * 0.08}" 
    font-family="Arial, sans-serif" 
    font-weight="bold" 
    fill="white" 
    text-anchor="middle">
    WASTE-ED
  </text>
</svg>
`;

// Create icon files
const sizes = [192, 512];
const publicDir = path.join(__dirname, 'public');

sizes.forEach(size => {
  const svg = createSVG(size);
  const filename = `pwa-icon-${size}.svg`;
  fs.writeFileSync(path.join(publicDir, filename), svg);
  console.log(`Created ${filename}`);
});

console.log('\n✅ SVG icons created successfully!');
console.log('\n📝 Note: For better quality, convert these SVG files to PNG using:');
console.log('   - Online tool: https://svgtopng.com/');
console.log('   - Or open generate-icons.html in your browser');
console.log(`   - Or use ImageMagick: convert icon.svg icon.png`);
