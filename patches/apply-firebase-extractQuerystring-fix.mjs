// patches/apply-firebase-extractQuerystring-fix.mjs
import fs from "node:fs";
import path from "node:path";

const targets = [
  "node_modules/@firebase/util/dist/index.esm.js",
  "node_modules/@firebase/util/dist/index.cjs.js",
];

// faz uma correção "cirúrgica" apenas dentro do corpo da função,
// mantendo a assinatura original e qualquer ; ou , depois da função
function patchFile(file) {
  const abs = path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    console.log(`[skip] arquivo não existe: ${file}`);
    return false;
  }

  let src = fs.readFileSync(abs, "utf8");

  // encontre a função (declaração ou atribuição)
  let anchor =
    src.indexOf("function extractQuerystring(") !== -1
      ? src.indexOf("function extractQuerystring(")
      : src.indexOf("extractQuerystring = function");

  if (anchor === -1) {
    console.log(`[skip] não encontrei a função em: ${file}`);
    return false;
  }

  // encontra a primeira chave { após o anchor
  const openIdx = src.indexOf("{", anchor);
  if (openIdx === -1) {
    console.log(`[skip] não achei o corpo da função em: ${file}`);
    return false;
  }

  // varre contando chaves para achar o fechamento correto }
  let depth = 0;
  let closeIdx = -1;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        closeIdx = i; // posição do "}" que fecha a função
        break;
      }
    }
  }
  if (closeIdx === -1) {
    console.log(`[skip] não consegui fechar a função em: ${file}`);
    return false;
  }

  const before = src.slice(0, openIdx + 1);
  const body = src.slice(openIdx + 1, closeIdx);
  const after = src.slice(closeIdx); // inclui o "}" e o que vier depois (;, , etc.)

  // já está corrigido?
  if (body.includes("queryStart === -1") && body.includes("url.slice(")) {
    console.log(`[info] já estava corrigido: ${file}`);
    return false;
  }

  // corrige apenas as linhas problemáticas dentro do corpo
  let newBody = body;

  // 1) if (!queryStart) { return ""; }  ->  if (queryStart === -1) { return ""; }
  newBody = newBody.replace(
    /if\s*\(\s*!\s*queryStart\s*\)\s*\{\s*return\s*"";\s*\}/,
    'if (queryStart === -1) { return ""; }'
  );

  // 2) substring(..., fragmentStart > 0 ? fragmentStart : void 0/undefined)
  //    -> slice(..., fragmentStart === -1 ? undefined : fragmentStart)
  newBody = newBody.replace(
    /url\.substring\(\s*queryStart\s*,\s*fragmentStart\s*>\s*0\s*\?\s*fragmentStart\s*:\s*(?:void\s*0|undefined)\s*\)/,
    "url.slice(queryStart, fragmentStart === -1 ? undefined : fragmentStart)"
  );

  // também aceita casos já com slice mas condicional antiga (raro)
  newBody = newBody.replace(
    /url\.slice\(\s*queryStart\s*,\s*fragmentStart\s*>\s*0\s*\?\s*fragmentStart\s*:\s*(?:void\s*0|undefined)\s*\)/,
    "url.slice(queryStart, fragmentStart === -1 ? undefined : fragmentStart)"
  );

  const changed = newBody !== body;
  if (!changed) {
    console.log(`[skip] função encontrada, mas padrão não bateu em: ${file}`);
    return false;
  }

  const out = before + newBody + after;
  fs.writeFileSync(abs, out, "utf8");
  console.log(`[ok] patch aplicado com sucesso: ${file}`);
  return true;
}

let any = false;
for (const t of targets) {
  any = patchFile(t) || any;
}
if (!any) {
  console.log("[info] nenhum arquivo foi modificado (pode já estar corrigido).");
}
