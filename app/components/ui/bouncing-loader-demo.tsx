import React from "react";
import SquashBounceLoader from "./squash-bounce-loader";

const BouncingLoaderDemo = () => {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h3 className="text-lg font-medium mb-4">Squash Bounce Loader Demo</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Small:</span>
            <SquashBounceLoader size="sm" />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Medium:</span>
            <SquashBounceLoader size="md" />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Large:</span>
            <SquashBounceLoader size="lg" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BouncingLoaderDemo; 