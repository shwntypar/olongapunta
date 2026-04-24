import React from 'react'
import { Map } from "@/components/ui/map";

const dashboard = () => {
  return (
    <div className="h-screen w-full">
      <Map center={[-74.006, 40.7128]} zoom={12} />
    </div>
  )
}

export default dashboard
