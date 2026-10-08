"use client";
import { useState, useEffect } from "react";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ChatWidget from "@/components/ChatWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});



export default function RootLayout({ children }) {
  const [theme, setTheme] = useState("light");

  // On mount, check localStorage or system preference

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved) {
      setTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);


  // Update the <html> class when theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme); // remember preference
  }, [theme]);



  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");


  return (
    <html lang="en">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/all.min.css"></link>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
       

        {children} <ChatWidget />
      </body>
    </html>
  );
}
