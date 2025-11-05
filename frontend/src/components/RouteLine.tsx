import { Polyline } from 'react-leaflet';

interface RouteLineProps {
  points: [number, number][];
}

export default function RouteLine({ points }: RouteLineProps) {
  if (points.length < 2) return null;

  return (
    <Polyline
      positions={points}
      pathOptions={{
        color: '#3b82f6',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
      }}
    />
  );
}
