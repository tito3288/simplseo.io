import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateRecommendedKeyword } from '../../lib/locationUtils';


const LocationIssueAlert = ({ keyword, locationIssues, userLocation, onAction, onDismiss }) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Entrance animation
  useEffect(() => {
    // Small delay to ensure smooth entrance
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50);
    
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = (action) => {
    setIsAnimating(true);
    
    // Wait for animation to complete before actually dismissing
    setTimeout(() => {
      setIsDismissed(true);
      // Notify parent component that this alert should be completely removed
      if (onDismiss) {
        onDismiss(keyword, locationIssues);
      }
    }, 300); // Match the CSS transition duration
  };

  if (isDismissed || !locationIssues) return null;

  const getSeverityStyle = () => {
    switch (locationIssues.severity) {
      case 'high':
        return {
          border: 'border-red-200',
          bg: 'bg-red-50',
          icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
          title: 'High Priority Location Issue'
        };
      case 'medium':
        return {
          border: 'border-yellow-200',
          bg: 'bg-yellow-50',
          icon: <AlertCircle className="h-5 w-5 text-yellow-600" />,
          title: 'Medium Priority Location Issue'
        };
      default:
        return {
          border: 'border-blue-200',
          bg: 'bg-blue-50',
          icon: <AlertCircle className="h-5 w-5 text-blue-600" />,
          title: 'Location Issue Detected'
        };
    }
  };

  const style = getSeverityStyle();

  const handleAction = (action) => {
    if (onAction) {
      onAction(action, keyword, locationIssues);
    }
    
    // Animate dismissal for both actions
    if (action === 'fix_keyword' || action === 'do_not_fix') {
      handleDismiss(action);
    }
  };

  return (
    <div 
      className={`transition-all duration-300 ease-in-out transform ${
        isAnimating 
          ? 'opacity-0 -translate-y-4 scale-95' 
          : isVisible
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-2 scale-95'
      }`}
    >
      {/* Header with icon and title */}
      <div className="flex items-center gap-2 mb-4">
        {style.icon}
        <h4 className="font-semibold text-gray-900">{style.title}</h4>
      </div>
      
      {/* 4-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Left Column - Target Keyword */}
        <div className="space-y-2">
          <h5 className="font-medium text-gray-900 text-sm">Target Keyword</h5>
          <div className="bg-white p-2 rounded border border-gray-200">
            <p className="text-xs text-gray-600 mb-1">Keyword</p>
            <p className="font-medium text-gray-900 text-sm">"{keyword}"</p>
          </div>
          <div className="bg-white p-2 rounded border border-gray-200">
            <p className="text-xs text-gray-600 mb-1">Service Area</p>
            <p className="font-medium text-gray-900 text-sm">{userLocation}</p>
          </div>
        </div>
        
        {/* Column 2 - Location Issue Description & Problem */}
        <div className="space-y-2">
          <h5 className="font-medium text-gray-900 text-sm">Location Issue</h5>
          {locationIssues.issues.map((issue, index) => (
            <div key={index} className="space-y-2">
              <div className="bg-white p-2 rounded border border-gray-200">
                <p className="text-xs text-gray-600 mb-1">Description</p>
                <p className="text-xs text-gray-700 leading-relaxed">
                  {issue.description.split("'").map((part, index) => 
                    index % 2 === 1 ? (
                      <span key={index} className="text-green-600 font-medium">'{part}'</span>
                    ) : (
                      part
                    )
                  )}
                </p>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200">
                <p className="text-xs text-gray-600 mb-1">Problem</p>
                <p className="text-xs text-gray-700 leading-relaxed">
                  {issue.problem.split("'").map((part, index) => 
                    index % 2 === 1 ? (
                      <span key={index} className="text-green-600 font-medium">'{part}'</span>
                    ) : (
                      part
                    )
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {/* Column 3 - Recommendation & Recommended Keyword */}
        <div className="space-y-2">
          <h5 className="font-medium text-gray-900 text-sm">Recommendation</h5>
          {locationIssues.issues.map((issue, index) => {
            // Generate the recommended keyword
            const recommendedKeyword = generateRecommendedKeyword(keyword, userLocation);
            
            return (
              <div key={index} className="space-y-2">
                <div className="bg-blue-50 border border-blue-200 rounded p-2">
                  <p className="text-blue-800 text-xs font-medium mb-1">💡 Suggestion:</p>
                  <p className="text-blue-700 text-xs leading-relaxed">
                    {issue.suggestion.split("'").map((part, index) => 
                      index % 2 === 1 ? (
                        <span key={index} className="text-green-600 font-medium">'{part}'</span>
                      ) : (
                        part
                      )
                    )}
                  </p>
                </div>
                
                {/* Show the exact recommended keyword */}
                <div className="bg-white border border-blue-200 rounded p-2">
                  <p className="text-blue-800 text-xs font-medium mb-1">🎯 Use This Keyword:</p>
                  <p className="text-green-600 font-medium text-sm">"{recommendedKeyword}"</p>
                  <p className="text-blue-700 text-xs mt-1">
                    Instead of <span className="text-green-600 font-medium">"{keyword}"</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Column 4 - Action Buttons */}
        <div className="space-y-2">
          <h5 className="font-medium text-gray-900 text-sm">Actions</h5>
          
          {/* Button descriptions */}
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-gray-600 leading-relaxed">
                Update your suggestion to use the recommended location-specific keyword
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction('fix_keyword')}
                className="border-green-300 text-green-700 hover:bg-green-50 w-full transition-transform active:scale-95"
              >
                Use Recommended Keyword
              </Button>
            </div>
            
            <div className="space-y-1">
              <p className="text-xs text-gray-600 leading-relaxed">
                Keep the original suggestion without any changes
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction('do_not_fix')}
                className="border-red-300 text-red-700 hover:bg-red-50 w-full transition-transform active:scale-95"
              >
                Do Not Use Recommended Keyword
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationIssueAlert;
