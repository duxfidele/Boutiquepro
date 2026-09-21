"use client";

import React, { useState } from "react";
import { useStore } from "@/context/StoreContext";
import { Plus, Search, Edit2, Trash2, Receipt } from "lucide-react";

export default function ExpensesPage() {
  const { state, dispatch, formatPrice } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editExpense, setEditExpense] = useState<any>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "Loyer",
    description: "",
    amount: 0,
  });

  const categories = ["Loyer", "Électricité", "Eau", "Internet", "Salaires", "Fournitures", "Transport", "Marketing", "Divers"];

  const filteredExpenses = state.expenses?.filter(
    (e) =>
      e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.category.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const handleSave = () => {
    if (!form.description || form.amount <= 0) return;

    if (editExpense) {
      dispatch({ type: "UPDATE_EXPENSE", payload: { ...editExpense, ...form } });
    } else {
      dispatch({
        type: "ADD_EXPENSE",
        payload: {
          id: "exp" + Date.now(),
          ...form,
          createdAt: new Date().toISOString(),
        },
      });
    }
    setShowModal(false);
    setEditExpense(null);
    setForm({ date: new Date().toISOString().split("T")[0], category: "Loyer", description: "", amount: 0 });
  };

  const openEdit = (e: any) => {
    setEditExpense(e);
    setForm({ date: e.date, category: e.category, description: e.description, amount: e.amount });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette dépense ?")) {
      dispatch({ type: "DELETE_EXPENSE", payload: id });
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in pb-24 lg:pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dépenses</h1>
          <p className="text-sm text-muted-foreground">Gérez vos charges et frais d'exploitation</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-soft-sm active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Ajouter une Dépense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Total affiché</p>
          </div>
          <h3 className="text-2xl font-bold text-foreground">{formatPrice(totalExpenses)}</h3>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border/50 bg-secondary/30">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher une dépense..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Catégorie</th>
                <th className="p-4 font-medium">Description</th>
                <th className="p-4 font-medium text-right">Montant</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="p-4 text-sm font-medium">{new Date(exp.date).toLocaleDateString("fr-FR")}</td>
                  <td className="p-4 text-sm">
                    <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-xs font-medium">
                      {exp.category}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{exp.description}</td>
                  <td className="p-4 text-sm font-bold text-right text-destructive">{formatPrice(exp.amount)}</td>
                  <td className="p-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEdit(exp)}
                      className="p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground rounded-lg transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Aucune dépense trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border/50 overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border/50">
              <h3 className="text-lg font-bold text-foreground">
                {editExpense ? "Modifier la Dépense" : "Nouvelle Dépense"}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <input
                  type="text"
                  placeholder="Achat de papier, facture d'eau..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Montant</label>
                <input
                  type="number"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  className="w-full p-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="p-5 border-t border-border/50 bg-secondary/30 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditExpense(null);
                }}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={!form.description || form.amount <= 0}
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
