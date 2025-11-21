'use client';

import { useState, useEffect } from 'react';
import { Firestore } from 'firebase/firestore';
import { FirebaseStorage } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase';

export function useFirestore() {
  const [db, setDb] = useState<Firestore | null>(null);

  useEffect(() => {
    const { db } = getFirebase();
    setDb(db);
  }, []);

  return db;
}

export function useStorage() {
  const [storage, setStorage] = useState<FirebaseStorage | null>(null);

  useEffect(() => {
    const { storage } = getFirebase();
    setStorage(storage);
  }, []);

  return storage;
}
