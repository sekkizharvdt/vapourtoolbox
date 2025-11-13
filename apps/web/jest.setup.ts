// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Make React available globally for JSX in tests (fixes ts-jest issue with 'use client' files)
import React from 'react';
global.React = React;

// Add global fetch polyfill (required by Firebase Auth)
global.fetch = jest.fn();
global.Request = jest.fn() as never;
global.Response = jest.fn() as never;
global.Headers = jest.fn() as never;

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock environment variables
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '123456789';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:123456789:web:abc123';
process.env.NEXT_PUBLIC_USE_EMULATOR = 'false';

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn((_auth, callback) => {
    callback(null);
    return jest.fn(); // unsubscribe
  }),
  signOut: jest.fn(() => Promise.resolve()),
  signInWithPopup: jest.fn(() => Promise.resolve({ user: null })),
  GoogleAuthProvider: jest.fn(),
}));

// Mock Firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  addDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(() => Promise.resolve()),
  })),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 })),
  },
}));

// Mock Firebase Storage
jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));
