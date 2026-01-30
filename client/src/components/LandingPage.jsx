import React from "react";
import { Link } from "react-router-dom";
import "./LandingPage.css";

const LandingPage = () => {
  return (
    <div className="landing-container">
      <header className="landing-header">
        <h1>Welcome to RecycList</h1>
        <p>Smart Waste Management for a Greener Tomorrow</p>
      </header>
      <main className="landing-main">
        <Link to="/login" className="landing-btn">Get Started</Link>
      </main>
      <footer className="landing-footer">
        <small>&copy; {new Date().getFullYear()} RecycList. All rights reserved.</small>
      </footer>
    </div>
  );
};

export default LandingPage;
