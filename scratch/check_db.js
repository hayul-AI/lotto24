import { db } from '../firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

async function checkData() {
  console.log("Checking lottery_stores data...");
  const q = query(collection(db, "lottery_stores"), limit(5));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    console.log("No documents found in lottery_stores");
    return;
  }
  
  snap.docs.forEach(doc => {
    console.log(`ID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}

checkData();
