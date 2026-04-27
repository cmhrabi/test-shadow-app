export default function SunReadout({ sunPos }) {
  if (!sunPos) return <span className="sun-readout">sun: —</span>;
  const azDeg = (((sunPos.azimuth * 180) / Math.PI + 180) % 360).toFixed(1);
  const altDeg = ((sunPos.altitude * 180) / Math.PI).toFixed(1);
  return (
    <span className="sun-readout">
      sun az {azDeg}° • alt {altDeg}°
    </span>
  );
}
