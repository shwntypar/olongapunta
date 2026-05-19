import React from "react";
import { AvatarDropdown } from "@/features/map/presentation/buttons";
import  MapComponent  from "@/features/map/presentation/map";

const page = () => {
  return (
    <div>
      <div className="relative object-top z-10" >
        <div className="absolute top-3 right-3">
          <AvatarDropdown />
        </div>
      </div>
      <MapComponent />
    </div>
  );
};

export default page;
