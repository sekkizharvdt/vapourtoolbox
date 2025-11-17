/**
 * Seed Plate Materials Script
 *
 * Creates demo plate materials with realistic specifications and variants
 * Run with: pnpm tsx scripts/seed-plate-materials.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { MaterialCategory } from '@vapour/types';
import { createMaterial } from '../apps/web/src/lib/materials/materialService';

// Firebase configuration from environment
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Demo materials data
const DEMO_MATERIALS = [
  // Carbon Steel Plates
  {
    name: 'Carbon Steel A36 Structural Plate',
    description:
      'ASTM A36 is a standard specification for carbon structural steel used in general construction and industrial applications. Widely available and cost-effective.',
    category: MaterialCategory.PLATES_CARBON_STEEL,
    specification: {
      standard: 'ASTM A36',
      grade: 'A36',
      form: 'Plate',
    },
    properties: {
      density: 7850,
      densityUnit: 'kg/m3' as const,
      tensileStrength: 400,
      yieldStrength: 250,
      elongation: 20,
      maxOperatingTemp: 425,
    },
    baseUnit: 'kg',
    tags: ['carbon-steel', 'structural', 'ASTM-A36'],
    isStandard: true,
  },
  {
    name: 'Carbon Steel A516 Grade 70 Pressure Vessel Plate',
    description:
      'ASTM A516 Grade 70 is a carbon steel plate for moderate and lower temperature pressure vessel applications. Offers excellent weldability and notch toughness.',
    category: MaterialCategory.PLATES_CARBON_STEEL,
    specification: {
      standard: 'ASTM A516',
      grade: 'Grade 70',
      form: 'Plate',
    },
    properties: {
      density: 7850,
      densityUnit: 'kg/m3' as const,
      tensileStrength: 485,
      yieldStrength: 260,
      elongation: 21,
      maxOperatingTemp: 425,
    },
    baseUnit: 'kg',
    tags: ['carbon-steel', 'pressure-vessel', 'ASTM-A516'],
    isStandard: true,
  },

  // Stainless Steel Plates
  {
    name: 'Stainless Steel 304 Plate',
    description:
      'ASTM A240 Grade 304 is the most widely used austenitic stainless steel. Excellent corrosion resistance, formability, and weldability. Suitable for food processing, chemical, and general industrial applications.',
    category: MaterialCategory.PLATES_STAINLESS_STEEL,
    specification: {
      standard: 'ASTM A240',
      grade: '304',
      form: 'Plate',
    },
    properties: {
      density: 8000,
      densityUnit: 'kg/m3' as const,
      tensileStrength: 515,
      yieldStrength: 205,
      elongation: 40,
      maxOperatingTemp: 870,
    },
    baseUnit: 'kg',
    tags: ['stainless-steel', '304', 'austenitic', 'ASTM-A240'],
    isStandard: true,
  },
  {
    name: 'Stainless Steel 316L Plate',
    description:
      'ASTM A240 Grade 316L is a low-carbon austenitic stainless steel with molybdenum addition for superior corrosion resistance, especially against chlorides and marine environments. Widely used in pharmaceutical, chemical, and marine applications.',
    category: MaterialCategory.PLATES_STAINLESS_STEEL,
    specification: {
      standard: 'ASTM A240',
      grade: '316L',
      form: 'Plate',
    },
    properties: {
      density: 8000,
      densityUnit: 'kg/m3' as const,
      tensileStrength: 485,
      yieldStrength: 170,
      elongation: 40,
      maxOperatingTemp: 870,
    },
    baseUnit: 'kg',
    tags: ['stainless-steel', '316L', 'austenitic', 'low-carbon', 'ASTM-A240'],
    isStandard: true,
  },
  {
    name: 'Stainless Steel 321 Plate',
    description:
      'ASTM A240 Grade 321 is a titanium-stabilized austenitic stainless steel with excellent high-temperature strength and resistance to intergranular corrosion. Ideal for elevated temperature applications in petrochemical and aerospace industries.',
    category: MaterialCategory.PLATES_STAINLESS_STEEL,
    specification: {
      standard: 'ASTM A240',
      grade: '321',
      form: 'Plate',
    },
    properties: {
      density: 8000,
      densityUnit: 'kg/m3' as const,
      tensileStrength: 515,
      yieldStrength: 205,
      elongation: 40,
      maxOperatingTemp: 900,
    },
    baseUnit: 'kg',
    tags: ['stainless-steel', '321', 'austenitic', 'stabilized', 'ASTM-A240'],
    isStandard: true,
  },

  // Duplex Steel Plates
  {
    name: 'Duplex Stainless Steel 2205 Plate',
    description:
      'ASTM A240 UNS S31803 (2205) is a duplex stainless steel with excellent strength and corrosion resistance. Offers approximately twice the yield strength of austenitic grades while maintaining good toughness, fatigue strength, and resistance to stress corrosion cracking.',
    category: MaterialCategory.PLATES_DUPLEX_STEEL,
    specification: {
      standard: 'ASTM A240',
      grade: '2205',
      form: 'Plate',
    },
    properties: {
      density: 7800,
      densityUnit: 'kg/m3' as const,
      tensileStrength: 620,
      yieldStrength: 450,
      elongation: 25,
      maxOperatingTemp: 315,
    },
    baseUnit: 'kg',
    tags: ['duplex-steel', '2205', 'S31803', 'ASTM-A240'],
    isStandard: true,
  },
  {
    name: 'Super Duplex Stainless Steel 2507 Plate',
    description:
      'ASTM A240 UNS S32750 (2507) is a super duplex stainless steel with superior corrosion resistance, particularly to chloride pitting and crevice corrosion. Higher alloying content provides enhanced strength and PREN value. Used in severe offshore and chemical processing environments.',
    category: MaterialCategory.PLATES_DUPLEX_STEEL,
    specification: {
      standard: 'ASTM A240',
      grade: '2507',
      form: 'Plate',
    },
    properties: {
      density: 7800,
      densityUnit: 'kg/m3' as const,
      tensileStrength: 750,
      yieldStrength: 550,
      elongation: 15,
      maxOperatingTemp: 250,
    },
    baseUnit: 'kg',
    tags: ['duplex-steel', '2507', 'super-duplex', 'S32750', 'ASTM-A240'],
    isStandard: true,
  },

  // Alloy Steel Plates
  {
    name: 'Alloy Steel A387 Grade 11 Class 2 Plate',
    description:
      'ASTM A387 Grade 11 Class 2 is a chromium-molybdenum alloy steel plate designed for elevated temperature service in welded pressure vessels. Excellent creep strength and oxidation resistance up to 593°C. Commonly used in petroleum refining and petrochemical applications.',
    category: MaterialCategory.PLATES_ALLOY_STEEL,
    specification: {
      standard: 'ASTM A387',
      grade: 'Grade 11 Class 2',
      form: 'Plate',
    },
    properties: {
      density: 7850,
      densityUnit: 'kg/m3' as const,
      tensileStrength: 515,
      yieldStrength: 310,
      elongation: 18,
      maxOperatingTemp: 593,
    },
    baseUnit: 'kg',
    tags: ['alloy-steel', 'A387', 'Gr11', 'Cr-Mo', 'pressure-vessel'],
    isStandard: true,
  },
];

async function seedPlateMaterials() {
  try {
    console.log('🚀 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log(`\n📦 Creating ${DEMO_MATERIALS.length} demo plate materials...\n`);

    let createdCount = 0;

    for (const materialData of DEMO_MATERIALS) {
      try {
        const created = await createMaterial(
          db,
          {
            ...materialData,
            materialCode: '', // Will be auto-generated
            materialType: 'RAW_MATERIAL',
            hasVariants: false, // Can add variants later
            preferredVendors: [],
            priceHistory: [],
            certifications: [],
            trackInventory: false,
            isActive: true,
          },
          'system-seed'
        );

        createdCount++;
        console.log(
          `  ✓ Created ${createdCount}/${DEMO_MATERIALS.length}: ${created.materialCode} - ${created.name}`
        );
      } catch (error) {
        console.error(`  ✗ Failed to create ${materialData.name}:`, error);
      }
    }

    console.log(`\n✅ Successfully created ${createdCount}/${DEMO_MATERIALS.length} materials!`);
    console.log('\n📊 Summary:');
    console.log(`   - Carbon Steel: 2 materials`);
    console.log(`   - Stainless Steel: 3 materials`);
    console.log(`   - Duplex Steel: 2 materials`);
    console.log(`   - Alloy Steel: 1 material`);
  } catch (error) {
    console.error('❌ Error seeding materials:', error);
    throw error;
  }
}

// Run the script
seedPlateMaterials()
  .then(() => {
    console.log('\n🎉 Plate materials seeded successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to seed materials:', error);
    process.exit(1);
  });
