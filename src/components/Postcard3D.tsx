"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

type Postcard3DProps = {
  front: ReactNode;
  back: ReactNode;
  className?: string;
  backVisible?: boolean;
  onTap?: (side: "front" | "back") => void;
};

export default function Postcard3D({ front, back, className = "", backVisible = false, onTap }: Postcard3DProps) {
  const [rotation, setRotation] = useState({ x: -5, y: backVisible ? 180 : 0 });
  const drag = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const expectedBack = useRef(backVisible);

  useEffect(() => {
    if (expectedBack.current === backVisible) return;
    expectedBack.current = backVisible;
    setRotation((current) => ({ ...current, y: current.y + (backVisible ? 180 : 0) - (current.y % 360) }));
  }, [backVisible]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.current.x;
    const deltaY = event.clientY - drag.current.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 2) drag.current.moved = true;
    drag.current.x = event.clientX;
    drag.current.y = event.clientY;
    setRotation((current) => ({ x: Math.max(-45, Math.min(45, current.x - deltaY * 0.65)), y: current.y + deltaX * 0.75 }));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const moved = drag.current.moved;
    drag.current = null;
    if (moved) {
      setRotation((current) => {
        return { x: Math.max(-28, Math.min(28, current.x * 0.3)), y: Math.round(current.y / 180) * 180 };
      });
    } else if (onTap) {
      const halfTurns = Math.round(rotation.y / 180);
      onTap(Math.abs(halfTurns % 2) === 1 ? "back" : "front");
    }
  }

  return (
    <div className={`postcard-3d-scene ${className}`}>
      <div
        className="postcard-3d-rotator"
        role={onTap ? "button" : "img"}
        tabIndex={onTap ? 0 : undefined}
        aria-label={onTap ? "Открытка с двух сторон. Нажми, чтобы открыть на весь экран; проведи, чтобы повернуть" : "Открытка с лицевой и обратной сторонами. Проведи пальцем, чтобы вращать"}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={(event) => {
          if (drag.current?.pointerId === event.pointerId) drag.current = null;
        }}
        onKeyDown={(event) => {
          if (onTap && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            const halfTurns = Math.round(rotation.y / 180);
            onTap(Math.abs(halfTurns % 2) === 1 ? "back" : "front");
          }
        }}
        style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}
      >
        <div className="postcard-3d-face postcard-3d-front">{front}</div>
        <div className="postcard-3d-face postcard-3d-back">{back}</div>
      </div>
      <small className="postcard-3d-hint">{onTap ? "Нажми, чтобы открыть на весь экран · проведи, чтобы повернуть" : "Проведи пальцем, чтобы повернуть"}</small>
    </div>
  );
}
