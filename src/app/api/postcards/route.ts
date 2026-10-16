import { readdir } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

function getTitle(filename: string, index: number) {
  const stem = path.parse(filename).name;
  const cameraName = /^(img|dsc|dscn|pxl|image)[-_ ]?\d+$/i.test(stem);
  const codeName = /^[a-z0-9]{7,}$/i.test(stem);

  if (cameraName) return `Фото ${index + 1}`;
  if (codeName) return `Открытка ${index + 1}`;
  return stem.replace(/[._-]+/g, " ").trim() || `Фото ${index + 1}`;
}

export async function GET() {
  await connection();
  const directory = path.join(process.cwd(), "public", "postcards");

  try {
    const files = await readdir(directory, { withFileTypes: true });
    const images = files
      .filter((file) => file.isFile() && imageExtensions.has(path.extname(file.name).toLowerCase()))
      .map((file) => file.name)
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));

    return Response.json(
      images.map((filename, index) => ({
        id: filename,
        title: getTitle(filename, index),
        category: "Мои фото",
        image: `/postcards/${encodeURIComponent(filename)}`,
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not read public/postcards", error);
    return Response.json({ error: "Не удалось прочитать папку с фотографиями." }, { status: 500 });
  }
}
