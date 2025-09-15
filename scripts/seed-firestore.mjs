// scripts/seed-firestore.mjs
import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';

function loadCredential() {
  // 1) Usa Application Default se a env GOOGLE_APPLICATION_CREDENTIALS estiver setada
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('Usando GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    return admin.credential.applicationDefault();
  }

  // 2) Ou JSON bruto em env (SERVICE_ACCOUNT_JSON)
  if (process.env.SERVICE_ACCOUNT_JSON) {
    console.log('Usando SERVICE_ACCOUNT_JSON (env).');
    const obj = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
    return admin.credential.cert(obj);
  }

  // 3) Fallback: serviceAccountKey.json na raiz
  const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `Não achei credencial Admin. Informe GOOGLE_APPLICATION_CREDENTIALS ou crie ${keyPath}.`
    );
  }
  console.log('Usando credencial local:', keyPath);
  const json = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  return admin.credential.cert(json);
}

admin.initializeApp({
  credential: loadCredential(),
});

const db = admin.firestore();

async function seed() {
  console.log('==> Iniciando seed do Firestore...');

  const batch = db.batch();

  // settings/company
  batch.set(db.doc('settings/company'), {
    name: 'Malta Engenharia',
    logoUrl: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // projects (exemplo para a Home)
  const projRef = db.collection('projects').doc();
  batch.set(projRef, {
    title: 'Projeto Residencial A',
    price: 1500,
    mainImageUrl: '',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
  console.log('✅ Seed concluído com sucesso.');
}

seed().catch((err) => {
  console.error('❌ Falha ao executar seed:', err);
  process.exit(1);
});
