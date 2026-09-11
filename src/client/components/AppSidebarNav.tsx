import React from "react"
import { NavLink } from "react-router-dom"

import { CBadge, CNavLink, CSidebarNav } from "@coreui/react"

export interface AppSidebarNavBadge {
  color: string
  text: string
}

export interface AppSidebarNavItem {
  component: React.ElementType
  name: string
  icon?: React.ReactNode
  badge?: AppSidebarNavBadge
  to?: string
  href?: string
  target?: string
  items?: AppSidebarNavItem[]
}

export interface AppSidebarNavProps {
  items: AppSidebarNavItem[]
}

export const AppSidebarNav = ({ items }: AppSidebarNavProps) => {
  const navLink = (name: string, icon?: React.ReactNode, badge?: AppSidebarNavBadge, indent = false) => {
    return (
      <>
        {icon
          ? icon
          : indent && (
              <span className="nav-icon">
                <span className="nav-icon-bullet"></span>
              </span>
            )}
        {name && name}
        {badge && (
          <CBadge color={badge.color} className="ms-auto">
            {badge.text}
          </CBadge>
        )}
      </>
    )
  }

  const navItem = (item: AppSidebarNavItem, index: number, indent = false) => {
    const { component, name, badge, icon, ...rest } = item
    const Component = component
    return (
      <Component as="div" key={index}>
        {rest.to || rest.href ? (
          <CNavLink {...(rest.to && { as: NavLink })} {...rest}>
            {navLink(name, icon, badge, indent)}
          </CNavLink>
        ) : (
          navLink(name, icon, badge, indent)
        )}
      </Component>
    )
  }

  const navGroup = (item: AppSidebarNavItem, index: number) => {
    const { component, name, icon, ...rest } = item
    const Component = component
    return (
      <Component compact as="div" key={index} toggler={navLink(name, icon)} {...rest}>
        {item.items?.map((item, index) => (item.items ? navGroup(item, index) : navItem(item, index, true)))}
      </Component>
    )
  }

  return (
    <CSidebarNav>
      {items && items.map((item, index) => (item.items ? navGroup(item, index) : navItem(item, index)))}
    </CSidebarNav>
  )
}
