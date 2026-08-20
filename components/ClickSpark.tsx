"use client";

import React, { useRef, useEffect, useCallback } from 'react';

interface ClickSparkProps {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  extraScale?: number;
  children?: React.ReactNode;
}

interface Spark {
  x: number;
  y: number;
  angle: number;
  startTime: number;
}

const ClickSpark: React.FC<ClickSparkProps> = ({
  sparkColor = '#fff',
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = 'ease-out',
  extraScale = 1.0,
  children
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let resizeTimeout: ReturnType<typeof setTimeout>;

    // viewport-sized canvas — window is the sizing parent, not a div whose
    // height depends on document flow (which collapses this component)
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeCanvas, 100);
    };

    resizeCanvas();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  const easeFunc = useCallback(
    (t: number) => {
      switch (easing) {
        case 'linear':
          return t;
        case 'ease-in':
          return t * t;
        case 'ease-in-out':
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        default:
          return t * (2 - t);
      }
    },
    [easing]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = (timestamp: number) => {
      ctx?.clearRect(0, 0, canvas.width, canvas.height);

      if (sparksRef.current.length) {
        sparksRef.current = sparksRef.current.filter((spark: Spark) => {
          const elapsed = timestamp - spark.startTime;
          if (elapsed >= duration) {
            return false;
          }

          const progress = elapsed / duration;
          const eased = easeFunc(progress);

          const distance = eased * sparkRadius * extraScale;
          const lineLength = sparkSize * (1 - eased);

          const x1 = spark.x + distance * Math.cos(spark.angle);
          const y1 = spark.y + distance * Math.sin(spark.angle);
          const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
          const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

          ctx.strokeStyle = sparkColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          return true;
        });
      }

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [sparkColor, sparkSize, sparkRadius, duration, easeFunc, extraScale]);

  // document-level listener: fires for EVERY click on the page no matter
  // which element is hit, and never blocks or buries under stacked content
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const x = e.clientX;
      const y = e.clientY;

      const now = performance.now();
      const newSparks: Spark[] = Array.from({ length: sparkCount }, (_, i) => ({
        x,
        y,
        angle: (2 * Math.PI * i) / sparkCount,
        startTime: now
      }));

      sparksRef.current.push(...newSparks);
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [sparkCount]);

  return (
    <>
      {/* fixed overlay: always covers the viewport, above page content,
          but invisible to pointer events so nothing is blocked */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 9999
        }}
      />
      {children}
    </>
  );
};

export default ClickSpark;
