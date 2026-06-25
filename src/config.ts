import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ quiet: true });

export const getExtPath = () => {
  if (typeof __dirname !== "undefined") {
    return path.resolve(__dirname, __dirname.endsWith("dist") ? "../extension" : "../extension");
  }
  // @ts-ignore
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../extension");
};

export const EXTENSION_PATH = getExtPath();
export const PORT = Number(process.env.PORT) || Number(process.env.MCP_PORT) || 37210;
