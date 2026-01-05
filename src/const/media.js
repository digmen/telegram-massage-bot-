import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const START_PHOTO_PATH = path.join(__dirname, "..", "..", "media", "startPhoto.jpg");
export const SECOND_PHOTO_PATH = path.join(__dirname, "..", "..", "media", "secondPhoto.jpg");

