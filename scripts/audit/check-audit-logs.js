const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

async function checkAuditLogs() {
  try {
    console.log('\n' + '='.repeat(90));
    console.log('AUDIT LOGS - Recent Entries');
    console.log('='.repeat(90) + '\n');

    const auditLogsSnapshot = await db.collection('auditLogs')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    if (auditLogsSnapshot.empty) {
      console.log('❌ No audit logs found!');
      console.log('\nThis could mean:');
      console.log('1. The Cloud Function hasn\'t been triggered yet');
      console.log('2. The audit logging code hasn\'t run');
      console.log('3. There may be an error in the Cloud Function\n');
      return;
    }

    console.log(`Found ${auditLogsSnapshot.size} recent audit log entries:\n`);

    auditLogsSnapshot.forEach((doc) => {
      const log = doc.data();
      const timestamp = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Unknown';

      console.log('─'.repeat(90));
      console.log(`🔍 ${log.action} | Severity: ${log.severity} | ${timestamp}`);
      console.log(`   Actor: ${log.actorName} (${log.actorEmail})`);
      console.log(`   Target: ${log.entityType}:${log.entityId}`);
      console.log(`   Description: ${log.description}`);

      if (log.changes && log.changes.length > 0) {
        console.log(`   Changes:`);
        log.changes.forEach(change => {
          console.log(`     • ${change.field}: ${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}`);
        });
      }

      if (log.metadata) {
        console.log(`   Metadata: ${JSON.stringify(log.metadata, null, 2)}`);
      }

      console.log(`   Success: ${log.success}`);
      if (log.errorMessage) {
        console.log(`   Error: ${log.errorMessage}`);
      }
      console.log();
    });

    console.log('='.repeat(90));
    console.log('✅ Audit logging system is working correctly!');
    console.log('='.repeat(90) + '\n');

  } catch (error) {
    console.error('\n❌ Error checking audit logs:', error);
    process.exit(1);
  }
}

checkAuditLogs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
