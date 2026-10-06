import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Eye, EyeOff, Loader2, Check, TestTube } from "lucide-react";

export default function SettingsTab() {
  const [config, setConfig] = useState(null);
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState("");
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    base44.entities.AppConfig.filter({}, { limit: 1 })
      .then(({ items }) => {
        if (items[0]) {
          setConfig(items[0]);
          setValue(items[0].binance_proxy_url || "");
        }
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const cleaned = value.trim().replace(/\/$/, "");
      let saved;
      if (config?.id) {
        saved = await base44.entities.AppConfig.update(config.id, { binance_proxy_url: cleaned });
      } else {
        saved = await base44.entities.AppConfig.create({ binance_proxy_url: cleaned });
        setConfig(saved);
      }
      setValue(saved.binance_proxy_url || "");
      setMsg("Configuration enregistrée.");
    } catch (e) {
      setMsg(e.message || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const testProxy = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke("syncBinanceRates", {});
      const data = res?.data || res;
      if (data?.ok) {
        const bin = (data.results || []).filter((r) => r.source === "binance");
        setTestResult({ ok: true, source: data.source, synced: data.synced, binanceCount: bin.length });
      } else {
        setTestResult({ ok: false, error: data?.error || "Échec de la synchro" });
      }
    } catch (e) {
      setTestResult({ ok: false, error: e.message || "Échec du test" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#D4AF37]" /> Paramètres de sécurité
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configurez le proxy Cloudflare qui relaie les requêtes Binance P2P pour récupérer les taux du marché.
        </p>
      </div>

      <div className="ghb-card rounded-2xl p-5 space-y-4">
        <div className="space-y-2">
          <Label>URL du Worker Cloudflare (Proxy Binance P2P)</Label>
          <div className="relative">
            <Input
              type={reveal ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://xxx.workers.dev/"
              className="bg-white/5 border-white/10 h-11 pr-11 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
              title={reveal ? "Masquer" : "Afficher"}
            >
              {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Champ sécurisé — accès admin uniquement. Laissez vide pour désactiver le proxy.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving} className="ghb-gold-bg text-black font-semibold hover:opacity-90">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Enregistrer
          </Button>
          <Button onClick={testProxy} disabled={testing} variant="outline" className="border-white/10">
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
            Tester la synchro
          </Button>
        </div>

        {msg && <div className="text-sm text-emerald-400">{msg}</div>}

        {testResult && (
          <div className={`text-sm rounded-lg p-3 border ${testResult.ok ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/20" : "text-red-400 bg-red-500/5 border-red-500/20"}`}>
            {testResult.ok
              ? `Proxy actif — source: ${testResult.source}, ${testResult.synced} devises synchronisées (${testResult.binanceCount} via Binance P2P).`
              : `Échec: ${testResult.error}`}
          </div>
        )}
      </div>
    </div>
  );
}