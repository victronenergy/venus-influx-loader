import React from 'react'

const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))
const Discovery = React.lazy(() => import('./views/settings/Discovery'))
const VRM = React.lazy(() => import('./views/settings/VRM'))
const Manual = React.lazy(() => import('./views/settings/Manual'))
const InfluxDB = React.lazy(() => import('./views/settings/InfluxDB'))
const Security = React.lazy(() => import('./views/settings/Security'))
const Troubleshooting = React.lazy(
  () => import('./views/troubleshooting/Troubleshooting'),
)

const routes = [
  { path: '/', name: 'Home', exact: true },
  { path: '/dashboard', name: 'Dashboard', element: Dashboard },
  { path: '/settings/discovery', name: 'Discovery', element: Discovery },
  { path: '/settings/vrm', name: 'VRM', element: VRM },
  { path: '/settings/manual', name: 'Manual', element: Manual },
  { path: '/settings/influxdb', name: 'InfluxDB', element: InfluxDB },
  { path: '/settings/security', name: 'Security', element: Security },
  {
    path: '/troubleshooting',
    name: 'Troubleshooting',
    element: Troubleshooting,
  },
]

export default routes
