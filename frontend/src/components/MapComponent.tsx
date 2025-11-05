import { useEffect, useState, Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface POI {
  id: string;
  name: string;
  address: string;
  category: string;
  subcategory: string;
  lat: number;
  lon: number;
  distance: number | null;
  workingHours?: string;
  why?: string;
  time?: string;
  action?: string;
  geocoded?: boolean;
}

interface RoutePoint {
  lat: number;
  lon: number;
  name: string;
}

interface MapComponentProps {
  userLocation: { latitude: number; longitude: number } | null;
  pois: POI[];
  route?: RoutePoint[];
}

// Component to update map view when location changes
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

// Custom icon for user location
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom icon for POI
const poiIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function MapComponent({ userLocation, pois, route = [] }: MapComponentProps) {
  const [selectedPoi, setSelectedPoi] = useState<string | null>(null);
  
  console.log('🗺️ MapComponent render:', { 
    userLocation, 
    poisCount: pois.length, 
    routePoints: route.length,
    pois: pois.map(p => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon }))
  });
  
  // Default center (Astana)
  const defaultCenter: [number, number] = [51.1694, 71.4491];
  const center: [number, number] = userLocation 
    ? [userLocation.latitude, userLocation.longitude] 
    : defaultCenter;

  // Create route from user location to selected POI
  const getRoutePoints = (poiId: string): [number, number][] => {
    if (!userLocation || !selectedPoi || selectedPoi !== poiId) return [];
    
    const poi = pois.find(p => p.id === poiId);
    if (!poi) return [];
    
    return [
      [userLocation.latitude, userLocation.longitude],
      [poi.lat, poi.lon]
    ];
  };

  // Convert full route to Leaflet format
  const fullRoutePoints: [number, number][] = route.map(point => [point.lat, point.lon]);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-slate-200">
      <MapContainer
        center={center}
        zoom={userLocation ? 13 : 11}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <ChangeView center={center} zoom={userLocation ? 13 : 11} />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User location marker */}
        {userLocation && (
          <>
            <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon}>
              <Popup>
                <div className="text-center">
                  <p className="font-semibold text-blue-600">Вы здесь</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
                  </p>
                </div>
              </Popup>
            </Marker>
            
            {/* Circle showing search radius */}
            <Circle
              center={[userLocation.latitude, userLocation.longitude]}
              radius={5000}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                weight: 2,
                dashArray: '5, 10'
              }}
            />
          </>
        )}

        {/* Full route polyline (if available) */}
        {fullRoutePoints.length > 1 && (
          <>
            {/* Shadow/outline for better visibility */}
            <Polyline
              positions={fullRoutePoints}
              pathOptions={{
                color: '#065f46',
                weight: 7,
                opacity: 0.4,
                dashArray: '10, 5'
              }}
            />
            {/* Main route line */}
            <Polyline
              positions={fullRoutePoints}
              pathOptions={{
                color: '#10b981',
                weight: 5,
                opacity: 0.9,
                dashArray: '10, 5'
              }}
            />
          </>
        )}

        {/* POI markers */}
        {pois.map((poi) => {
          const routePoints = getRoutePoints(poi.id);
          
          return (
            <Fragment key={poi.id}>
              {/* Route line if POI is selected (individual) */}
              {routePoints.length > 0 && (
                <Polyline
                  positions={routePoints}
                  pathOptions={{
                    color: '#3b82f6',
                    weight: 3,
                    opacity: 0.7,
                    dashArray: '10, 10'
                  }}
                />
              )}
              
              {/* POI Marker */}
              <Marker
                position={[poi.lat, poi.lon]}
                icon={poiIcon}
                eventHandlers={{
                  click: () => setSelectedPoi(poi.id === selectedPoi ? null : poi.id)
                }}
              >
                <Popup maxWidth={350}>
                  <div className="p-2">
                    <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                      {poi.name}
                      {poi.geocoded && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          AI ✨
                        </span>
                      )}
                    </h3>
                    <div className="space-y-1 text-sm">
                      <p className="text-slate-600">
                        <span className="font-medium">📍</span> {poi.address || 'Адрес не указан'}
                      </p>
                      <p className="text-slate-600">
                        <span className="font-medium">🏷️</span> {poi.category}
                      </p>
                      {poi.distance && (
                        <p className="text-blue-600 font-medium">
                          <span className="font-medium">📏</span> {poi.distance} км от вас
                        </p>
                      )}
                      {poi.workingHours && (
                        <p className="text-slate-600 text-xs">
                          <span className="font-medium">🕐</span> {poi.workingHours}
                        </p>
                      )}
                      {poi.why && (
                        <p className="text-slate-700 text-sm mt-2 pt-2 border-t border-slate-200">
                          <span className="font-medium">💡 Почему:</span> {poi.why}
                        </p>
                      )}
                      {poi.time && (
                        <p className="text-slate-600 text-xs">
                          <span className="font-medium">⏱</span> {poi.time}
                        </p>
                      )}
                      {poi.action && (
                        <p className="text-slate-700 text-sm">
                          <span className="font-medium">✨ Что делать:</span> {poi.action}
                        </p>
                      )}
                      {userLocation && (
                        <button
                          onClick={() => setSelectedPoi(poi.id === selectedPoi ? null : poi.id)}
                          className="mt-2 w-full px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          {selectedPoi === poi.id ? '✕ Скрыть маршрут' : '🗺️ Показать маршрут'}
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
