import React from "react";
import { SearchBar } from "@/features/map/presentation/searchbar";
import { AvatarDropdown } from "@/features/map/presentation/buttons";
import { RouteBadge } from "@/features/map/presentation/route-badge";
import  MapComponent  from "@/features/map/presentation/map";

const page = () => {
  return (
    <div>
      <div className="relative object-top z-10" >
        <div className="absolute flex flex-nowrap items-center gap-2 top-3 left-3">
          <SearchBar />
          <RouteBadge />
        </div>
        <div className="absolute top-3 right-3">
          <AvatarDropdown />
        </div>
      </div>
      <MapComponent />
    </div>
  );
};

export default page;
