import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const expressTypesPath = path.resolve("node_modules/@types/express-serve-static-core/index.d.ts");
if (existsSync(expressTypesPath)) {
  const content = readFileSync(expressTypesPath, "utf-8");
  const patched = content.replace(/\[key: string\]: string \| string\[\];/g, "[key: string]: string;");
  if (patched !== content) {
    writeFileSync(expressTypesPath, patched);
    console.log("Patched express-serve-static-core ParamsDictionary types");
  } else {
    console.log("Already patched");
  }
} else {
  console.log("express-serve-static-core types not found, skipping patch");
}
