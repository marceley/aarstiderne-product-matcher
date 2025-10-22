import React, { useEffect, useRef } from "react";

export interface StarfieldProps {
  count?: number;
  inertia?: number;
  dotSize?: number;
  brightness?: number;
  sensitivity?: number;
  twinkleSpeed?: number;
  twinkleIntensity?: number;
  depthFade?: number; // how much farther stars fade out (0-1, default 0.5)
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}
interface Star extends Vec3 {
  phase: number;
}

export default function StarfieldCanvas({
  count = 1200,
  inertia = 0.08,
  dotSize = 1.2,
  brightness = 1,
  sensitivity = 0.4,
  twinkleSpeed = 0.015,
  twinkleIntensity = 0.5,
  depthFade = 0.5,
}: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const baseRef = useRef<Star[]>([]);
  const anglesRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const targetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const twinklePhase = useRef<number>(0);
  const scrollVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastScrollTimeRef = useRef<number>(Date.now());

  const rotateXYZ = (p: Vec3, ax: number, ay: number): Vec3 => {
    const cosY = Math.cos(ay),
      sinY = Math.sin(ay);
    const xzX = p.x * cosY + p.z * sinY;
    const xzZ = -p.x * sinY + p.z * cosY;
    const cosX = Math.cos(ax),
      sinX = Math.sin(ax);
    const yY = p.y * cosX - xzZ * sinX;
    const yZ = p.y * sinX + xzZ * cosX;
    return { x: xzX, y: yY, z: yZ };
  };

  const project = (
    p: Vec3,
    w: number,
    h: number,
    fov = 500
  ): { x: number; y: number; scale: number } => {
    const scale = fov / (fov + p.z);
    return { x: p.x * scale + w / 2, y: p.y * scale + h / 2, scale };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const setSize = (): void => {
      const dpr = Math.max(
        1,
        Math.min(2, (window.devicePixelRatio || 1) as number)
      );
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initStars();
    };

    const initStars = (): void => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const radius = Math.min(w, h) * 0.6;
      const stars: Star[] = new Array<number>(count).fill(0).map(() => {
        let x: number, y: number, s: number;
        do {
          x = Math.random() * 2 - 1;
          y = Math.random() * 2 - 1;
          s = x * x + y * y;
        } while (s >= 1 || s === 0);
        const z = 1 - 2 * s;
        const scale = 2 * Math.sqrt(1 - s);
        const vx = x * scale;
        const vy = y * scale;
        const vz = z;
        const r = Math.cbrt(Math.random()) * radius;
        const phase = Math.random() * Math.PI * 2;
        return { x: vx * r, y: vy * r, z: vz * r, phase } as Star;
      });
      baseRef.current = stars;
    };

    const draw = (): void => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      twinklePhase.current += twinkleSpeed;

      // Apply scroll momentum
      const currentTime = Date.now();
      const deltaTime = currentTime - lastScrollTimeRef.current;
      lastScrollTimeRef.current = currentTime;

      // Apply velocity to target angles
      targetRef.current.x += scrollVelocityRef.current.x * deltaTime * 0.01;
      targetRef.current.y += scrollVelocityRef.current.y * deltaTime * 0.01;

      // Apply friction to velocity
      scrollVelocityRef.current.x *= 0.95;
      scrollVelocityRef.current.y *= 0.95;

      // Clamp target angles to prevent excessive rotation
      targetRef.current.x = Math.max(
        -Math.PI / 3,
        Math.min(Math.PI / 3, targetRef.current.x)
      );
      targetRef.current.y = Math.max(
        -Math.PI,
        Math.min(Math.PI, targetRef.current.y)
      );

      anglesRef.current.x +=
        (targetRef.current.x - anglesRef.current.x) * inertia;
      anglesRef.current.y +=
        (targetRef.current.y - anglesRef.current.y) * inertia;

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      const ax = anglesRef.current.x;
      const ay = anglesRef.current.y;

      for (let i = 0; i < baseRef.current.length; i++) {
        const star = baseRef.current[i];
        const p = rotateXYZ(star, ax, ay);
        if (p.z < -450) continue;
        const q = project(p, w, h, 500);
        const size = Math.max(0.5, dotSize * q.scale);
        const twinkle =
          1 -
          twinkleIntensity *
            (0.5 + 0.5 * Math.sin(twinklePhase.current + star.phase));

        // Fade farther stars to create depth
        const distanceFade = 1 - Math.min(1, ((p.z + 500) / 1000) * depthFade);
        const alpha = Math.max(
          0,
          Math.min(1, brightness * twinkle * distanceFade)
        );

        ctx.beginPath();
        ctx.arc(q.x, q.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }

      rafRef.current = window.requestAnimationFrame(draw);
    };

    const onScroll = (e: WheelEvent): void => {
      e.preventDefault();

      // Use deltaX for horizontal scroll (trackpad) and deltaY for vertical scroll
      const deltaX = e.deltaX || 0;
      const deltaY = e.deltaY || 0;

      // Convert scroll deltas to rotation velocity
      const scrollSensitivity = 0.003;
      scrollVelocityRef.current.y += deltaX * scrollSensitivity;
      scrollVelocityRef.current.x += deltaY * scrollSensitivity;

      // Limit maximum velocity
      const maxVelocity = 0.02;
      scrollVelocityRef.current.x = Math.max(
        -maxVelocity,
        Math.min(maxVelocity, scrollVelocityRef.current.x)
      );
      scrollVelocityRef.current.y = Math.max(
        -maxVelocity,
        Math.min(maxVelocity, scrollVelocityRef.current.y)
      );
    };

    const onTouchScroll = (e: TouchEvent): void => {
      // Handle touch scrolling for mobile devices
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - (touch.target as any).lastTouchX || 0;
        const deltaY = touch.clientY - (touch.target as any).lastTouchY || 0;

        if ((touch.target as any).lastTouchX !== undefined) {
          const touchSensitivity = 0.005;
          scrollVelocityRef.current.y += deltaX * touchSensitivity;
          scrollVelocityRef.current.x += deltaY * touchSensitivity;
        }

        (touch.target as any).lastTouchX = touch.clientX;
        (touch.target as any).lastTouchY = touch.clientY;
      }
    };

    setSize();
    window.addEventListener("resize", setSize);
    window.addEventListener("wheel", onScroll, { passive: false });
    window.addEventListener("touchmove", onTouchScroll, { passive: true });

    rafRef.current = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", setSize);
      window.removeEventListener("wheel", onScroll);
      window.removeEventListener("touchmove", onTouchScroll);
    };
  }, [
    count,
    inertia,
    dotSize,
    brightness,
    sensitivity,
    twinkleSpeed,
    twinkleIntensity,
    depthFade,
  ]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const { body, documentElement } = document;
    const prevBodyMargin = body.style.margin;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlHeight = documentElement.style.height;
    const prevBodyHeight = body.style.height;

    body.style.margin = "0";
    body.style.overflow = "hidden";
    documentElement.style.height = "100%";
    body.style.height = "100%";

    return () => {
      body.style.margin = prevBodyMargin;
      body.style.overflow = prevBodyOverflow;
      documentElement.style.height = prevHtmlHeight;
      body.style.height = prevBodyHeight;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
      }}
      aria-label="Interactive starfield background"
      role="img"
    />
  );
}
