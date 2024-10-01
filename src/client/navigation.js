import CIcon from '@coreui/icons-react'
import {
  cilChartLine,
  cilSettings,
  cilSpeedometer,
  cilHistory,
} from '@coreui/icons'
import { CNavGroup, CNavItem } from '@coreui/react'

const navigation = [
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },
  {
    component: CNavGroup,
    name: 'Settings',
    to: '/settings',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Discovery',
        to: '/settings/discovery',
      },
      {
        component: CNavItem,
        name: 'VRM',
        to: '/settings/VRM',
      },
      {
        component: CNavItem,
        name: 'Manual',
        to: '/settings/manual',
      },
      {
        component: CNavItem,
        name: 'InfluxDB',
        to: '/settings/influxdb',
      },
      {
        component: CNavItem,
        name: 'Security',
        to: '/settings/security',
      },
    ],
  },
  {
    component: CNavItem,
    name: 'Troubleshooting',
    to: '/troubleshooting',
    icon: <CIcon icon={cilHistory} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Grafana',
    to: `http://${window.location.hostname}:3000/`,
    icon: <CIcon icon={cilChartLine} customClassName="nav-icon" />,
  },
]

export default navigation
