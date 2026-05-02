import { ArrowUpRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Color, ColorType } from "maplibre-gl";

export function RouteBadge() {
  const routes = [
    { id: 1, name: "Blue", color: '#0000ff' },
    { id: 2, name: "Red", color: '#ff0000' },
    { id: 3, name: "Yellow", color: '#ffff00' },
  ];

  return (
    <div className="flex gap-2 flex-nowrap"> {/* Container for multiple badges */}
      {routes.map((route) => (
        <Badge key={route.id} asChild>
          <a href={`#${route.name.toLowerCase().replace(/\s+/g, '-')}`}>
            {route.name} <div style={{ backgroundColor: route.color }} className="w-3 h-3 rounded-full ml-2" />
          </a>
        </Badge>
      ))}
    </div>
  );
}