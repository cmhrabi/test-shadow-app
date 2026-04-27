export default function PlayButton({ playing, onToggle }) {
  return (
    <button className="play-btn" onClick={onToggle} aria-pressed={playing}>
      {playing ? "❚❚ Pause" : "▶ Play"}
    </button>
  );
}
