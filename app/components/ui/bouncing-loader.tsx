import React from "react";

interface BouncingLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const BouncingLoader: React.FC<BouncingLoaderProps> = ({ 
  size = "md", 
  className = "" 
}) => {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3", 
    lg: "w-4 h-4"
  };

  return (
    <div className={`flex items-center justify-center space-x-1 ${className}`}>
      <div 
        className={`${sizeClasses[size]} bg-[#00BF63] rounded-full animate-bounce`}
        style={{ animationDelay: '0ms' }}
      />
      <div 
        className={`${sizeClasses[size]} bg-[#00BF63] rounded-full animate-bounce`}
        style={{ animationDelay: '150ms' }}
      />
      <div 
        className={`${sizeClasses[size]} bg-[#00BF63] rounded-full animate-bounce`}
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );
};

export default BouncingLoader; 