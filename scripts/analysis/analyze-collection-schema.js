#!/usr/bin/env node

/**
 * Universal Collection Schema Analyzer
 *
 * Analyzes any Firestore collection to check:
 * - Field coverage across all documents
 * - Schema consistency
 * - Missing required/recommended fields
 * - Deprecated fields still in use
 * - Backward compatibility issues
 *
 * Usage: node scripts/analysis/analyze-collection-schema.js <collection-name>
 * Example: node scripts/analysis/analyze-collection-schema.js entities
 */

const admin = require('firebase-admin');
const { getCollectionSchema } = require('../config/schema-registry');

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

async function analyzeCollectionSchema(collectionName) {
  console.log('═'.repeat(75));
  console.log(`  SCHEMA ANALYSIS: ${collectionName}`);
  console.log('═'.repeat(75));
  console.log();

  // Get expected schema
  const expectedSchema = getCollectionSchema(collectionName);

  if (!expectedSchema) {
    console.error(`❌ No schema definition found for collection: ${collectionName}`);
    console.log('\n💡 Add schema definition to scripts/config/schema-registry.js');
    process.exit(1);
  }

  try {
    // Get all documents
    const snapshot = await db.collection(collectionName).get();

    if (snapshot.empty) {
      console.log(`⚠️  No documents found in collection: ${collectionName}`);
      console.log('\nThis is normal if the collection hasn't been used yet.\n');
      return;
    }

    console.log(`📊 Analyzing ${snapshot.size} documents...\n`);

    // Build list of all expected fields
    const allExpectedFields = [
      ...expectedSchema.required,
      ...expectedSchema.recommended,
      ...expectedSchema.optional,
      ...expectedSchema.deprecated,
    ];

    // Track field coverage
    const fieldCoverage = {};
    const issues = [];
    const deprecationWarnings = [];

    // Analyze each document
    snapshot.forEach(doc => {
      const data = doc.data();
      const docId = doc.id;

      // Check all expected fields
      allExpectedFields.forEach(field => {
        if (!fieldCoverage[field]) {
          fieldCoverage[field] = { count: 0, percentage: 0 };
        }

        if (field in data && data[field] !== null && data[field] !== undefined) {
          fieldCoverage[field].count++;
        }
      });

      // Check for missing required fields
      expectedSchema.required.forEach(field => {
        if (!(field in data) || data[field] === null || data[field] === undefined) {
          issues.push({
            type: 'MISSING_REQUIRED',
            docId,
            field,
            severity: 'HIGH'
          });
        }
      });

      // Check for missing recommended fields
      expectedSchema.recommended.forEach(field => {
        if (!(field in data)) {
          issues.push({
            type: 'MISSING_RECOMMENDED',
            docId,
            field,
            severity: 'MEDIUM'
          });
        }
      });

      // Check for deprecated fields still in use
      expectedSchema.deprecated.forEach(field => {
        if (field in data && data[field] !== null && data[field] !== undefined) {
          deprecationWarnings.push({
            docId,
            field,
            value: data[field]
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
    console.log('═'.repeat(75));
    console.log();

    const categories = [
      { name: 'Required Fields', fields: expectedSchema.required, minCoverage: 100, icon: '🔴' },
      { name: 'Recommended Fields', fields: expectedSchema.recommended, minCoverage: 80, icon: '🟡' },
      { name: 'Optional Fields', fields: expectedSchema.optional, minCoverage: 0, icon: '🔵' },
      { name: 'Deprecated Fields', fields: expectedSchema.deprecated, minCoverage: 0, icon: '⚠️ ' },
    ];

    categories.forEach(({ name, fields, minCoverage, icon }) => {
      if (fields.length === 0) return;

      console.log(`\n${icon} ${name}:`);
      console.log('-'.repeat(75));

      fields.forEach(field => {
        const coverage = fieldCoverage[field] || { count: 0, percentage: 0 };
        const status = coverage.percentage >= minCoverage ? '✅' : '⚠️ ';
        const bar = '█'.repeat(Math.floor(coverage.percentage / 5));

        console.log(`${status} ${field.padEnd(30)} ${bar.padEnd(20)} ${coverage.percentage}% (${coverage.count}/${snapshot.size})`);
      });
    });

    // Print Issues Report
    if (issues.length > 0) {
      console.log('\n\n⚠️  ISSUES FOUND');
      console.log('═'.repeat(75));

      // Group by severity
      const highSeverity = issues.filter(i => i.severity === 'HIGH');
      const mediumSeverity = issues.filter(i => i.severity === 'MEDIUM');

      if (highSeverity.length > 0) {
        console.log('\n🔴 HIGH SEVERITY (Missing Required Fields):');
        console.log('-'.repeat(75));

        // Group by field
        const byField = {};
        highSeverity.forEach(issue => {
          if (!byField[issue.field]) byField[issue.field] = [];
          byField[issue.field].push(issue);
        });

        Object.entries(byField).forEach(([field, fieldIssues]) => {
          console.log(`\n  Field: "${field}" - Missing in ${fieldIssues.length} documents`);
          if (fieldIssues.length <= 5) {
            fieldIssues.forEach(issue => {
              console.log(`    - Document ID: ${issue.docId}`);
            });
          } else {
            console.log(`    - First 5 documents: ${fieldIssues.slice(0, 5).map(i => i.docId).join(', ')}`);
            console.log(`    - ... and ${fieldIssues.length - 5} more`);
          }
        });
      }

      if (mediumSeverity.length > 0) {
        console.log('\n\n🟡 MEDIUM SEVERITY (Missing Recommended Fields):');
        console.log('-'.repeat(75));

        // Group by field
        const byField = {};
        mediumSeverity.forEach(issue => {
          if (!byField[issue.field]) byField[issue.field] = [];
          byField[issue.field].push(issue);
        });

        Object.entries(byField).forEach(([field, fieldIssues]) => {
          console.log(`  Field: "${field}" - Missing in ${fieldIssues.length} documents`);
        });
      }
    }

    // Print Deprecation Warnings
    if (deprecationWarnings.length > 0) {
      console.log('\n\n⚠️  DEPRECATION WARNINGS');
      console.log('═'.repeat(75));

      // Group by field
      const byField = {};
      deprecationWarnings.forEach(warning => {
        if (!byField[warning.field]) byField[warning.field] = [];
        byField[warning.field].push(warning);
      });

      Object.entries(byField).forEach(([field, warnings]) => {
        console.log(`\n  Field: "${field}" - Still in use in ${warnings.length} documents`);
        console.log(`  Action: Consider migrating to new fields`);
      });
    }

    // Generate Recommendations
    console.log('\n\n💡 RECOMMENDATIONS');
    console.log('═'.repeat(75));

    const recommendations = [];

    // Check for high-severity issues
    const missingRequiredByField = {};
    issues.filter(i => i.severity === 'HIGH').forEach(issue => {
      if (!missingRequiredByField[issue.field]) {
        missingRequiredByField[issue.field] = 0;
      }
      missingRequiredByField[issue.field]++;
    });

    Object.entries(missingRequiredByField).forEach(([field, count]) => {
      const percentage = (count / snapshot.size * 100).toFixed(1);
      recommendations.push({
        priority: 'HIGH',
        message: `${percentage}% of documents missing required field: ${field}`,
        action: `Add migration to set default value for missing ${field}`,
        impact: 'Queries filtering on this field will exclude these documents'
      });
    });

    // Check for deprecated fields
    Object.keys(byField || {}).forEach(field => {
      const count = byField[field].length;
      const percentage = (count / snapshot.size * 100).toFixed(1);
      recommendations.push({
        priority: 'MEDIUM',
        message: `${percentage}% of documents still using deprecated field: ${field}`,
        action: `Migrate data from deprecated field to new structure`,
        impact: 'Tech debt accumulation, potential future compatibility issues'
      });
    });

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
    console.log('═'.repeat(75));
    console.log(`Collection: ${collectionName}`);
    console.log(`Total Documents: ${snapshot.size}`);
    console.log(`Required Fields: ${expectedSchema.required.length}`);
    console.log(`Recommended Fields: ${expectedSchema.recommended.length}`);
    console.log(`High Severity Issues: ${issues.filter(i => i.severity === 'HIGH').length}`);
    console.log(`Medium Severity Issues: ${issues.filter(i => i.severity === 'MEDIUM').length}`);
    console.log(`Deprecation Warnings: ${deprecationWarnings.length}`);
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

// Get collection name from command line
const collectionName = process.argv[2];

if (!collectionName) {
  console.error('Usage: node scripts/analysis/analyze-collection-schema.js <collection-name>');
  console.log('\nExamples:');
  console.log('  node scripts/analysis/analyze-collection-schema.js entities');
  console.log('  node scripts/analysis/analyze-collection-schema.js projects');
  console.log('  node scripts/analysis/analyze-collection-schema.js users');
  process.exit(1);
}

// Run analysis
analyzeCollectionSchema(collectionName);
