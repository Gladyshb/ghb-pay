import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

import { Button } from "@/composants/ui/button";
import { Input } from "@/composants/ui/input";
import { Label } from "@/composants/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/composants/ui/select";
import { UserPlus, Mail, Lock, Loader2, ShieldCheck, UploadCloud, FileCheck2, Ticket, Eye, EyeOff } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/composants/ui/input-otp";
import AuthLayout from "@/composants/AuthLayout";
import { toast } from "@/composants/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";



const COUNTRIES = ["Burundi", "RDC", "Kenya", "Rwanda", "Tanzanie"];

export default function Register() {
  const [refCode] = useState(() => (new URLSearchParams(window.location.search)).get("ref") || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [legalName, setLegalName] = useState("");
  const [username, setUsername] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [docType, setDocType] = useState("cni");
  const [docFile, setDocFile] = useState(null);
  const [docName, setDocName] = useState("");
  const [faceFile, setFaceFile] = useState(null);
  const [faceName, setFaceName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleFile = (file) => {
    if (!file) return;
    setDocFile(file);
    setDocName(file.name);
  };

  const handleFaceFile = (file) => {
    if (!file) return;
    setFaceFile(file);
    setFaceName(file.name);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            legal_name: legalName,
            username: username,
            phone: phone,
            country: country,
            ref_code: refCode || promoCode
          }
        }
      });

      if (signUpError) throw signUpError;

      toast({
        title: "Inscription réussie",
        description: "Veuillez vérifier votre boîte mail ou entrer le code de confirmation.",
      });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || une erreur est survenue);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center mb-6">Créer un compte GHB-PAY</h2>
        {error && <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 rounded">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-3 top-2.5 text-gray-500"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <div className="relative">
              <Input 
                id="confirmPassword" 
                type={showConfirm ? "text" : "password"} 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required 
              />
              <button 
                type="button" 
                onClick={() => setShowConfirm(!showConfirm)} 
                className="absolute right-3 top-2.5 text-gray-500"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <UserPlus className="mr-2" size={18} />}
            S'inscrire
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          Déjà un compte ? <Link to="/login" className="text-blue-600 font-semibold">Se connecter</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
