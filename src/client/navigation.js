import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilChartLine,
  cilSettings,
  cilSpeedometer,
  cilHistory
} from '@coreui/icons'
import { CNavGroup, CNavItem, CNavTitle } from '@coreui/react'

const navigation = [
  {
    component: CNavItem,
    name: 'Dashboard',
    href: '#/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName='nav-icon' />
  },
  {
    component: CNavGroup,
    name: 'Settings',
    href: '#/settings',
    icon: <CIcon icon={cilSettings} customClassName='nav-icon' />,
    items: [
      {
        component: CNavItem,
        name: 'Discovery',
        href: '#/settings/discovery'
      },
      {
        component: CNavItem,
        name: 'VRM',
        href: '#/settings/VRM'
      },
      {
        component: CNavItem,
        name: 'Manual',
        href: '#/settings/manual'
      },
      {
        component: CNavItem,
        name: 'InfluxDB',
        href: '#/settings/influxdb'
      },
      {
        component: CNavItem,
        name: 'Security',
        href: '#/settings/security'
      }
    ]
  },
  {
    component: CNavItem,
    name: 'Troubleshooting',
    href: '#/troubleshooting',
    icon: <CIcon icon={cilHistory} customClassName='nav-icon' />
  },
  {
    component: CNavItem,
    name: 'Grafana',
    href: `http://${window.location.hostname}:3000/`,
    icon: <CIcon icon={cilChartLine} customClassName='nav-icon' />
  }
]

export default navigation
