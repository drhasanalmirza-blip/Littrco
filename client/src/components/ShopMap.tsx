import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader2 } from "lucide-react";

interface ShopLocation {
  id: number;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
}

interface ShopMapProps {
  height?: string;
}

const shopIcon = L.divIcon({
  className: "",
  html: `<div style="width:32px;height:32px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#16a34a"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

export function ShopMap({ height = "400px" }: ShopMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerGroup = useRef<L.LayerGroup | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const { data: shops = [], isLoading } = useQuery<ShopLocation[]>({
    queryKey: ["shop-locations"],
    queryFn: async () => {
      const res = await fetch("/api/shops/locations");
      if (!res.ok) throw new Error("Failed to load shop locations");
      return res.json();
    },
  });

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    try {
      mapRef.current = L.map(mapContainer.current, {
        center: [43.0, -77.6],
        zoom: 10,
        scrollWheelZoom: true,
      });

      markerGroup.current = L.layerGroup().addTo(mapRef.current);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapRef.current);
    } catch (err) {
      setMapError("Failed to initialize map");
      console.error("Map init error:", err);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerGroup.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerGroup.current) return;

    markerGroup.current.clearLayers();

    const shopsWithCoords = shops.filter((s) => s.latitude && s.longitude);

    shopsWithCoords.forEach((shop) => {
      if (!shop.latitude || !shop.longitude) return;

      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address + ", " + shop.city)}`;

      const marker = L.marker([shop.latitude, shop.longitude], { icon: shopIcon });

      marker.bindPopup(`
        <div style="padding:4px;min-width:160px;">
          <h3 style="font-weight:bold;margin:0 0 4px 0;font-size:14px;">${shop.name}</h3>
          <p style="margin:0 0 2px 0;font-size:12px;color:#666;">${shop.address}</p>
          <p style="margin:0 0 8px 0;font-size:12px;color:#666;">${shop.city}</p>
          <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#22c55e;color:white;padding:4px 12px;border-radius:6px;font-size:12px;text-decoration:none;font-weight:600;">Get Directions</a>
        </div>
      `);

      markerGroup.current!.addLayer(marker);
    });

    if (shopsWithCoords.length > 0) {
      const group = L.featureGroup(
        shopsWithCoords.map((s) => L.marker([s.latitude!, s.longitude!]))
      );
      mapRef.current.fitBounds(group.getBounds().pad(0.3));
    }
  }, [shops]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center" style={{ height }}>
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </CardContent>
      </Card>
    );
  }

  if (mapError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center text-center p-8" style={{ height }}>
          <MapPin className="h-12 w-12 text-gray-400 mb-3" />
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-1">Map Not Available</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{mapError}</p>
          <div className="text-left w-full max-w-md">
            <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">Drop-off Locations:</h4>
            <ul className="space-y-2">
              {shops.map((shop) => (
                <li key={shop.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300" data-testid={`shop-list-item-${shop.id}`}>
                  <MapPin className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address + ", " + shop.city)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-green-600 underline"
                  >
                    {shop.name} — {shop.address}, {shop.city}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-hidden rounded-lg">
        <div ref={mapContainer} style={{ height }} data-testid="shop-map" />
      </CardContent>
    </Card>
  );
}
