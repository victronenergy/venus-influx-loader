import { useSelector, useDispatch } from "react-redux"
import { CContainer, CHeader, CHeaderBrand, CHeaderNav, CHeaderToggler } from "@coreui/react"
import CIcon from "@coreui/icons-react"
import { cilMenu } from "@coreui/icons"

import { AppBreadcrumb } from "./index"
import { AppState } from "../store"

const AppHeader = () => {
  const dispatch = useDispatch()
  const sidebarShow = useSelector((state: AppState) => state.sidebarShow)

  return (
    <CHeader position="sticky" className="mb-4 p-0">
      <CContainer className="border-bottom px-4" fluid>
        <CHeaderToggler className="ps-1" onClick={() => dispatch({ type: "set", sidebarShow: !sidebarShow })}>
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>
        <CHeaderBrand className="mx-auto d-md-none" href="/"></CHeaderBrand>
        <CHeaderNav className="d-none d-md-flex me-auto"></CHeaderNav>
      </CContainer>
      <CContainer fluid>
        <AppBreadcrumb />
      </CContainer>
    </CHeader>
  )
}

export default AppHeader
