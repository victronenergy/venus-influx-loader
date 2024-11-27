import React, { Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { CContainer, CSpinner } from "@coreui/react"

// routes config
import routes from "../routes"

const AppContent = () => {
  return (
    <CContainer className="flex-grow-1 d-flex flex-column px-4 pb-4" lg>
      <Suspense fallback={<CSpinner color="primary" />}>
        <Routes>
          {routes.map((route, idx) => {
            return route.element && <Route key={idx} path={route.path} element={<route.element />} />
          })}
          <Route path="/" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </Suspense>
    </CContainer>
  )
}

export default React.memo(AppContent)
