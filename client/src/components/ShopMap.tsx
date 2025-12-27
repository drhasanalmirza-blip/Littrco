import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
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
  selectedShopId?: number | null;
  onShopSelect?: (shopId: number) => void;
}

export function ShopMap({ height = "400px", selectedShopId, onShopSelect }: ShopMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
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
    if (!mapContainer.current) return;
    if (map.current) return;

    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      setMapError("Mapbox token not configured");
      return;
    }

    mapboxgl.accessToken = token;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-78.8, 43.0],
        zoom: 7,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.current.on("load", () => {
        setMapLoaded(true);
      });
    } catch (err) {
      setMapError("Failed to initialize map");
      console.error("Map init error:", err);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    const shopsWithCoords = shops.filter((s) => s.latitude && s.longitude);

    shopsWithCoords.forEach((shop) => {
      if (!shop.latitude || !shop.longitude) return;

      const el = document.createElement("div");
      el.className = "shop-marker";
      el.style.width = "32px";
      el.style.height = "32px";
      el.style.backgroundColor = selectedShopId === shop.id ? "#16a34a" : "#22c55e";
      el.style.borderRadius = "50%";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M19 7c.55 0 1 .45 1 1v10c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V8c0-.55.45-1 1-1h4l1.29-1.29A1 1 0 0 1 11 5h2a1 1 0 0 1 .71.29L15 7h4Z"/></svg>`;

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px;">
          <h3 style="font-weight: bold; margin: 0 0 4px 0;">${shop.name}</h3>
          <p style="margin: 0; font-size: 12px; color: #666;">${shop.address}</p>
          <p style="margin: 0; font-size: 12px; color: #666;">${shop.city}</p>
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([shop.longitude, shop.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      el.addEventListener("click", () => {
        if (onShopSelect) {
          onShopSelect(shop.id);
        }
      });

      markers.current.push(marker);
    });

    if (shopsWithCoords.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      shopsWithCoords.forEach((shop) => {
        if (shop.latitude && shop.longitude) {
          bounds.extend([shop.longitude, shop.latitude]);
        }
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 12 });
    }
  }, [shops, mapLoaded, selectedShopId, onShopSelect]);

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
          <h3 className="font-semibold text-gray-700 mb-1">Map Not Available</h3>
          <p className="text-sm text-gray-500">{mapError}</p>
          <div className="mt-4 text-left w-full max-w-md">
            <h4 className="font-medium text-gray-700 mb-2">Drop-off Locations:</h4>
            <ul className="space-y-2">
              {shops.map((shop) => (
                <li key={shop.id} className="flex items-center gap-2 text-sm text-gray-600" data-testid={`shop-list-item-${shop.id}`}>
                  <MapPin className="h-4 w-4 text-green-500" />
                  <span>{shop.name} - {shop.city}</span>
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
