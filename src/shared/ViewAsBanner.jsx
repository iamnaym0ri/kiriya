import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { switchViewAs, useViewingAs } from "../lib/session.js";
import { haptic } from "../lib/native.js";
import "./ViewAsBanner.css";

/**
 * While Josh previews her side ("see it as kiriya", in his desk), a small pill floats above the tab
 * bar on every screen: what he is looking at, and the way back to his own side.
 */
export default function ViewAsBanner() {
  const as = useViewingAs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  if (!as) return null;
  const back = async () => {
    haptic("light").catch(() => {});
    await switchViewAs(queryClient, null);
    navigate("/world/me", { replace: true });
  };
  return (
    <div className="view-as" role="status">
      <span className="view-as__eye" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M3.5 12s3.1-5.5 8.5-5.5 8.5 5.5 8.5 5.5-3.1 5.5-8.5 5.5S3.5 12 3.5 12zM12 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="view-as__text">her side</span>
      <button type="button" className="view-as__back" onClick={back}>
        back to josh
      </button>
    </div>
  );
}
