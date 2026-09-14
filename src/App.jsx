import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext.jsx";

import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import Login from "./pages/Login.jsx";
import Listings from "./pages/Listings.jsx";
import ListingDetail from "./pages/ListingDetail.jsx";
import Rentals from "./pages/Rentals.jsx";
import RentalDetail from "./pages/RentalDetail.jsx";
import Projects from "./pages/Projects.jsx";
import ProjectDetail from "./pages/ProjectDetail.jsx";
import Favourites from "./pages/Favourites.jsx";
import Insights from "./pages/Insights.jsx";

function AppShell() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="*"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-[#f2f4f7]">
                  <Navbar />

                  <main>
                    <Routes>
                      <Route path="/" element={<Listings />} />

                      <Route path="/listings" element={<Listings />} />

                      <Route path="/listings/:id" element={<ListingDetail />} />

                      <Route path="/rentals" element={<Rentals />} />

                      <Route path="/rentals/:id" element={<RentalDetail />} />

                      <Route path="/projects" element={<Projects />} />

                      <Route path="/projects/:id" element={<ProjectDetail />} />

                      <Route path="/saved" element={<Favourites />} />

                      <Route path="/insights" element={<Insights />} />

                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default AppShell;