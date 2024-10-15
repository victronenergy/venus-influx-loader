import CIcon from "@coreui/icons-react"
import { cilChartLine, cilSettings, cilSpeedometer, cilHistory } from "@coreui/icons"
import { CNavGroup, CNavItem } from "@coreui/react"

interface NavigationProps {
  showEditDiscoverySettings: boolean
  showEditVRMSettings: boolean
  showEditManualSettings: boolean
  showEditSecuritySettings: boolean
  showEditInfluxDBSettings: boolean
}

const Navigation = ({
  showEditDiscoverySettings,
  showEditVRMSettings,
  showEditManualSettings,
  showEditSecuritySettings,
  showEditInfluxDBSettings,
}: NavigationProps) => [
  {
    component: CNavItem,
    name: "Dashboard",
    to: "/dashboard",
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },
  {
    component: CNavGroup,
    name: "Settings",
    to: "/settings",
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
    items: [
      showEditDiscoverySettings && {
        component: CNavItem,
        name: "Discovery",
        to: "/settings/discovery",
      },
      showEditVRMSettings && {
        component: CNavItem,
        name: "VRM",
        to: "/settings/VRM",
      },
      showEditManualSettings && {
        component: CNavItem,
        name: "Manual",
        to: "/settings/manual",
      },
      showEditInfluxDBSettings && {
        component: CNavItem,
        name: "InfluxDB",
        to: "/settings/influxdb",
      },
      showEditSecuritySettings && {
        component: CNavItem,
        name: "Security",
        to: "/settings/security",
      },
    ].filter(Boolean),
  },
  {
    component: CNavItem,
    name: "Troubleshooting",
    to: "/troubleshooting",
    icon: <CIcon icon={cilHistory} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: "Grafana",
    to: `http://${window.location.hostname}:3000/`,
    icon: <CIcon icon={cilChartLine} customClassName="nav-icon" />,
  },
]

export default Navigation
