import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

const pinIcon = L.divIcon({
  html: '<span style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">📍</span>',
  className: 'livemap-emoji-icon',
  iconSize: [28, 28],
  iconAnchor: [14, 26],
})

const DEFAULT_CENTER = [12.9716, 77.5946] // Bengaluru — used whenever no location has been picked yet

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Tap/click anywhere on the map to drop the pin there. Used wherever we
// need real coordinates for the tracking simulator (restaurant location,
// delivery address) without paying for a geocoding API.
export default function LocationPicker({ lat, lng, onChange, height = 220 }) {
  const center = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER

  return (
    <div style={{ height, borderRadius: 12, overflow: 'hidden' }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={onChange} />
        {lat != null && lng != null && <Marker position={[lat, lng]} icon={pinIcon} />}
      </MapContainer>
    </div>
  )
}
