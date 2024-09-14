import express from "express";
import http from "http";
import setHeaders from "./middleware/setHeaders.js";
import analyzeVideo from "./routes/analyzeVideo.js";
import { client } from "./init.js";

client.connect();

const app = express();
app.set("trust proxy", 1);
app.use("/analyzeVideo", analyzeVideo);

app.use(limiter);
app.use("*", setHeaders);

app.get("/", (req, res) => {
  res.status(200).json({ message: "" });
});

const port = process.env.PORT || 3002;
const httpServer = http.createServer(app);
httpServer.timeout = 1800000;
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});
