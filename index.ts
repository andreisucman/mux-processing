import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import timeout from "connect-timeout";
import rateLimit from "express-rate-limit";
import setHeaders from "middleware/setHeaders.js";
import processVideo from "@/routes/processVideo.js";
import blurVideo from "routes/blurVideo.js";
import blurImage from "routes/blurImage.js";
import transcribe from "routes/transcribe.js";
import metricCapturer from "middleware/metricCapturer.js";
import metrics from "routes/metrics.js";
import rootRoute from "routes/rootRoute.js";
import logCapturer from "middleware/logCapturer.js";
import errorHandler from "middleware/errorHandler.js";
import createHumanEmbedding from "routes/createHumanEmbedding.js";
import createGroupCollage from "@/routes/createGroupCollage.js";
import createGridCollage from "@/routes/createGridCollage.js";
import { client } from "init.js";
import checkAccess from "./middleware/checkAccess.js";

client.connect();

const app = express();

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(","),
  methods: ["GET", "POST", "OPTIONS", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "UserId",
    "X-CSRF-Token",
    "Access-Control-Allow-Credentials",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.options("*", cors(corsOptions));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(logCapturer);
app.use(metricCapturer);

app.set("trust proxy", 1);

app.use("*", setHeaders);
app.use(cookieParser());

app.use("/", rootRoute);
app.use("/metrics", metrics);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/transcribe", checkAccess, transcribe);

app.use(timeout("5m"));

app.use("/blurImage", blurImage);
app.use("/createHumanEmbedding", createHumanEmbedding);
app.use("/createGroupCollage", createGroupCollage);
app.use("/createGridCollage", createGridCollage);
app.use("/blurVideo", checkAccess, blurVideo);
app.use("/processVideo", checkAccess, processVideo);

app.use(errorHandler);

const port = process.env.PORT || 3002;
const httpServer = http.createServer(app);
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});
