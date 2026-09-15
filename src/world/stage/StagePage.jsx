import { MusicSpread } from "../collection/Collections.jsx";
import SongShelf from "./SongShelf.jsx";
export default function StagePage() {
  return (
    <div className="music-page">
      <MusicSpread full />
      <SongShelf />
    </div>
  );
}
