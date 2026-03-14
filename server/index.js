import "./config/env.js";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import testRoutes from "./routes/test.js";
import geminiRoutes from "./routes/gemini.js";
import userRoutes from "./routes/user.js";
import taskRoutes from "./routes/tasks.js";
import certificateRoutes from "./routes/certificates.js";

const app = express();
const port = process.env.PORT || 5000;

const parseAllowedOrigins = () => {
  const raw = String(process.env.CLIENT_URLS || process.env.CLIENT_URL || "").trim();
  const items = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (items.length > 0) {
    return items;
  }

  return ["http://localhost:5173"];
};

const allowedOrigins = parseAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "AKSHARA API is running" });
});

app.use("/", authRoutes);
app.use("/", geminiRoutes);
app.use("/", testRoutes);
app.use("/", userRoutes);
app.use("/", taskRoutes);
app.use("/", certificateRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    message: err.message || "Internal server error"
  });
});

app.listen(port, () => {
  console.log(`AKSHARA server running on port ${port}`);
});
