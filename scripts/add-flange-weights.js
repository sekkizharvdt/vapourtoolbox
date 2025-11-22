/**
 * Script to add weight data to flange variants
 * Source: WERMAC Engineering Reference (https://www.wermac.org/flanges/weightchart_asme_b16-5.html)
 * Weights in kg for Carbon Steel ASTM A105
 */

const fs = require('fs');
const path = require('path');

// Weight data by pressure class and NPS
// Format: { nps: { pressureClass: weight_kg } }
const weightData = {
  '1/2': {
    '150#': 0.9,
    '300#': 0.9,
    '400#': 1.4,
    '600#': 1.4,
    '900#': 3.2,
    '1500#': 3.2,
    '2500#': 3.6,
  },
  '3/4': {
    '150#': 0.9,
    '300#': 1.4,
    '400#': 1.6,
    '600#': 1.8,
    '900#': 3.2,
    '1500#': 3.2,
    '2500#': 4.1,
  },
  1: {
    '150#': 1.4,
    '300#': 1.8,
    '400#': 1.8,
    '600#': 1.8,
    '900#': 3.8,
    '1500#': 4.1,
    '2500#': 5.9,
  },
  '1 1/4': {
    '150#': 1.4,
    '300#': 2.3,
    '400#': 2.0,
    '600#': 2.7,
    '900#': 4.5,
    '1500#': 4.5,
    '2500#': 9.0,
  },
  '1 1/2': {
    '150#': 1.8,
    '300#': 3.2,
    '400#': 3.6,
    '600#': 3.6,
    '900#': 6.3,
    '1500#': 6.3,
    '2500#': 12.6,
  },
  2: {
    '150#': 2.7,
    '300#': 4.1,
    '400#': 4.5,
    '600#': 5.4,
    '900#': 10.8,
    '1500#': 11.3,
    '2500#': 18.9,
  },
  '2 1/2': {
    '150#': 4.5,
    '300#': 5.4,
    '400#': 6.3,
    '600#': 8.1,
    '900#': 13.9,
    '1500#': 16.2,
    '2500#': 23.4,
  },
  3: {
    '150#': 5.2,
    '300#': 8.1,
    '400#': 8.1,
    '600#': 10.4,
    '900#': 16.2,
    '1500#': 21.6,
    '2500#': 42.3,
  },
  4: {
    '150#': 7.4,
    '300#': 11.9,
    '400#': 15.8,
    '600#': 18.9,
    '900#': 23.9,
    '1500#': 32.9,
    '2500#': 65.7,
  },
  5: {
    '150#': 9.5,
    '300#': 16.2,
    '400#': 19.4,
    '600#': 30.6,
    '900#': 38.7,
    '1500#': 59.4,
    '2500#': 109.8,
  },
  6: {
    '150#': 11.7,
    '300#': 20.3,
    '400#': 25.7,
    '600#': 36.5,
    '900#': 49.5,
    '1500#': 74.3,
    '2500#': 170.1,
  },
  8: {
    '150#': 18.9,
    '300#': 31.1,
    '400#': 40.1,
    '600#': 54.0,
    '900#': 84.2,
    '1500#': 123.8,
    '2500#': 259.2,
  },
  10: {
    '150#': 24.3,
    '300#': 45.0,
    '400#': 56.3,
    '600#': 85.5,
    '900#': 120.6,
    '1500#': 204.8,
    '2500#': 480.6,
  },
  12: {
    '150#': 39.6,
    '300#': 63.9,
    '400#': 78.8,
    '600#': 101.7,
    '900#': 167.4,
    '1500#': 310.5,
    '2500#': 723.6,
  },
  14: { '150#': 51.3, '300#': 92.7, '400#': 104.9, '600#': 156.2, '900#': 252.9, '1500#': 423.0 },
  16: { '150#': 63.0, '300#': 112.5, '400#': 132.8, '600#': 216.5, '900#': 308.3, '1500#': 562.5 },
  18: { '150#': 74.3, '300#': 144.0, '400#': 162.0, '600#': 249.8, '900#': 415.8, '1500#': 731.3 },
  20: { '150#': 88.7, '300#': 180.0, '400#': 200.3, '600#': 310.5, '900#': 523.8, '1500#': 922.5 },
  24: {
    '150#': 120.6,
    '300#': 261.0,
    '400#': 288.0,
    '600#': 439.7,
    '900#': 948.2,
    '1500#': 1496.0,
  },
};

const filePath = path.join(__dirname, 'seed-data', 'flanges-weld-neck.json');

// Read the file
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Add weight note to metadata
data.metadata.weightNote =
  'Weight data for Carbon Steel (ASTM A105). For Stainless Steel (ASTM A182), multiply by 1.015. Source: WERMAC Engineering Reference.';

// Update each variant with weight data
let updated = 0;
let missing = 0;

data.variants.forEach((variant) => {
  const nps = variant.nps;
  const pressureClass = variant.pressureClass;

  if (weightData[nps] && weightData[nps][pressureClass]) {
    variant.weight_kg = weightData[nps][pressureClass];
    updated++;
  } else {
    console.warn(`Warning: No weight data for NPS ${nps}, Pressure Class ${pressureClass}`);
    missing++;
  }
});

// Write the updated data back
fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');

console.log(`✅ Successfully updated ${updated} flange variants with weight data`);
if (missing > 0) {
  console.log(`⚠️  ${missing} variants are missing weight data`);
}
console.log(`📝 Updated file: ${filePath}`);
