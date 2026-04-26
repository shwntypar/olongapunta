import { ArrowUpRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function RouteBadge() {
  const routes = [
    { id: 1, name: "Route 1" },
    { id: 2, name: "Route 2" },
    { id: 3, name: "Route 3" },
  ];

  return (
    <div className="flex gap-2 flex-nowrap"> {/* Container for multiple badges */}
      {routes.map((route) => (
        <Badge key={route.id} asChild>
          <a href={`#${route.name.toLowerCase().replace(/\s+/g, '-')}`}>
            {route.name} <ArrowUpRightIcon data-icon="inline-end" />
          </a>
        </Badge>
      ))}
    </div>
  );
}