import { Badge } from "@/components/ui/badge";
import { Circle, AlertTriangle } from "lucide-react";

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'warning' | 'critical';
  className?: string;
}

const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const variants = {
    online: { variant: 'default' as const, label: 'Online', color: 'text-success', bgColor: 'bg-success/10' },
    offline: { variant: 'secondary' as const, label: 'Offline', color: 'text-muted-foreground', bgColor: '' },
    warning: { variant: 'default' as const, label: 'Warning', color: 'text-warning', bgColor: 'bg-warning/10' },
    critical: { variant: 'destructive' as const, label: 'Critical', color: 'text-destructive-foreground', bgColor: '' }
  };

  const config = variants[status];

  return (
    <Badge variant={config.variant} className={`${config.bgColor} ${className}`}>
      {status === 'critical' ? (
        <AlertTriangle className="w-3 h-3 mr-1.5 animate-pulse" />
      ) : (
        <Circle className={`w-2 h-2 mr-1.5 fill-current ${config.color}`} />
      )}
      {config.label}
    </Badge>
  );
};

export default StatusBadge;
