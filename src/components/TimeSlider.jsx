import { formatClock } from "../lib/sunTime.js";

export default function TimeSlider({
  minutes,
  onChange,
  sunriseMinutes,
  sunsetMinutes,
}) {
  const sunrise = sunriseMinutes != null ? formatClock(sunriseMinutes) : "—";
  const sunset = sunsetMinutes != null ? formatClock(sunsetMinutes) : "—";

  return (
    <div className="slider-row">
      <input
        type="range"
        min={0}
        max={1435}
        step={5}
        value={minutes}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Time of day"
      />
      <div className="slider-marks">
        <span>12 AM</span>
        <span>↑ {sunrise}</span>
        <span>12 PM</span>
        <span>↓ {sunset}</span>
        <span>11:55 PM</span>
      </div>
    </div>
  );
}
