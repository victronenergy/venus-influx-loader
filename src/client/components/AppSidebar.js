import React from "react"
import { useSelector, useDispatch } from "react-redux"

import { CSidebar, CSidebarHeader, CSidebarBrand, CImage } from "@coreui/react"

import logo from "../public/img/victron-logo-footer.svg"

import { AppSidebarNav } from "./AppSidebarNav"

// sidebar nav config
import navigation from "../navigation"

const AppSidebar = () => {
  const dispatch = useDispatch()
  const sidebarShow = useSelector((state) => state.sidebarShow)
  const editSettings = useSelector((state) => state.editSettings)

  return (
    <CSidebar
      colorScheme="dark"
      position="fixed"
      visible={sidebarShow}
      onVisibleChange={(visible) => {
        dispatch({ type: "set", sidebarShow: visible })
      }}
    >
      <CSidebarHeader className="border-bottom px-4">
        <CSidebarBrand to="/">
          <CImage src={logo} width="100%" className="sidebar-brand-full" />
          <CImage src={logo} width="100%" className="sidebar-brand-narrow" />
        </CSidebarBrand>
      </CSidebarHeader>
      <AppSidebarNav items={navigation(editSettings)} />
    </CSidebar>
  )
}

export default React.memo(AppSidebar)
