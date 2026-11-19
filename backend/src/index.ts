import express from "express";
import cors from "cors";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import squadRoutes from "./routes/squad.routes";
import marketRoutes from "./routes/market.routes";
import packsRoutes from "./routes/packs.routes";
import socialRoutes from "./routes/social.routes";
import { getTokenMetadata } from "./controllers/market.controller";

const app = express();

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "W3 Football Manager API",
    chainId: env.chainId,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/squad", squadRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/packs", packsRoutes);
app.use("/api/social", socialRoutes);
app.get("/api/metadata/:tokenId", getTokenMetadata);

app.listen(env.port, () => {
  console.log(`Backend API running at http://localhost:${env.port}`);
});
