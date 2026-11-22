import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CartProvider } from "./cartcontext.jsx";
import App from "./App.jsx";
import Cart from "./cart.jsx";
import Admin from "./admin.jsx";
import CustomerLogin from "./pages/CustomerLogin.jsx";
import "./index.css";

function StorefrontGate() {
  const token = localStorage.getItem("freshmart-customer-token");
  return token ? <App /> : <CustomerLogin />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<StorefrontGate />} />
          <Route path="/login" element={<CustomerLogin />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  </StrictMode>
);