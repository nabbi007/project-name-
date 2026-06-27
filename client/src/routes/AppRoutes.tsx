import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/shared/ProtectedRoute';
import { Spinner } from '../components/shared/Spinner';

// Layouts
import AgentLayout from '../layouts/AgentLayout';
import AdminLayout from '../layouts/AdminLayout';
import BuyerLayout from '../layouts/BuyerLayout';

// ─── Auth Pages (DEV 3 owns) ────────────────────────────────
const Login = lazy(() => import('../pages/auth/Login'));
const Register = lazy(() => import('../pages/auth/Register'));
const Unauthorized = lazy(() => import('../pages/auth/Unauthorized'));

// ─── Marketplace Pages (DEV 3 owns) ─────────────────────────
const MarketplaceHome = lazy(() => import('../pages/marketplace/MarketplaceHome'));
const ProductCatalogue = lazy(() => import('../pages/marketplace/ProductCatalogue'));
const ProductDetails = lazy(() => import('../pages/marketplace/ProductDetails'));
const PublicFarmerProfile = lazy(() => import('../pages/marketplace/PublicFarmerProfile'));

// ─── Buyer Pages (DEV 3 owns) ───────────────────────────────
// const Cart = lazy(() => import('../pages/buyer/Cart'));
// const Checkout = lazy(() => import('../pages/buyer/Checkout'));
// const BuyerOrders = lazy(() => import('../pages/buyer/BuyerOrders'));

// ─── Agent Pages (DEV 2 owns) ───────────────────────────────
// const AgentDashboard = lazy(() => import('../pages/agent/AgentDashboard'));
// const FarmerList = lazy(() => import('../pages/agent/FarmerList'));
// const FarmerRegister = lazy(() => import('../pages/agent/FarmerRegister'));
// const FarmerProfile = lazy(() => import('../pages/agent/FarmerProfile'));
// const VoiceListingWizard = lazy(() => import('../pages/agent/VoiceListingWizard'));
// const ListingsList = lazy(() => import('../pages/agent/ListingsList'));
// const AgentOrders = lazy(() => import('../pages/agent/AgentOrders'));

// ─── Admin Pages (DEV 2 owns) ───────────────────────────────
// const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
// const AgentManagement = lazy(() => import('../pages/admin/AgentManagement'));
// const ListingModeration = lazy(() => import('../pages/admin/ListingModeration'));
// const AIMonitoring = lazy(() => import('../pages/admin/AIMonitoring'));
// const ComplaintManagement = lazy(() => import('../pages/admin/ComplaintManagement'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Spinner size="lg" />
  </div>
);

const AppRoutes: React.FC = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* ══════════════════════════════════════════════════════════
       *  PUBLIC ROUTES — no auth required
       *  Owner: DEV 3
       * ══════════════════════════════════════════════════════════ */}
      <Route path="/" element={<MarketplaceHome />} />
      <Route path="/marketplace" element={<ProductCatalogue />} />
      <Route path="/products/:listingId" element={<ProductDetails />} />
      <Route path="/farmers/:farmerId" element={<PublicFarmerProfile />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Cart & Checkout — public browsing, auth required at checkout
       *  Owner: DEV 3 */}
      {/* <Route path="/cart" element={<Cart />} /> */}
      {/* <Route path="/checkout" element={<ProtectedRoute requiredRole="BUYER"><Checkout /></ProtectedRoute>} /> */}

      {/* ══════════════════════════════════════════════════════════
       *  AGENT ROUTES — FIELD_AGENT role required
       *  Owner: DEV 2
       *  Uncomment as Dev 2 builds pages
       * ══════════════════════════════════════════════════════════ */}
      <Route
        path="/agent/*"
        element={
          <ProtectedRoute requiredRole="FIELD_AGENT">
            <AgentLayout />
          </ProtectedRoute>
        }
      >
        {/* DEV 2: Add agent sub-routes here */}
        {/* <Route path="dashboard" element={<AgentDashboard />} /> */}
        {/* <Route path="farmers" element={<FarmerList />} /> */}
        {/* <Route path="farmers/new" element={<FarmerRegister />} /> */}
        {/* <Route path="farmers/:farmerId" element={<FarmerProfile />} /> */}
        {/* <Route path="farmers/:farmerId/create-listing" element={<VoiceListingWizard />} /> */}
        {/* <Route path="listings" element={<ListingsList />} /> */}
        {/* <Route path="orders" element={<AgentOrders />} /> */}
      </Route>

      {/* ══════════════════════════════════════════════════════════
       *  ADMIN ROUTES — ADMIN role required
       *  Owner: DEV 2
       *  Uncomment as Dev 2 builds pages
       * ══════════════════════════════════════════════════════════ */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        {/* DEV 2: Add admin sub-routes here */}
        {/* <Route path="dashboard" element={<AdminDashboard />} /> */}
        {/* <Route path="agents" element={<AgentManagement />} /> */}
        {/* <Route path="listings" element={<ListingModeration />} /> */}
        {/* <Route path="ai-monitoring" element={<AIMonitoring />} /> */}
        {/* <Route path="complaints" element={<ComplaintManagement />} /> */}
      </Route>

      {/* ══════════════════════════════════════════════════════════
       *  BUYER ROUTES — BUYER role required
       *  Owner: DEV 3
       *  Uncomment as pages are built
       * ══════════════════════════════════════════════════════════ */}
      <Route
        path="/buyer/*"
        element={
          <ProtectedRoute requiredRole="BUYER">
            <BuyerLayout />
          </ProtectedRoute>
        }
      >
        {/* DEV 3: Add buyer sub-routes here */}
        {/* <Route path="orders" element={<BuyerOrders />} /> */}
      </Route>
    </Routes>
  </Suspense>
);

export default AppRoutes;
