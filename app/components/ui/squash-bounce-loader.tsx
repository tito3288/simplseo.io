import React from "react";

interface SquashBounceLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SquashBounceLoader: React.FC<SquashBounceLoaderProps> = ({ 
  size = "md", 
  className = "" 
}) => {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4", 
    lg: "w-6 h-6"
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div 
        className={`${sizeClasses[size]} bg-[#00BF63] rounded-full`}
        style={{
          animation: 'bounce 1s infinite ease-in-out'
        }}
      />
      <style jsx>{`
        @keyframes bounce {
          0% {
            transform: translateY(0) scaleX(1) scaleY(1);
          }
          10% {
            transform: translateY(-20px) scaleX(1.05) scaleY(0.95);
          }
          25% {
            transform: translateY(-50px) scaleX(0.95) scaleY(1.05);
          }
          50% {
            transform: translateY(0) scaleX(1.2) scaleY(0.8); /* squash on impact */
          }
          75% {
            transform: translateY(-30px) scaleX(0.98) scaleY(1.02);
          }
          100% {
            transform: translateY(0) scaleX(1) scaleY(1);
          }
        }
      `}</style>
    </div>
  );
};

export default SquashBounceLoader; 