import { FormData, File } from "formdata-node";
import mime from "mime-types";
import fs from "fs/promises";
import path from "path";

const getMimeType = (filePath) => {
  return mime.lookup(filePath) || "application/octet-stream";
};

export async function checkForProhibitedContent(arrayOfFiles) {
  try {
    const form = new FormData();

    for (const filePath of arrayOfFiles) {
      try {
        const fileBuffer = await fs.readFile(filePath);

        const file = new File([fileBuffer], path.basename(filePath), {
          type: getMimeType(filePath),
        });

        form.append("contents", file);
      } catch (err) {
        console.warn(
          `File does not exist or cannot be read and will be skipped: ${filePath}`
        );
      }
    }

    if (form.entries().next().done) {
      console.warn("No valid files to upload.");
      return false;
    }

    const response = await fetch(
      "http://localhost:3333/multiple/multipart-form",
      {
        method: "POST",
        body: form,
      }
    );

    if (!response.ok) {
      throw new Error(
        `Server responded with ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    const relevant = data.predictions
      .flat()
      .filter((obj) => ["Hentai", "Porn"].includes(obj.className));

    const pornDetected = relevant.some((obj) => obj.probability > 0.6);

    console.log("pornDetected:", pornDetected);

    return pornDetected;
  } catch (error) {
    console.error("Error uploading files:", error.message);
    throw error;
  }
}
