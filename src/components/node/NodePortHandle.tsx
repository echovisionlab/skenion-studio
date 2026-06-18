import type { CSSProperties } from "react";
import socketStyles from "./PortSocket.module.css";

export function NodePortHandle({
  color
}: {
  color: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`port-socket ${socketStyles.portSocket}`}
      style={{ "--port-color": color } as CSSProperties}
    />
  );
}
