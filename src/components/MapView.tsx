import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";

interface MapViewProps {
  location: {
    lat: number;
    lng: number;
  };
}

const MapView = ({ location }: MapViewProps) => {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center">
          <MapPin className="w-4 h-4 mr-2" />
          GPS Location
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative w-full h-64 bg-muted rounded-lg overflow-hidden">
          {/* Mock map visualization - In production, integrate with Mapbox or Google Maps */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-primary mx-auto mb-3" />
              <div className="text-sm font-medium text-foreground">
                Lat: {location.lat.toFixed(4)}
              </div>
              <div className="text-sm font-medium text-foreground">
                Lng: {location.lng.toFixed(4)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Live tracking active
              </p>
            </div>
          </div>
          {/* Simulated map grid */}
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MapView;
