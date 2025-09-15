import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

/**
 * Inicializa o Admin SDK de forma resiliente:
 * - Se GOOGLE_APPLICATION_CREDENTIALS apontar para um arquivo existente, usa-o
 * - Senão, tenta usar functions/sa-admin.json (se existir)
 * - Senão, tenta Application Default Credentials (gcloud/auth local)
 */
function initAdmin() {
  const envKey = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const localKey = path.join(__dirname, "..", "sa-admin.json");

  const chooseKey =
    (envKey && fs.existsSync(envKey) && envKey) ||
    (fs.existsSync(localKey) && localKey) ||
    null;

  if (chooseKey) {
    const serviceAccount = JSON.parse(fs.readFileSync(chooseKey, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    console.log(`Usando credencial de serviço: ${chooseKey}`);
  } else {
    // Tenta ADC (por exemplo, gcloud auth application-default login)
    admin.initializeApp();
    console.log("Usando Application Default Credentials (ADC).");
  }
}

initAdmin();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Uso: npm run set-admin -- <email-do-usuario>");
    process.exit(1);
  }

  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { role: "admin", admin: true });

  console.log("✅ Admin OK para:", email);
  console.log("Peça para o usuário sair e entrar novamente (ou renovar o token) para refletir as claims.");
}

main().catch((e) => {
  console.error("Falha:", e);
  process.exit(1);
});
