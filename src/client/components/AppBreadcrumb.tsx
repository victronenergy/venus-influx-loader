import React from "react"
import { useLocation } from "react-router-dom"

import routes, { type AppRoute } from "../routes"

import { CBreadcrumb, CBreadcrumbItem } from "@coreui/react"

interface Breadcrumb {
  pathname: string
  name: string
  active: boolean
}

const AppBreadcrumb = () => {
  const currentLocation = useLocation().pathname

  const getRouteName = (pathname: string, routes: AppRoute[]) => {
    const currentRoute = routes.find((route) => route.path === pathname)
    return currentRoute ? currentRoute.name : false
  }

  const getBreadcrumbs = (location: string) => {
    const breadcrumbs: Breadcrumb[] = []
    location.split("/").reduce((prev, curr, index, array) => {
      const currentPathname = `${prev}/${curr}`
      const routeName = getRouteName(currentPathname, routes)
      routeName &&
        breadcrumbs.push({
          pathname: currentPathname,
          name: routeName,
          active: index + 1 === array.length ? true : false,
        })
      return currentPathname
    })
    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs(currentLocation)

  return (
    <CBreadcrumb className="my-0">
      <CBreadcrumbItem href="/">Home</CBreadcrumbItem>
      {breadcrumbs.map((breadcrumb, index) => {
        return (
          <CBreadcrumbItem {...(breadcrumb.active ? { active: true } : { href: breadcrumb.pathname })} key={index}>
            {breadcrumb.name}
          </CBreadcrumbItem>
        )
      })}
    </CBreadcrumb>
  )
}

export default React.memo(AppBreadcrumb)
