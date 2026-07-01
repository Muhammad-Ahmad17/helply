import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    navigate(isSignedIn ? "/dashboard" : "/login", { replace: true });
  }, [isLoaded, isSignedIn, navigate]);

  return null;
}
