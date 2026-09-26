import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Emoji markers instead of Leaflet's default pin (which needs bundled image
// assets that break under most bundlers) — also matches the emoji-driven
// visual language already used across the app (roles.js, dish thumbnails).
function emojiIcon(emoji) {
  return L.divIcon({
    html: `<span style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">${emoji}</span>`,
    className: 'livemap-emoji-icon',
    iconSize: [26, 26],
    iconAnchor: [13, 22],
  })
}

// Fits the map to all markers once, when the set of markers (not their
// positions) changes — avoids fighting the user's pan/zoom on every tick of
// a moving driver marker.
function FitBounds({ markers }) {
  const map = useMap()
  const key = markers.map((m) => m.id).join(',')

  useEffect(() => {
    if (markers.length === 0) return
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 15)
      return
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]))
    map.fitBounds(bounds, { padding: [40, 40] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return null
}

export default function LiveMap({ markers, height = 320 }) {
  const center = useMemo(() => {
    if (markers.length === 0) return [12.9716, 77.5946]
    return [markers[0].lat, markers[0].lng]
  }, [markers])

  return (
    <div style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds markers={markers} />
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={emojiIcon(m.emoji)}>
            {m.label && <Popup>{m.label}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
