"use client";

import { useTheme } from "@/app/contexts/ThemeContext";

const Footer = () => {
  const { isDarkMode } = useTheme();
  
  return (
    <footer className="border-t border-border py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img
              src={isDarkMode ? "./dark.png" : "./light.png"}
              alt="SimplSEO Logo"
              className="rounded-md"
              style={{ width: '150px', height: 'auto' }}
            />
          </div>
          
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SimplSEO. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

