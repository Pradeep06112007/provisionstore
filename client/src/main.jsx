import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./authcontext.jsx";
import { CartProvider } from "./cartcontext.jsx";
import App from "./App.jsx";
import CustomerLogin from "./pages/CustomerLogin.jsx";
import ProductDetails from "./pages/ProductDetails.jsx";
import SearchResults from "./pages/SearchResults.jsx";
import Admin from "./admin.jsx";
import "./index.css";

function ProtectedCustomerRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function CartRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return (
    <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
      <h2>Your FreshMart Cart</h2>
      <p>Continue shopping or return to the storefront to manage your items.</p>
      <a href="/">← Back to Store</a>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedCustomerRoute>
                  <App />
                </ProtectedCustomerRoute>
              }
            />
            <Route path="/login" element={<CustomerLogin />} />
            <Route
              path="/search"
              element={
                <ProtectedCustomerRoute>
                  <SearchResults />
                </ProtectedCustomerRoute>
              }
            />
            <Route path="/cart" element={<CartRoute />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  </StrictMode>
);