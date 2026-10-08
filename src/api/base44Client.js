// Base44 client stub - DEPRECATED
// This app has migrated to Supabase for authentication.
// See src/lib/supabase.js for the Supabase client instead.

export const base44 = {
  auth: {
    loginViaEmailPassword: async () => {
      throw new Error("Base44 is no longer used. Use Supabase instead.");
    },
    register: async () => {
      throw new Error("Base44 is no longer used. Use Supabase instead.");
    },
    verifyOtp: async () => {
      throw new Error("Base44 is no longer used. Use Supabase instead.");
    },
    resendOtp: async () => {
      throw new Error("Base44 is no longer used. Use Supabase instead.");
    },
    resetPasswordRequest: async () => {
      throw new Error("Base44 is no longer used. Use Supabase instead.");
    },
    resetPassword: async () => {
      throw new Error("Base44 is no longer used. Use Supabase instead.");
    },
    setToken: () => {
      throw new Error("Base44 is no longer used. Use Supabase instead.");
    },
    updateMe: async () => {
      throw new Error("Base44 is no longer used. Use Supabase instead.");
    },
  },
  functions: {
    invoke: async () => {
      throw new Error("Base44 is no longer used. Use Supabase instead.");
    },
  },
};
