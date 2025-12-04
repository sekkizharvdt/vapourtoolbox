const admin = require('firebase-admin');
const serviceAccount = require('../vapour-toolbox-firebase-adminsdk-fbsvc-b36392ed63.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function getLatestFeedback() {
  const snapshot = await db.collection('feedback').orderBy('createdAt', 'desc').limit(3).get();

  snapshot.forEach((doc) => {
    const data = doc.data();
    console.log('---');
    console.log('ID:', doc.id);
    console.log('Type:', data.type);
    console.log('Title:', data.title);
    console.log('Description:', data.description);
    console.log('Status:', data.status);
    console.log('Page URL:', data.pageUrl);
    console.log('User:', data.userName, '(' + data.userEmail + ')');
    console.log('Created:', data.createdAt?.toDate());
    console.log('Screenshots:', data.screenshotUrls?.length || 0);
  });
}

getLatestFeedback().then(() => process.exit(0));
