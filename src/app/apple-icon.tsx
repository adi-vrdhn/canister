import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#090909",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 14,
            borderRadius: 40,
            background: "#ff7a1a",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 34,
            borderRadius: 34,
            background: "#111111",
          }}
        />
        <div
          style={{
            width: 92,
            height: 62,
            borderRadius: 18,
            background: "#f5f0de",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 0 0 4px rgba(17,17,17,0.18)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 14,
              background: "#ff7a1a",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 22,
              left: 0,
              right: 0,
              height: 10,
              background: "#111111",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 10,
              background: "#111111",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 11,
              left: 34,
              width: 24,
              height: 16,
              background: "#111111",
              clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 28,
              left: 28,
              width: 36,
              height: 20,
              borderRadius: 9999,
              background: "#090909",
            }}
          />
        </div>
      </div>
    ),
    size
  );
}
