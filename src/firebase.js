import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Configuração do projeto Firebase "SistemaPontoFatec".
// A apiKey web não é um segredo: quem protege os dados são as regras do Realtime Database.
const firebaseConfig = {
  apiKey: 'AIzaSyBLNwkAqiT3nBjlNpfLop-Ju29wuXZmK1A',
  authDomain: 'sistemapontofatec.firebaseapp.com',
  databaseURL: 'https://sistemapontofatec-default-rtdb.firebaseio.com',
  projectId: 'sistemapontofatec',
  storageBucket: 'sistemapontofatec.firebasestorage.app',
  messagingSenderId: '869317538025',
  appId: '1:869317538025:web:41cb0eddab4bbf9554c078'
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
