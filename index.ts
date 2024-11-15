import express from "express";
import http from "http";
import cors from "cors";
import timeout from "connect-timeout";
import rateLimit from "express-rate-limit";
import setHeaders from "./middleware/setHeaders.js";
import analyzeVideo from "./routes/analyzeVideo.js";
import blurVideo from "./routes/blurVideo.js";
import blurImage from "./routes/blurImage.js";
import transcribe from "./routes/transcribe.js";
import { client } from "./init.js";

client.connect();

const app = express();

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(","),
  methods: ["GET", "POST", "OPTIONS", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-CSRF-Token",
    "Access-Control-Allow-Credentials",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.options("*", cors(corsOptions));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

app.set("trust proxy", 1);

app.use("*", setHeaders);

app.use("/transcribe", transcribe);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(timeout("10m"));

app.use("/blurVideo", blurVideo);
app.use("/blurImage", blurImage);
app.use("/analyzeVideo", analyzeVideo);

app.get("/", (req, res) => {
  res.status(200).json({ message: "" });
});

const port = process.env.PORT || 3002;
const httpServer = http.createServer(app);
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});
