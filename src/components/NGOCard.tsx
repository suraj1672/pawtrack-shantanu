import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, PawPrint } from "lucide-react";
import type { NGO } from "@/types";
import { useNavigate } from "react-router-dom";

interface NGOCardProps {
  ngo: NGO;
}

const NGOCard = ({ ngo }: NGOCardProps) => {
  const navigate = useNavigate();

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 border-border/50">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
            <img 
              src={ngo.logoUrl} 
              alt={ngo.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-foreground mb-1 truncate">
              {ngo.name}
            </h3>
            <div className="flex items-center text-sm text-muted-foreground mb-3">
              <MapPin className="w-3.5 h-3.5 mr-1" />
              <span className="truncate">{ngo.location}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center text-sm font-medium text-primary">
                <PawPrint className="w-4 h-4 mr-1.5" />
                <span>{ngo.dogsCount} Dogs</span>
              </div>
              <Button 
                size="sm"
                onClick={() => navigate(`/ngo/${ngo.id}`)}
                className="bg-primary hover:bg-primary/90"
              >
                View Dogs
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NGOCard;
