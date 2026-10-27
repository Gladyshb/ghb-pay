import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Logo from "@/components/ghb/Logo";
import KycTab from "@/components/admin/KycTab";
import DepositsTab from "@/components/admin/DepositsTab";
import TransfersTab from "@/components/admin/TransfersTab";
import AddressesTab from "@/components/admin/AddressesTab";
import CurrenciesTab from "@/components/admin/CurrenciesTab";
import SupportTab from "@/components/admin/SupportTab";
import ChatInboxTab from "@/components/admin/ChatInboxTab";
import AnnouncementsTab from "@/components/admin/AnnouncementsTab";
import TickerTab from "@/components/admin/TickerTab";
import AboutTab from "@/components/admin/AboutTab";
import ReferralsTab from "@/components/admin/ReferralsTab";
import UsersTab from "@/components/admin/UsersTab";
import { ShieldCheck, ArrowDownToLine, ArrowUpFromLine, MapPin, Coins, LifeBuoy, Inbox, Megaphone, Activity, Info, Gift, Users } from "lucide-react";

export default function Admin() {
  const [tab, setTab] = useState("kyc");

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#D4AF37]" /> Console Admin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">GHB Pay — GLADYS HB BUSINESS GROUP</p>
        </div>
        <div className="hidden sm:block"><Logo compact /></div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <button type="button" onClick={() => setTab("addresses")} className="sm:hidden flex w-full items-center gap-3 rounded-xl border border-border bg-secondary p-3 mb-3 text-left text-secondary-foreground">
          <MapPin className="w-5 h-5 shrink-0 text-accent" />
          <span><span className="block text-sm font-semibold">Moyens de paiement</span><span className="block text-xs text-muted-foreground">Ajouter et modifier les méthodes et adresses de dépôt</span></span>
        </button>
        <TabsList className="flex justify-start w-full overflow-x-auto bg-secondary border border-border h-auto p-1.5 gap-1">
          <Tab v="users" icon={Users} label="Utilisateurs" />
          <Tab v="kyc" icon={ShieldCheck} label="KYC" />
          <Tab v="deposits" icon={ArrowDownToLine} label="Dépôts" />
          <Tab v="transfers" icon={ArrowUpFromLine} label="Transferts" />
          <Tab v="addresses" icon={MapPin} label="Moyens de paiement" />
          <Tab v="currencies" icon={Coins} label="Devises" />
          <Tab v="support" icon={LifeBuoy} label="Support" />
          <Tab v="inbox" icon={Inbox} label="Messagerie" />
          <Tab v="announcements" icon={Megaphone} label="Annonces" />
          <Tab v="ticker" icon={Activity} label="Bandeau" />
          <Tab v="about" icon={Info} label="À propos" />
          <Tab v="referrals" icon={Gift} label="Parrainage" />
        </TabsList>

        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="kyc" className="mt-4"><KycTab /></TabsContent>
        <TabsContent value="deposits" className="mt-4"><DepositsTab /></TabsContent>
        <TabsContent value="transfers" className="mt-4"><TransfersTab /></TabsContent>
        <TabsContent value="addresses" className="mt-4"><AddressesTab /></TabsContent>
        <TabsContent value="currencies" className="mt-4"><CurrenciesTab /></TabsContent>
        <TabsContent value="support" className="mt-4"><SupportTab /></TabsContent>
        <TabsContent value="inbox" className="mt-4"><ChatInboxTab /></TabsContent>
        <TabsContent value="announcements" className="mt-4"><AnnouncementsTab /></TabsContent>
        <TabsContent value="ticker" className="mt-4"><TickerTab /></TabsContent>
        <TabsContent value="about" className="mt-4"><AboutTab /></TabsContent>
        <TabsContent value="referrals" className="mt-4"><ReferralsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function Tab({ v, icon: Icon, label }) {
  return (
    <TabsTrigger value={v} className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm data-[state=active]:ghb-gold-bg data-[state=active]:text-black whitespace-nowrap">
      <Icon className="w-3.5 h-3.5" /> {label}
    </TabsTrigger>
  );
}