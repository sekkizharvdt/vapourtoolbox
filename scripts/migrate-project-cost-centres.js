#!/usr/bin/env node

/**
 * Migration Script: Create Cost Centres for Existing Projects
 *
 * This script creates cost centres for all existing projects that don't have one yet.
 * Run this once after deploying the project Cloud Functions.
 *
 * Usage:
 *   node scripts/migrate-project-cost-centres.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');

if (!require('fs').existsSync(serviceAccountPath)) {
  console.error('❌ Error: firebase-service-account.json not found');
  console.error(
    '   Please download it from Firebase Console > Project Settings > Service Accounts'
  );
  console.error('   Save it as: firebase-service-account.json in the project root');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateProjectCostCentres() {
  console.log('🔍 Starting cost centre migration for existing projects...\n');

  try {
    // Get all projects
    const projectsSnapshot = await db.collection('projects').get();

    if (projectsSnapshot.empty) {
      console.log('ℹ️  No projects found in database');
      return;
    }

    console.log(`📊 Found ${projectsSnapshot.size} projects\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id;
      const projectData = projectDoc.data();

      console.log(`\n📁 Processing project: ${projectData.name} (${projectData.code})`);

      // Check if cost centre already exists
      const existingCostCentres = await db
        .collection('costCentres')
        .where('projectId', '==', projectId)
        .limit(1)
        .get();

      if (!existingCostCentres.empty) {
        console.log(`   ⏭️  Cost centre already exists, skipping`);
        skipped++;
        continue;
      }

      // Create cost centre
      try {
        const costCentreCode = `CC-${projectData.code}`;
        const now = admin.firestore.Timestamp.now();

        const costCentreData = {
          code: costCentreCode,
          name: projectData.name,
          description: `Cost centre auto-created for project: ${projectData.name}`,
          projectId,

          // Budget tracking fields (from project budget if available)
          budgetAmount: projectData.budget?.estimated?.amount || null,
          budgetCurrency: projectData.budget?.currency || 'INR',
          actualSpent: 0,
          variance: null,

          // Status - Use uppercase status values
          isActive: projectData.status === 'ACTIVE' || projectData.status === 'IN_PROGRESS',
          autoCreated: true, // Flag to indicate this was auto-created

          // Timestamps
          createdAt: now,
          updatedAt: now,
          createdBy: 'migration-script',
          updatedBy: 'migration-script',
        };

        await db.collection('costCentres').add(costCentreData);

        console.log(`   ✅ Created cost centre: ${costCentreCode}`);
        console.log(
          `      Status: ${projectData.status} → ${costCentreData.isActive ? 'Active' : 'Inactive'}`
        );
        if (costCentreData.budgetAmount) {
          console.log(
            `      Budget: ${costCentreData.budgetCurrency} ${costCentreData.budgetAmount.toLocaleString()}`
          );
        }

        created++;
      } catch (error) {
        console.error(`   ❌ Error creating cost centre:`, error.message);
        errors++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Cost centres created: ${created}`);
    console.log(`⏭️  Already existing (skipped): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📁 Total projects processed: ${projectsSnapshot.size}`);
    console.log('='.repeat(60));

    if (created > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log(
        '💡 Tip: Future projects will automatically create cost centres via Cloud Functions'
      );
    } else if (skipped > 0) {
      console.log('\n✅ All projects already have cost centres');
    }

    if (errors > 0) {
      console.log('\n⚠️  Some errors occurred. Please review the logs above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateProjectCostCentres()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
