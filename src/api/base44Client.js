// Fichier Base44 désactivé pour basculer sur Supabase
export const base44 = {
  auth: {
    loginViaEmailPassword: async () => { throw new Error("Base44 désactivé"); },
    register: async () => { throw new Error("Base44 désactivé"); },
    verifyOtp: async () => {},
    resendOtp: async () => {},
    setToken: () => {},
    updateMe: async () => {},
  },
  functions: {
    invoke: async () => {},
  }
};

