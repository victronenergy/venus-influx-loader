import React from "react"
import CIcon from "@coreui/icons-react"
import { cilChartLine, cilSettings, cilSpeedometer, cilHistory } from "@coreui/icons"
import { CNavGroup, CNavItem } from "@coreui/react"

interface NavigationProps {
  grafanaUrl: string
  showEditDiscoverySettings: boolean
  showEditVRMSettings: boolean
  showEditManualSettings: boolean
  showEditSecuritySettings: boolean
  showEditInfluxDBSettings: boolean
}

function interpolate(template: string, variables: any) {
  const templateFunction = new Function("variables", `return \`${template}\`;`)
  return templateFunction(variables)
}

const Navigation = ({
  grafanaUrl,
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
    href: interpolate(grafanaUrl, { window: window }),
    target: "_self",
    icon: <CIcon icon={cilChartLine} customClassName="nav-icon" />,
  },
]

export default Navigation
