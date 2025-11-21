// Feature flag for access request system
// Set NEXT_PUBLIC_ENABLE_ACCESS_REQUEST=true in .env.local to enable
// Set to false or leave unset to disable (default: disabled)
export const isAccessRequestEnabled = () => {
  return process.env.NEXT_PUBLIC_ENABLE_ACCESS_REQUEST === "true";
};

