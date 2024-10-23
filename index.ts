import express from "express";
import http from "http";
import timeout from "connect-timeout";
import setHeaders from "./middleware/setHeaders.js";
import analyzeVideo from "./routes/analyzeVideo.js";
import blurEyes from "./routes/blurEyes.js";
import blurFace from "./routes/blurFace.js";
import { client } from "./init.js";

client.connect();

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded());
app.use(timeout("10m"));
app.use("/blurEyes", blurEyes);
app.use("/blurFace", blurFace);
app.use("/analyzeVideo", analyzeVideo);

app.use("*", setHeaders);
app.get("/", (req, res) => {
  res.status(200).json({ message: "" });
});

const port = process.env.PORT || 3002;
const httpServer = http.createServer(app);
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});
