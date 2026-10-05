import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Mail, Lock, Loader2, ShieldCheck, UploadCloud, FileCheck2, Ticket } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";
import { uploadPrivate } from "@/lib/ghb";

const COUNTRIES = ["Burundi", "RDC", "Kenya", "Rwanda", "Tanzanie", "Ouganda", "Zambie", "Côte d'Ivoire", "Sénégal", "Maroc", "Algérie", "Émirats Arabes Unis", "Autre"];

export default function Register() {
  const [refCode] = useState(() => (new URLSearchParams(window.location.search).get("ref") || "").trim().toUpperCase());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [legalName, setLegalName] = useState("");
  const [username, setUsername] = useState("");
  const [promoCode, setPromoCode] = useState(refCode);
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [docType, setDocType] = useState("national_id");
  const [docFile, setDocFile] = useState(null);
  const [docName, setDocName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleFile = (file) => {
    if (!file) return;
    setDocFile(file);
    setDocName(file.name);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }
    if (!legalName || !phone || !country) { setError("Veuillez remplir votre nom, téléphone et pays."); return; }
    if (!docFile) { setError("Veuillez téléverser votre pièce d'identité."); return; }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Échec de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      // Upload KYC document + save profile
      try {
        const file_uri = await uploadPrivate(docFile);
        await base44.auth.updateMe({
          legal_name: legalName,
          username: username || legalName,
          phone,
          country,
          id_document_type: docType,
          id_document_uri: file_uri,
          kyc_status: "pending",
        });
      } catch (kycErr) {
        // Account is created; user can complete KYC later from the app
        console.error("KYC upload failed:", kycErr);
      }
      // Apply referral if a promo / sponsorship code was provided
      const code = (promoCode || refCode || "").trim().toUpperCase();
      if (code) {
        try { await base44.functions.invoke("applyReferral", { code }); } catch {}
      }
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(err.message || "Code de vérification invalide");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({ title: "Code envoyé", description: "Vérifiez votre email." });
    } catch (err) {
      setError(err.message || "Échec de l'envoi");
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", safeReturnTo());
  };

  if (showOtp) {
    return (
      <AuthLayout icon={Mail} title="Vérifiez votre email" subtitle={`Un code a été envoyé à ${email}`}>
        {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              {[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="w-full h-12 font-medium ghb-gold-bg text-black hover:opacity-90" onClick={handleVerify} disabled={loading || otpCode.length < 6}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Vérification…</> : "Vérifier"}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Pas reçu de code ?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">Renvoyer</button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Créer votre compte GHB Pay"
      subtitle="Inscription sécurisée — KYC obligatoire"
      footer={
        <>Déjà un compte ?{" "}
          <Link to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")} className="text-primary font-medium hover:underline">Se connecter</Link>
        </>
      }
    >
      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6 border-white/10 bg-white/5" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" /> Continuer avec Google
      </Button>
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">ou</span></div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="legal_name">Nom complet légal</Label>
          <Input id="legal_name" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Nom et prénom" className="h-11 bg-white/5 border-white/10" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Pseudonyme (nom public)</Label>
          <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex : GLADYS257 (visible par votre parrain)" className="h-11 bg-white/5 border-white/10" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+257 6XX" className="h-11 bg-white/5 border-white/10" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Pays</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="h-11 bg-white/5 border-white/10"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" placeholder="vous@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11 bg-white/5 border-white/10" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-11 bg-white/5 border-white/10" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmer</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="confirm" type="password" autoComplete="new-password" placeholder="•••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-11 bg-white/5 border-white/10" required />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="doc_type">Type de pièce d'identité</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="h-11 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="national_id">Carte d'identité nationale</SelectItem>
              <SelectItem value="passport">Passeport</SelectItem>
              <SelectItem value="driver_license">Permis de conduire</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Photo / scan de la pièce d'identité</Label>
          <label className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] hover:border-[#D4AF37]/50 cursor-pointer transition text-center">
            {docFile ? (
              <div className="flex items-center gap-2 text-emerald-400"><FileCheck2 className="w-5 h-5" /><span className="text-sm text-foreground truncate max-w-[200px]">{docName}</span></div>
            ) : (
              <>
                <UploadCloud className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-foreground">Cliquez pour téléverser</span>
                <span className="text-xs text-muted-foreground">JPG, PNG ou PDF</span>
              </>
            )}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="promo" className="flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5 text-[#D4AF37]" /> Code Promo / Parrainage (optionnel)</Label>
          <Input id="promo" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="Code de votre parrain" className="h-11 bg-white/5 border-white/10 uppercase tracking-widest font-medium" />
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>Votre compte sera en attente d'approbation jusqu'à validation de votre KYC par un administrateur.</span>
        </div>

        <Button type="submit" className="w-full h-12 font-semibold ghb-gold-bg text-black hover:opacity-90" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création…</> : "Créer mon compte"}
        </Button>
      </form>
    </AuthLayout>
  );
}