// components/ui/animated-glow-card.tsx
// Animated gradient-glow border card. A blurred colored glow sits behind a dark
// card; the border is a gradient frame so the glow leaks through the edges.
// Pair <Card> inside a <CardCanvas> (the canvas provides the backdrop glow).

import React from "react";

const CardCanvas = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={`card-canvas ${className}`}>
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <filter width="3000%" x="-1000%" height="3000%" y="-1000%" id="unopaq">
          <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 3 0"></feColorMatrix>
        </filter>
      </svg>
      <div className="card-backdrop"></div>
      {children}
    </div>
  );
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={`glow-card ${className}`}>
      <div className="border-element border-left"></div>
      <div className="border-element border-right"></div>
      <div className="border-element border-top"></div>
      <div className="border-element border-bottom"></div>
      <div className="card-content">
        {children}
      </div>
    </div>
  );
};

export { CardCanvas, Card };
