import express from "express";
import http from "http";
import setHeaders from "./middleware/setHeaders.js";
import analyzeVideo from "./routes/analyzeVideo.js";
import { client } from "./init.js";
import timeout from "connect-timeout";

client.connect();

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use("/analyzeVideo", timeout("10m"), analyzeVideo);

app.use("*", setHeaders);
app.get("/", (req, res) => {
  res.status(200).json({ message: "" });
});

const port = process.env.PORT || 3002;
const httpServer = http.createServer(app);
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});
