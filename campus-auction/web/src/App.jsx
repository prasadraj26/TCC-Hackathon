import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Import CSS Stylesheets
import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/auction.css';
import './styles/pages.css';

// Components
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import DemoModeBanner from './components/common/DemoModeBanner';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AuctionDetails from './pages/AuctionDetails';
import CreateListing from './pages/CreateListing';
import MyAuctions from './pages/MyAuctions';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-layout">
          <DemoModeBanner />
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/auctions/:id" element={<AuctionDetails />} />
              <Route path="/create-listing" element={<CreateListing />} />
              <Route path="/my-auctions" element={<MyAuctions initialTab="listings" />} />
              <Route path="/my-bids" element={<MyAuctions initialTab="bids" />} />
              <Route path="/won-items" element={<MyAuctions initialTab="won" />} />
              <Route path="/auction-analytics" element={<MyAuctions initialTab="analytics" />} />
              <Route path="/analytics" element={<MyAuctions initialTab="analytics" />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
