import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const currentUserRef = useRef(null);
  const authRequestRef = useRef(0);
  const navigate = useNavigate();

  const loadUser = useCallback(async (authUser, requestId) => {
    if (requestId !== authRequestRef.current) return null;

    if (!authUser) {
      currentUserRef.current = null;
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
    if (requestId !== authRequestRef.current) return null;

    const currentUser = {
      ...authUser,
      ...(authUser.user_metadata || {}),
      ...(profile || {}),
      id: authUser.id,
      email: authUser.email,
    };
    currentUserRef.current = currentUser;
    setUser(currentUser);
    setAuthError(null);
    setIsLoadingAuth(false);
    setAuthChecked(true);
    return currentUser;
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    const requestId = ++authRequestRef.current;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return await loadUser(data.user, requestId);
    } catch (error) {
      if (requestId !== authRequestRef.current) return null;
      currentUserRef.current = null;
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

      if (event === "TOKEN_REFRESHED") return;

      const requestId = ++authRequestRef.current;
      if (event === "SIGNED_OUT") {
        currentUserRef.current = null;
        setUser(null);
        setAuthError(null);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }

      const sameUser = Boolean(
        session?.user?.id && currentUserRef.current?.id === session.user.id
      );
      if (!sameUser) setIsLoadingAuth(true);

      queueMicrotask(() => {
        if (!active) return;
        loadUser(session?.user || null, requestId).catch((error) => {
          if (!active || requestId !== authRequestRef.current) return;
          if (currentUserRef.current?.id !== session?.user?.id) {
            currentUserRef.current = null;
            setUser(null);
            setAuthError({ type: "unknown", message: error.message });
          } else {
            console.error("Unable to refresh the current Supabase profile:", error);
          }
          setIsLoadingAuth(false);
          setAuthChecked(true);
        });
      });
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
