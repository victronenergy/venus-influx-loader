import React, { Suspense } from "react"
import { useDispatch } from "react-redux"
import { HashRouter, Route, Routes } from "react-router-dom"
import "./scss/style.scss"

import { openServerEventsConnection } from "./actions"

const loading = (
  <div className="pt-3 text-center">
    <div className="sk-spinner sk-spinner-pulse" />
  </div>
)

// Containers
const DefaultLayout = React.lazy(() => import("./layout/DefaultLayout"))

function App() {
  // TODO: move openServerEventsConnection somplace else
  // TODO: from actions.js and clean up store.js and generic dispatch
  const dispatch = useDispatch()
  openServerEventsConnection(dispatch)

  return (
    <HashRouter>
      <Suspense fallback={loading}>
        <Routes>
          <Route path="*" name="Home" element={<DefaultLayout />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}

export default App
