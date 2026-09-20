"use client";

import React, { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, Mail, Phone, ExternalLink } from "lucide-react";
import { useStore } from "@/context/StoreContext";

const faqs = [
  {
    question: "Comment faire un inventaire ?",
    answer: "Rendez-vous dans la rubrique 'Inventaire'. Cliquez sur 'Faire mon premier inventaire' pour démarrer une nouvelle session. Vous pourrez alors comparer votre stock physique au stock théorique pour identifier les écarts."
  },
  {
    question: "Comment créer un nouveau produit ?",
    answer: "Allez dans 'Produits & Stock' puis cliquez sur le bouton '+ Nouveau produit'. Remplissez les informations obligatoires (Nom, Prix, Coût, Stock) et validez."
  },
  {
    question: "Comment ajouter mon logo sur les factures ?",
    answer: "Accédez à la page 'Paramètres' depuis le menu principal. Vous pourrez y ajouter votre logo, ainsi que le nom, la ville, le pays, l'email et le numéro de téléphone de votre boutique."
  },
  {
    question: "Les données sont-elles sécurisées ?",
    answer: "Absolument. Vos données sont privées et la gestion des accès est sécurisée pour garantir la confidentialité de vos informations commerciales."
  },
  {
    question: "Comment effectuer une vente au comptoir ?",
    answer: "Allez dans la section 'Point de Vente'. Vous pouvez rechercher un produit, l'ajouter au panier, appliquer une remise globale si besoin, et valider la vente. Le système calculera automatiquement la monnaie à rendre."
  },
  {
    question: "Est-il possible d'imprimer un reçu ou une facture ?",
    answer: "Oui ! Après avoir validé une vente dans le Point de Vente, une notification vous proposera d'imprimer un Ticket de Caisse (format 80mm) ou une Facture (format A4) avec l'en-tête de votre boutique."
  },
  {
    question: "À quoi sert la page Analytique ?",
    answer: "La page 'Analytique' vous permet de suivre vos performances : chiffre d'affaires, nombre de ventes, produits les plus rentables, et de visualiser ces données sur différentes périodes (jour, semaine, mois)."
  },
  {
    question: "Comment suivre les produits en rupture de stock ?",
    answer: "L'application vous alerte automatiquement ! Une pastille rouge apparaîtra dans le menu 'Produits & Stock' pour vous indiquer combien de produits sont en dessous du seuil d'alerte."
  },
  {
    question: "Puis-je gérer les commandes et livraisons ?",
    answer: "Oui, la rubrique 'Commandes' vous permet de suivre le statut de vos ventes (En attente, Expédiée, Livrée) et de garder une trace des informations de vos clients."
  }
];

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { state } = useStore();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HelpCircle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Aide & Support</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trouvez rapidement des réponses ou contactez notre équipe technique.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Colonne Principale: FAQ */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border border-border/40 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border/40 bg-secondary/10">
              <h2 className="text-lg font-bold">Foire Aux Questions (FAQ)</h2>
              <p className="text-sm text-muted-foreground mt-1">Les réponses aux questions les plus courantes.</p>
            </div>
            <div className="divide-y divide-border/20">
              {faqs.map((faq, index) => (
                <div key={index} className="p-1">
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/20 transition-colors rounded-xl"
                  >
                    <span className="font-medium text-sm">{faq.question}</span>
                    {openFaq === index ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {openFaq === index && (
                    <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground animate-fade-in leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Colonne Latérale: Contact */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-primary mb-4">Nous contacter</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Une question spécifique ? Un problème technique ? Nous sommes là pour vous aider !
            </p>
            
            <div className="space-y-4">
              <a 
                href="https://wa.me/22898376101" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-white rounded-xl hover:shadow-md transition-shadow border border-border/50 group"
              >
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-green-50 text-green-600 group-hover:bg-green-100 transition-colors">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">WhatsApp</p>
                  <p className="text-sm font-bold text-gray-900">+228 98 37 61 01</p>
                </div>
              </a>

              <a 
                href="mailto:profidele91@gmail.com" 
                className="flex items-center gap-3 p-3 bg-white rounded-xl hover:shadow-md transition-shadow border border-border/50 group"
              >
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</p>
                  <p className="text-sm font-bold text-gray-900">profidele91@gmail.com</p>
                </div>
              </a>
            </div>
          </div>

          {/* Espace Info SaaS */}
          <div className="bg-card border border-border/40 rounded-2xl p-5 text-center">
             <div className="mx-auto w-10 h-10 bg-secondary rounded-full flex items-center justify-center mb-3">
               <span className="font-black text-lg text-primary">BP</span>
             </div>
             <p className="text-sm font-bold">BoutiquePro SaaS</p>
             <p className="text-xs text-muted-foreground mt-1">Version 1.0.0</p>
             <a href="#" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3 font-medium">
                Voir les notes de mise à jour <ExternalLink className="h-3 w-3" />
             </a>
          </div>
        </div>

      </div>
    </div>
  );
}
