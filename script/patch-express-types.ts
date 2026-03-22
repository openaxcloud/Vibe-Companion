import fs from "fs";
import path from "path";

const filePath = path.resolve(
  "node_modules/@types/express-serve-static-core/index.d.ts"
);

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, "utf-8");
  const before = content;
  content = content.replace(
    /\[key: string\]: string \| string\[\];/g,
    "[key: string]: string;"
  );
  if (content !== before) {
    fs.writeFileSync(filePath, content);
    console.log("Patched express-serve-static-core ParamsDictionary");
  } else {
    console.log("Already patched");
  }
} else {
  console.log("express-serve-static-core types not found, skipping patch");
}
