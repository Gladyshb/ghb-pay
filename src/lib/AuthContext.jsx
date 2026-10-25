import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const navigate = useNavigate();

  const loadUser = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null);
      setAuthError(null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return null;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();
    if (error) throw error;

    const currentUser = {
      ...authUser,
      ...(authUser.user_metadata || {}),
      ...(profile || {}),
      id: authUser.id,
      email: authUser.email,
    };
    setUser(currentUser);
    setAuthError(null);
    setIsLoadingAuth(false);
    setAuthChecked(true);
    return currentUser;
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return await loadUser(data.user);
    } catch (error) {
      setUser(null);
      setAuthError({ type: "unknown", message: error.message });
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return null;
    }
  }, [loadUser]);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.setItem("supabase_password_recovery", "true");
      } else if (event === "SIGNED_OUT") {
        sessionStorage.removeItem("supabase_password_recovery");
      }
      if (!active) return;
      setIsLoadingAuth(true);
      queueMicrotask(async () => {
        if (!active) return;
        try {
          await loadUser(session?.user || null);
        } catch (error) {
          if (!active) return;
          setUser(null);
          setAuthError({ type: "unknown", message: error.message });
          setIsLoadingAuth(false);
          setAuthChecked(true);
        }
      });
    });

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error) throw error;
      await loadUser(data.session?.user || null);
    }).catch((error) => {
      if (!active) return;
      setAuthError({ type: "unknown", message: error.message });
      setIsLoadingAuth(false);
      setAuthChecked(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadUser]);

  const logout = useCallback(async (shouldRedirect = true) => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    if (shouldRedirect) navigate("/login", { replace: true });
  }, [navigate]);

  const navigateToLogin = useCallback(() => navigate("/login"), [navigate]);
  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    isLoadingAuth,
    isLoadingPublicSettings: false,
    authError,
    appPublicSettings: null,
    authChecked,
    logout,
    navigateToLogin,
    checkUserAuth,
    checkAppState: checkUserAuth,
  }), [user, isLoadingAuth, authError, authChecked, logout, navigateToLogin, checkUserAuth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
