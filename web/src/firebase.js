import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyA2QV9Wu_PG6n8IUpy-4J_4j-H2dp33HNw',
  authDomain: 'vertex-ad5da.firebaseapp.com',
  projectId: 'vertex-ad5da',
  storageBucket: 'vertex-ad5da.firebasestorage.app',
  messagingSenderId: '96163960731',
  appId: '1:96163960731:web:3e1fd597ccaa74f7d8733e',
  measurementId: 'G-W6KTMDTMES',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
