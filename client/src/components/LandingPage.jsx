import React from "react";
import { Link } from "react-router-dom";

const LandingPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-cyan-100 to-teal-200">
      <header className="text-center mb-8">
        <h1 className="text-4xl text-teal-700 mb-2">Welcome to RecycList</h1>
        <p className="text-xl text-teal-900">Smart Waste Management for a Greener Tomorrow</p>
      </header>
      <main className="mb-8">
        <Link to="/login" className="inline-block px-8 py-3 bg-teal-700 text-white rounded-full text-lg no-underline transition-colors duration-200 hover:bg-teal-900">Get Started</Link>
      </main>
      <footer className="text-center text-gray-600 text-sm mt-auto pb-4">
        <small>&copy; {new Date().getFullYear()} RecycList. All rights reserved.</small>
      </footer>
    </div>
  );
};

export default LandingPage;
