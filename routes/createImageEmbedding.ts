import * as dotenv from "dotenv";
dotenv.config();
import { Router, Response, NextFunction } from "express";
import { CustomRequest } from "types.js";
import { __dirname } from "init.js";
import path from "path";
import { exec } from "child_process";
import httpError from "@/helpers/httpError.js";

const route = Router();

route.post("/", async (req: CustomRequest, res: Response, next: NextFunction) => {
  const { image } = req.body;

  try {
    if (!image) {
      res.status(400).json({ error: "Bad request" });
      return;
    }

    const scriptPath = path.resolve("./embedding.js");
    const command = `node ${scriptPath} "${image}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        res.status(500).json({ error: stderr });
        return;
      }
      try {
        const embeds = JSON.parse(stdout);
        res.json({ response: embeds });
      } catch (e) {
        throw httpError("Failed to parse embeddings");
      }
    });
  } catch (err) {
    next(err);
  }
});

export default route;
