/**
 * ToolLoader - Shows animated loading dots with contextual text
 * @param {string|null} state - "thinking" | "executing" | null
 */
export function ToolLoader({ state }) {
  if (!state) return null;

  const text = state === "thinking" ? "Thinking" : "Executing tools";

  return (
    <div className="tool-loader">
      <span className="tool-loader-text">{text}</span>
      <span className="tool-loader-dots">
        <span className="dot">.</span>
        <span className="dot">.</span>
        <span className="dot">.</span>
      </span>
    </div>
  );
}
