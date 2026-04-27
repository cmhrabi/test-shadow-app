import { useEffect, useMemo, useRef, useState } from "react";
import SunCalc from "suncalc";
import MapView from "./components/MapView.jsx";
import TimeSlider from "./components/TimeSlider.jsx";
import DatePicker from "./components/DatePicker.jsx";
import PlayButton from "./components/PlayButton.jsx";
import SunReadout from "./components/SunReadout.jsx";
import { useBuildingData } from "./hooks/useBuildingData.js";
import { MAP_CENTER, TORONTO_TZ } from "./lib/constants.js";
import {
  dateAndMinutesToUtc,
  formatClock,
  todayInTorontoYmd,
} from "./lib/sunTime.js";
import { fromZonedTime } from "date-fns-tz";

// Animation speed: simulated minutes per real second.
const PLAY_SIMSEC_PER_TICK = 0.5; // 30 sim-min per real second at 60 Hz
const PLAY_INTERVAL_MS = 33;

function utcMinutesFromMidnightToronto(date, ymd) {
  // Express a UTC instant `date` as minutes since midnight Toronto local on `ymd`.
  // Used to map sunrise/sunset → slider position.
  const midnight = fromZonedTime(`${ymd}T00:00:00`, TORONTO_TZ);
  const diffMs = date.getTime() - midnight.getTime();
  const m = Math.round(diffMs / 60000);
  if (m < 0 || m > 1440) return null;
  return m;
}

export default function App() {
  const [ymd, setYmd] = useState(() => todayInTorontoYmd());
  const [minutes, setMinutes] = useState(15 * 60); // default 3 PM
  const [playing, setPlaying] = useState(false);
  const mapRef = useRef(null);
  const playRafRef = useRef(null);

  const { status, buildings, source, error } = useBuildingData();

  const utcDate = useMemo(() => dateAndMinutesToUtc(ymd, minutes), [ymd, minutes]);
  const sunPos = useMemo(
    () => SunCalc.getPosition(utcDate, MAP_CENTER.lat, MAP_CENTER.lng),
    [utcDate]
  );

  const sunTimes = useMemo(() => {
    const seed = dateAndMinutesToUtc(ymd, 12 * 60);
    return SunCalc.getTimes(seed, MAP_CENTER.lat, MAP_CENTER.lng);
  }, [ymd]);

  const sunriseMin = useMemo(
    () => (sunTimes.sunrise ? utcMinutesFromMidnightToronto(sunTimes.sunrise, ymd) : null),
    [sunTimes, ymd]
  );
  const sunsetMin = useMemo(
    () => (sunTimes.sunset ? utcMinutesFromMidnightToronto(sunTimes.sunset, ymd) : null),
    [sunTimes, ymd]
  );

  // Whenever buildings or sun position change, push an imperative shadow update.
  useEffect(() => {
    if (!mapRef.current || !buildings) return;
    mapRef.current.updateShadows(buildings, sunPos);
  }, [buildings, sunPos]);

  // Play loop: advance slider via setInterval; clears on pause/unmount.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setMinutes((m) => {
        const next = m + PLAY_SIMSEC_PER_TICK * (PLAY_INTERVAL_MS / 1000) * 60;
        return next >= 1435 ? 0 : Math.round(next / 5) * 5;
      });
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing]);

  return (
    <div className="app">
      <MapView ref={mapRef} buildings={buildings} />
      <div className="controls">
        <DatePicker value={ymd} onChange={setYmd} />
        <PlayButton playing={playing} onToggle={() => setPlaying((p) => !p)} />
        <TimeSlider
          minutes={minutes}
          onChange={setMinutes}
          sunriseMinutes={sunriseMin}
          sunsetMinutes={sunsetMin}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span className="time-readout">{formatClock(minutes)}</span>
          <SunReadout sunPos={sunPos} />
          <span className="sun-readout">
            {status === "loading"
              ? "loading buildings…"
              : status === "error"
              ? `error: ${error}`
              : `${buildings?.length ?? 0} buildings (${source})`}
          </span>
        </div>
      </div>
    </div>
  );
}
