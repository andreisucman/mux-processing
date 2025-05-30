import * as dotenv from "dotenv";
dotenv.config();

import { CustomRequest } from "types.js";
import { Response, NextFunction } from "express";

function setHeaders(req: CustomRequest, res: Response, next: NextFunction) {
  res.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self'; style-src 'self'; font-src https://fonts.googleapis.com https://fonts.gstatic.com; style-src-elem 'self' https://fonts.googleapis.com https://fonts.gstatic.com`
  );

  res.set("Access-Control-Allow-Credentials", "true");

  next();
}

export default setHeaders;
