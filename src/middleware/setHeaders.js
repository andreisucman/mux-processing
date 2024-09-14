import * as dotenv from "dotenv";
dotenv.config();

function setHeaders(req, res, next) {
  res.set("Access-Control-Allow-Credentials", "true");

  next();
}

export default setHeaders;
