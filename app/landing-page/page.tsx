import Link from 'next/link'
import React from 'react'

const LandingPage = () => {
  return (
    <div>
      <p>This is the Landing Page</p>
      <Link href="./dashboard-map">Go to Maps</Link>
    </div>
  )
}

export default LandingPage
