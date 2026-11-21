const {readFile, writeFile, rename} = require("node:fs/promises");
const path = require("node:path");
const esbuild = require("esbuild");

const separator = "/* Escritório 3D — bundle gerado. Fonte em deploy/cockpit/office. */";
const styleSeparator = "/* Escritório — estilos dos componentes. Fonte em deploy/cockpit/office. */";

async function bundle(appFile) {
  if (!appFile) throw new Error("Informe o caminho para o app.js do Cockpit.");
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, "escritorio-3d.js")],
    target: "es2022",
    format: "iife",
    bundle: true,
    minify: true,
    legalComments: "inline",
    loader: {".jpg": "dataurl"},
    write: false,
  });
  const source = (await readFile(appFile, "utf8")).split(separator)[0].trimEnd();
  const styleFile = path.join(path.dirname(appFile), "estilo.css");
  const baseStyles = (await readFile(styleFile, "utf8")).split(styleSeparator)[0].trimEnd();
  const components = await Promise.all(["dock.css", "atividade.css", "revisao.css"]
    .map(file => readFile(path.join(__dirname, file), "utf8")));
  const css = `${baseStyles}\n\n${styleSeparator}\n${components.join("\n")}`;
  await esbuild.transform(css, {loader: "css", logLevel: "warning"});
  const temporary = `${appFile}.office-next`;
  const temporaryStyles = `${styleFile}.office-next`;
  await writeFile(temporary, `${source}\n\n${separator}\n${result.outputFiles[0].text}`);
  await writeFile(temporaryStyles, css);
  await rename(temporary, appFile);
  await rename(temporaryStyles, styleFile);
}

bundle(process.argv[2]).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
