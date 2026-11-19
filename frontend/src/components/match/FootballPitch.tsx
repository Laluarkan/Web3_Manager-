"use client";

import React, { useEffect, useRef } from "react";
import { MatchEngine, PITCH_W, PITCH_H } from "@/engine/ai/TacticalAI";

interface FootballPitchProps {
  engine: MatchEngine;
  homeTeamName: string;
  awayTeamName: string;
}

export const FootballPitch: React.FC<FootballPitchProps> = ({
  engine,
  homeTeamName,
  awayTeamName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const pad = 24;
      const pitchW = width - pad * 2;
      const pitchH = height - pad * 2;

      // 1. RUMPUT LAPANGAN DENGAN STRIPES ALTERNATIF
      ctx.fillStyle = "#16441e";
      ctx.fillRect(0, 0, width, height);

      const stripes = 11;
      const stripeW = pitchW / stripes;
      for (let i = 0; i < stripes; i++) {
        if (i % 2 === 0) {
          ctx.fillStyle = "#1b4f24";
          ctx.fillRect(pad + i * stripeW, pad, stripeW, pitchH);
        }
      }

      // 2. GARIS PUTIH STANDAR UEFA
      ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
      ctx.lineWidth = 2.2;

      // Garis Luar (Touchlines & Goal lines)
      ctx.strokeRect(pad, pad, pitchW, pitchH);

      // Garis Tengah & Lingkaran Tengah
      const midX = width / 2;
      const midY = height / 2;
      ctx.beginPath();
      ctx.moveTo(midX, pad);
      ctx.lineTo(midX, height - pad);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(midX, midY, pitchW * 0.0871, 0, Math.PI * 2);
      ctx.stroke();

      // Titik Kick-off
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(midX, midY, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Kotak Penalti Kiri (Home)
      const boxW = pitchW * 0.165;
      const boxH = pitchH * 0.58;
      ctx.strokeRect(pad, (height - boxH) / 2, boxW, boxH);

      const smallBoxW = pitchW * 0.058;
      const smallBoxH = pitchH * 0.28;
      ctx.strokeRect(pad, (height - smallBoxH) / 2, smallBoxW, smallBoxH);

      // Titik Penalti Kiri
      ctx.beginPath();
      ctx.arc(pad + boxW * 0.72, midY, 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Busur Penalti Kiri
      ctx.beginPath();
      ctx.arc(pad + boxW * 0.72, midY, pitchW * 0.0871, -0.7, 0.7);
      ctx.stroke();

      // Jaring Gawang Kiri
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(pad - 14, (height - smallBoxH) / 2, 14, smallBoxH);
      ctx.strokeRect(pad - 14, (height - smallBoxH) / 2, 14, smallBoxH);

      // Kotak Penalti Kanan (Away)
      ctx.strokeRect(width - pad - boxW, (height - boxH) / 2, boxW, boxH);
      ctx.strokeRect(width - pad - smallBoxW, (height - smallBoxH) / 2, smallBoxW, smallBoxH);

      // Titik Penalti Kanan
      ctx.beginPath();
      ctx.arc(width - pad - boxW * 0.72, midY, 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Busur Penalti Kanan
      ctx.beginPath();
      ctx.arc(width - pad - boxW * 0.72, midY, pitchW * 0.0871, Math.PI - 0.7, Math.PI + 0.7);
      ctx.stroke();

      // Jaring Gawang Kanan
      ctx.fillRect(width - pad, (height - smallBoxH) / 2, 14, smallBoxH);
      ctx.strokeRect(width - pad, (height - smallBoxH) / 2, 14, smallBoxH);

      // Busur Sudut (Corner Arcs)
      const cornerR = 12;
      ctx.beginPath();
      ctx.arc(pad, pad, cornerR, 0, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pad, height - pad, cornerR, -Math.PI / 2, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(width - pad, pad, cornerR, Math.PI / 2, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(width - pad, height - pad, cornerR, Math.PI, Math.PI * 1.5);
      ctx.stroke();

      // HIGHLIGHT SET PIECE PADA LAPANGAN
      const sp = engine.setPieceState;
      if (sp === "PENALTY") {
        const spotX = engine.possession === "HOME" ? width - pad - boxW * 0.72 : pad + boxW * 0.72;
        ctx.strokeStyle = "rgba(234, 179, 8, 0.85)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(spotX, midY, 14 + Math.sin(Date.now() / 150) * 3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (sp === "CORNER") {
        const cx = (engine.ball.position.x / PITCH_W) * pitchW + pad;
        const cy = (engine.ball.position.y / PITCH_H) * pitchH + pad;
        ctx.strokeStyle = "rgba(52, 211, 153, 0.85)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 15 + Math.sin(Date.now() / 150) * 3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (sp === "OFFSIDE") {
        const ox = (engine.ball.position.x / PITCH_W) * pitchW + pad;
        ctx.strokeStyle = "rgba(239, 68, 68, 0.75)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(ox, pad);
        ctx.lineTo(ox, height - pad);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 3. RENDER 22 PEMAIN DENGAN HEADING POINTER & AURA
      const ball = engine.ball;
      engine.agents.forEach((agent) => {
        const px = pad + (agent.position.x / PITCH_W) * pitchW;
        const py = pad + (agent.position.y / PITCH_H) * pitchH;
        const isHome = agent.team === "HOME";
        const isCarrier = ball.carrier === agent;

        // Aura bercahaya untuk pembawa bola aktif
        if (isCarrier) {
          ctx.strokeStyle = isHome ? "rgba(52, 211, 153, 0.95)" : "rgba(251, 113, 133, 0.95)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px, py, 15, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Bayangan lembut pemain di rumput
        ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
        ctx.beginPath();
        ctx.ellipse(px + 1.2, py + 2.5, 9, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Badan Pemain (Circle Node)
        ctx.fillStyle =
          agent.positionRole === "GK"
            ? isHome
              ? "#f59e0b" // Emas untuk GK Home
              : "#ea580c" // Oranye untuk GK Away
            : isHome
            ? "#06b6d4"   // Biru Cyan untuk Home
            : "#f43f5e";  // Crimson untuk Away

        ctx.beginPath();
        ctx.arc(px, py, 9.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Pointer Arah Hadap (Heading Direction Pointer)
        const pointerDist = 11.5;
        const tipX = px + Math.cos(agent.facingAngle) * pointerDist;
        const tipY = py + Math.sin(agent.facingAngle) * pointerDist;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(tipX, tipY, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Nomor Punggung
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(agent.number), px, py + 0.5);

        // Label Nama Pemain
        ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
        ctx.fillRect(px - 26, py - 19, 52, 11);
        ctx.fillStyle = isHome ? "#38bdf8" : "#fda4af";
        ctx.font = "8px sans-serif";
        ctx.fillText(agent.name.slice(0, 9), px, py - 13);
      });

      // 4. RENDER BOLA DENGAN ELEVASI 3D (Z-HEIGHT) & BAYANGAN REALISTIS
      const ballFloorX = pad + (ball.position.x / PITCH_W) * pitchW;
      const ballFloorY = pad + (ball.position.y / PITCH_H) * pitchH;

      // Bayangan Bola di Rumput (Membesar & Menipis saat Bola Melambung Tinggi)
      const shadowScale = 1 + ball.z / 4;
      const shadowAlpha = Math.max(0.1, 0.42 - ball.z / 12);
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.beginPath();
      ctx.ellipse(ballFloorX + 2, ballFloorY + 3, 5.5 * shadowScale, 3.2 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Posisi Udara Bola: (x, y - z)
      const ballAirY = ballFloorY - ball.z * 7;

      // Bola Putih
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ballFloorX, ballAirY, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Corak Pentagon Hitam di Tengah Bola
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(ballFloorX, ballAirY, 2.0, 0, Math.PI * 2);
      ctx.fill();

      // 5. RENDER HUD MATCH BANNER (OFFSIDE, CORNER, PENALTY, REBOUND, DLL)
      const banner = engine.activeBanner;
      if (banner && banner.timer > 0) {
        ctx.save();
        const bannerW = Math.min(520, width - 40);
        const bannerH = 46;
        const bannerX = (width - bannerW) / 2;
        const bannerY = pad + 12;

        // Background Glass Pill
        ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
        ctx.beginPath();
        ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 12);
        ctx.fill();

        ctx.strokeStyle = "rgba(245, 158, 11, 0.75)";
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Badge Icon
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(banner.badge, bannerX + 16, bannerY + 23);

        // Title
        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText(banner.title, bannerX + 46, bannerY + 16);

        // Subtitle
        if (banner.subtitle) {
          ctx.fillStyle = "#94a3b8";
          ctx.font = "11px sans-serif";
          ctx.fillText(banner.subtitle.slice(0, 55), bannerX + 46, bannerY + 32);
        }

        ctx.restore();
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [engine, homeTeamName, awayTeamName]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-800/90 shadow-2xl">
      <canvas
        ref={canvasRef}
        width={960}
        height={638}
        className="w-full h-auto block select-none bg-slate-950"
      />
    </div>
  );
};
