import React from "react"
import { useSelector, useDispatch } from "react-redux"

import { CSidebar, CSidebarHeader, CSidebarBrand, CImage } from "@coreui/react"

// @ts-ignore
import logo from "../public/img/victron-logo-footer.svg"

import { AppSidebarNav } from "./AppSidebarNav"

// sidebar nav config
import Navigation from "../Navigation"
import { AppState } from "../store"

const AppSidebar = () => {
  const dispatch = useDispatch()
  const showSidebar = useSelector((state: AppState) => state.showSidebar)
  const uiSettings = useSelector((state: AppState) => state.uiSettings)

  return (
    <CSidebar
      colorScheme="dark"
      position="fixed"
      visible={showSidebar}
      onVisibleChange={(visible) => {
        dispatch({ type: "set", showSidebar: visible })
      }}
    >
      <CSidebarHeader className="border-bottom px-4">
        <CSidebarBrand href="/">
          <CImage src={logo} width="100%" className="sidebar-brand-full" />
          <CImage src={logo} width="100%" className="sidebar-brand-narrow" />
        </CSidebarBrand>
      </CSidebarHeader>
      <AppSidebarNav items={Navigation(uiSettings)} />
    </CSidebar>
  )
}

export default React.memo(AppSidebar)
