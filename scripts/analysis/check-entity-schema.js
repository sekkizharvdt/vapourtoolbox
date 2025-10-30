#!/usr/bin/env node

/**
 * Entity Schema Analysis
 *
 * Analyzes all entities in Firestore to check:
 * - Field coverage (which fields exist in which documents)
 * - Schema consistency
 * - Missing required fields
 * - Deprecated fields still in use
 *
 * Run this BEFORE making any query changes to entities collection
 *
 * Usage: node scripts/analysis/check-entity-schema.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: 'vapour-toolbox',
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
    console.log('\n💡 Make sure you are authenticated with Firebase:');
    console.log('   Run: firebase login');
    process.exit(1);
  }
}

const db = admin.firestore();

// Expected schema based on types
const EXPECTED_FIELDS = {
  // Required fields
  required: ['id', 'code', 'name', 'roles', 'status', 'createdAt', 'updatedAt'],

  // Optional but recommended fields
  recommended: ['isDeleted', 'isActive', 'legalName'],

  // Legacy fields (deprecated but may exist)
  legacy: ['contactPerson', 'email', 'phone', 'mobile'],

  // New fields (may not exist in old documents)
  new: ['contacts', 'primaryContactId'],

  // All possible fields
  all: [
    'id', 'code', 'name', 'legalName', 'displayName',
    'roles', 'status', 'isActive', 'isDeleted',
    'contactPerson', 'email', 'phone', 'mobile', 'website',
    'contacts', 'primaryContactId',
    'billingAddress', 'shippingAddress',
    'taxIdentifiers', 'bankDetails',
    'creditTerms', 'paymentTerms',
    'industry', 'category', 'tags', 'notes',
    'assignedToUserId',
    'totalProjects', 'totalTransactions', 'outstandingAmount',
    'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'deletionReason'
  ]
};

async function analyzeEntitySchema() {
  console.log('🔍 Analyzing Entity Schema...\n');
  console.log('═'.repeat(70));

  try {
    // Get all entities
    const snapshot = await db.collection('entities').get();

    if (snapshot.empty) {
      console.log('\n⚠️  No entities found in the database.\n');
      return;
    }

    console.log(`\n📊 Analyzing ${snapshot.size} entities...\n`);

    // Track field coverage
    const fieldCoverage = {};
    const fieldExamples = {};
    const issues = [];

    // Analyze each entity
    snapshot.forEach(doc => {
      const data = doc.data();
      const entityId = doc.id;

      // Check each expected field
      EXPECTED_FIELDS.all.forEach(field => {
        if (!fieldCoverage[field]) {
          fieldCoverage[field] = { count: 0, percentage: 0, examples: [] };
        }

        if (field in data && data[field] !== null && data[field] !== undefined) {
          fieldCoverage[field].count++;

          // Store first example
          if (fieldCoverage[field].examples.length < 3) {
            fieldCoverage[field].examples.push({
              entityId,
              value: data[field]
            });
          }
        }
      });

      // Check for required fields
      EXPECTED_FIELDS.required.forEach(field => {
        if (!(field in data) || data[field] === null || data[field] === undefined) {
          issues.push({
            type: 'MISSING_REQUIRED',
            entityId,
            entityName: data.name || 'Unknown',
            field,
            severity: 'HIGH'
          });
        }
      });

      // Check for recommended fields
      EXPECTED_FIELDS.recommended.forEach(field => {
        if (!(field in data)) {
          issues.push({
            type: 'MISSING_RECOMMENDED',
            entityId,
            entityName: data.name || 'Unknown',
            field,
            severity: 'MEDIUM'
          });
        }
      });
    });

    // Calculate percentages
    Object.keys(fieldCoverage).forEach(field => {
      fieldCoverage[field].percentage = (fieldCoverage[field].count / snapshot.size * 100).toFixed(1);
    });

    // Print Field Coverage Report
    console.log('📈 FIELD COVERAGE REPORT');
    console.log('═'.repeat(70));
    console.log();

    // Group by category
    const categories = [
      { name: 'Required Fields', fields: EXPECTED_FIELDS.required, minCoverage: 100 },
      { name: 'Recommended Fields', fields: EXPECTED_FIELDS.recommended, minCoverage: 80 },
      { name: 'New Fields', fields: EXPECTED_FIELDS.new, minCoverage: 0 },
      { name: 'Legacy Fields', fields: EXPECTED_FIELDS.legacy, minCoverage: 0 },
    ];

    categories.forEach(({ name, fields, minCoverage }) => {
      console.log(`\n${name}:`);
      console.log('-'.repeat(70));

      fields.forEach(field => {
        const coverage = fieldCoverage[field] || { count: 0, percentage: 0 };
        const status = coverage.percentage >= minCoverage ? '✅' : '⚠️ ';
        const bar = '█'.repeat(Math.floor(coverage.percentage / 5));

        console.log(`${status} ${field.padEnd(25)} ${bar.padEnd(20)} ${coverage.percentage}% (${coverage.count}/${snapshot.size})`);
      });
    });

    // Print Issues Report
    if (issues.length > 0) {
      console.log('\n\n⚠️  ISSUES FOUND');
      console.log('═'.repeat(70));

      // Group by severity
      const highSeverity = issues.filter(i => i.severity === 'HIGH');
      const mediumSeverity = issues.filter(i => i.severity === 'MEDIUM');

      if (highSeverity.length > 0) {
        console.log('\n🔴 HIGH SEVERITY (Missing Required Fields):');
        console.log('-'.repeat(70));

        // Group by field
        const byField = {};
        highSeverity.forEach(issue => {
          if (!byField[issue.field]) byField[issue.field] = [];
          byField[issue.field].push(issue);
        });

        Object.entries(byField).forEach(([field, fieldIssues]) => {
          console.log(`\n  Field: "${field}" - Missing in ${fieldIssues.length} entities:`);
          fieldIssues.slice(0, 5).forEach(issue => {
            console.log(`    - ${issue.entityName} (${issue.entityId})`);
          });
          if (fieldIssues.length > 5) {
            console.log(`    ... and ${fieldIssues.length - 5} more`);
          }
        });
      }

      if (mediumSeverity.length > 0) {
        console.log('\n\n🟡 MEDIUM SEVERITY (Missing Recommended Fields):');
        console.log('-'.repeat(70));

        // Group by field
        const byField = {};
        mediumSeverity.forEach(issue => {
          if (!byField[issue.field]) byField[issue.field] = [];
          byField[issue.field].push(issue);
        });

        Object.entries(byField).forEach(([field, fieldIssues]) => {
          console.log(`  Field: "${field}" - Missing in ${fieldIssues.length} entities`);
        });
      }
    }

    // Print Recommendations
    console.log('\n\n💡 RECOMMENDATIONS');
    console.log('═'.repeat(70));

    const recommendations = [];

    // Check isDeleted coverage
    const isDeletedCoverage = fieldCoverage.isDeleted?.percentage || 0;
    if (isDeletedCoverage < 100) {
      recommendations.push({
        priority: 'HIGH',
        message: `Only ${isDeletedCoverage}% of entities have 'isDeleted' field`,
        action: 'Run migration: scripts/migrations/add-isDeleted-to-entities.js',
        impact: 'Queries with where("isDeleted", "==", false) will exclude entities without this field'
      });
    }

    // Check contacts array coverage
    const contactsCoverage = fieldCoverage.contacts?.percentage || 0;
    const hasLegacyContacts = (fieldCoverage.contactPerson?.percentage || 0) > 0;
    if (contactsCoverage < 100 && hasLegacyContacts) {
      recommendations.push({
        priority: 'MEDIUM',
        message: `${contactsCoverage}% have new contacts array, ${fieldCoverage.contactPerson?.percentage}% have legacy contact fields`,
        action: 'Consider migrating legacy contact fields to contacts array',
        impact: 'UI components need to support both contact structures'
      });
    }

    // Print recommendations
    if (recommendations.length > 0) {
      recommendations.forEach((rec, index) => {
        console.log(`\n${index + 1}. [${rec.priority}] ${rec.message}`);
        console.log(`   Action: ${rec.action}`);
        console.log(`   Impact: ${rec.impact}`);
      });
    } else {
      console.log('\n✅ No recommendations - schema looks consistent!');
    }

    // Print Summary
    console.log('\n\n📋 SUMMARY');
    console.log('═'.repeat(70));
    console.log(`Total Entities: ${snapshot.size}`);
    console.log(`High Severity Issues: ${issues.filter(i => i.severity === 'HIGH').length}`);
    console.log(`Medium Severity Issues: ${issues.filter(i => i.severity === 'MEDIUM').length}`);
    console.log(`Recommendations: ${recommendations.length}`);
    console.log();

    // Exit code based on severity
    if (issues.filter(i => i.severity === 'HIGH').length > 0) {
      console.log('⚠️  High severity issues found - review before making query changes!\n');
      process.exit(1);
    } else {
      console.log('✅ Schema analysis complete\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run analysis
analyzeEntitySchema();
