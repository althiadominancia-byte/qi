"use client";

import * as React from "react";
import { motion, useInView, useSpring, useTransform } from "framer-motion";

interface AnimatedStatsCardProps {
  title: string;
  primaryValue: number;
  primarySuffix?: string;
  secondaryValue: number | string;
  secondaryLabel: string;
  icon: React.ReactNode;
  accent?: string;
  decimals?: number;
}

export const AnimatedStatsCard = React.forwardRef<HTMLDivElement, AnimatedStatsCardProps>(
  (
    {
      title,
      primaryValue,
      primarySuffix = "",
      secondaryValue,
      secondaryLabel,
      icon,
      accent = "#4b2fb3",
      decimals = 0,
    },
    ref
  ) => {
    const cardRef = React.useRef<HTMLDivElement | null>(null);
    const setRefs = (node: HTMLDivElement | null) => {
      cardRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    };
    const isInView = useInView(cardRef, { once: true, margin: "-60px" });

    const spring = useSpring(0, { damping: 50, stiffness: 200, mass: 1 });
    const display = useTransform(spring, (v) => v.toFixed(decimals));

    React.useEffect(() => {
      if (isInView) spring.set(primaryValue);
    }, [isInView, primaryValue, spring]);

    return (
      <div
        ref={setRefs}
        style={{
          background: "#fff",
          border: "1px solid #E9E4F5",
          borderRadius: 16,
          padding: "18px 20px",
          boxShadow: "0 1px 2px rgba(45,35,84,0.04), 0 4px 16px rgba(75,47,179,0.06)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          minHeight: 130,
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            className="h"
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "#2D2354",
              letterSpacing: 0.1,
              textTransform: "uppercase",
              fontFamily: "Outfit, Inter, sans-serif",
            }}
          >
            {title}
          </div>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 99,
              background: "#F4F1FB",
              color: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #E9E4F5",
            }}
          >
            {icon}
          </div>
        </div>

        {/* body */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 2, minWidth: 78 }}>
            <motion.span
              style={{
                fontSize: 38,
                fontWeight: 800,
                color: "#1a1335",
                lineHeight: 1,
                fontFamily: "Outfit, Inter, sans-serif",
                letterSpacing: -1,
              }}
            >
              {display}
            </motion.span>
            {primarySuffix && (
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#1a1335",
                  fontFamily: "Outfit, Inter, sans-serif",
                }}
              >
                {primarySuffix}
              </span>
            )}
          </div>

          <div
            style={{
              flex: 1,
              height: 8,
              background: "#F1ECFB",
              borderRadius: 99,
              position: "relative",
              overflow: "hidden",
              border: "1px solid #E9E4F5",
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={isInView ? { width: `${Math.max(0, Math.min(100, primaryValue))}%` } : { width: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{
                height: "100%",
                background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
                borderRadius: 99,
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, minWidth: 42 }}>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#2D2354",
                lineHeight: 1,
                fontFamily: "Outfit, Inter, sans-serif",
              }}
            >
              {secondaryValue}
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: accent,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                fontFamily: "Inter, sans-serif",
                lineHeight: 1,
              }}
            >
              {secondaryLabel}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

AnimatedStatsCard.displayName = "AnimatedStatsCard";
