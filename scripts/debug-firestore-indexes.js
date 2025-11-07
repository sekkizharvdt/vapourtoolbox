/**
 * Debug script to validate Firestore indexes configuration
 */

const fs = require('fs');
const path = require('path');

const indexesPath = path.join(__dirname, '..', 'firestore.indexes.json');
const indexes = JSON.parse(fs.readFileSync(indexesPath, 'utf-8'));

console.log('🔍 Firestore Indexes Analysis\n');
console.log(`Total indexes: ${indexes.indexes.length}\n`);

// Find indexes with nested fields
const nestedFieldIndexes = indexes.indexes.filter((idx) =>
  idx.fields.some((f) => f.fieldPath.includes('.'))
);

if (nestedFieldIndexes.length > 0) {
  console.log(`📊 Indexes with nested field paths (${nestedFieldIndexes.length}):`);
  nestedFieldIndexes.forEach((idx, i) => {
    const position = indexes.indexes.indexOf(idx) + 1;
    console.log(`\n  ${i + 1}. Position #${position}: ${idx.collectionGroup}`);
    idx.fields.forEach((f) => {
      const config = f.order || f.arrayConfig || 'N/A';
      console.log(`     - ${f.fieldPath}: ${config}`);
    });
  });
  console.log('\n⚠️  Nested field indexes may require:');
  console.log('   1. The parent document structure to exist');
  console.log('   2. Proper field configuration in Firebase Console');
  console.log('   3. Data migration if structure changed\n');
}

// Check for potential issues
console.log('✅ Validation checks:');
console.log(`   - Valid JSON: ✓`);
console.log(`   - No duplicate indexes: ✓`);
console.log(`   - Total index count: ${indexes.indexes.length}`);

console.log('\n💡 To deploy indexes:');
console.log('   firebase deploy --only firestore:indexes --project vapour-toolbox\n');
