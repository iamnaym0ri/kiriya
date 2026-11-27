/** A little drawing of a sketchbook tool: a brush's stroke, or a shape. */
export default function ToolMark({ tool }) {
  return <svg viewBox="0 0 52 28" aria-hidden="true">
    {tool === "heart" ? <path d="M26 25C21 19 7 13 14 6q6-6 12 3 6-9 12-3c7 7-7 13-12 19Z" fill="currentColor" />
      : tool === "star" ? <path d="m26 2 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z" fill="currentColor" />
      : tool === "sparkle" ? <path d="m26 2 4 10 12 2-12 3-4 10-4-10-12-3 12-2Z" fill="currentColor" />
      : tool === "rectangle" ? <rect x="13" y="5" width="26" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      : tool === "ellipse" ? <ellipse cx="26" cy="14" rx="13" ry="10" fill="none" stroke="currentColor" strokeWidth="2" />
      : tool === "eraser" ? <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M14 20 25 9l8 8-6 6h-9Z" /><path d="m20 14 8 8M12 25h28" /></g>
      : <path d={tool === "line" ? "m10 22 32-16" : "M7 20Q16 3 25 14T45 7"} fill="none" stroke="currentColor" strokeWidth={tool === "pencil" ? 1.3 : tool === "marker" ? 9 : tool === "crayon" ? 5 : 4} strokeLinecap="round" opacity={tool === "marker" ? .4 : 1} strokeDasharray={tool === "crayon" ? "2 2" : undefined} />}
  </svg>;
}
