import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";
import type { Dog } from "@/types";
import StatusBadge from "./StatusBadge";
import { useNavigate } from "react-router-dom";

interface DogCardProps {
  dog: Dog;
}

const DogCard = ({ dog }: DogCardProps) => {
  const navigate = useNavigate();

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 border-border/50">
      <div className="aspect-video relative overflow-hidden bg-muted">
        <img 
          src={dog.imageUrl} 
          alt={dog.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3">
          <StatusBadge status={dog.status} />
        </div>
      </div>
      <CardContent className="p-5">
        <h3 className="font-semibold text-lg text-foreground mb-1">
          {dog.name}
        </h3>
        <p className="text-sm text-muted-foreground mb-1">{dog.breed}</p>
        <p className="text-xs text-muted-foreground mb-4">
          Device: <span className="font-mono">{dog.deviceId}</span>
        </p>
        <Button 
          className="w-full bg-primary hover:bg-primary/90"
          onClick={() => navigate(`/dog/${dog.id}`)}
        >
          <Activity className="w-4 h-4 mr-2" />
          View Live Data
        </Button>
      </CardContent>
    </Card>
  );
};

export default DogCard;
