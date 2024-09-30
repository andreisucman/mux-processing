import { Request, Response, NextFunction } from "express";
import * as dotenv from "dotenv";
dotenv.config();

function setHeaders(req: Request, res: Response, next: NextFunction) {
  res.set("Access-Control-Allow-Credentials", "true");

  next();
}

export default setHeaders;
