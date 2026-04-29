import { useState, useEffect } from "react";

function App() {
  const [transactions, setTransactions] = useState(() => {
  const saved = localStorage.getItem("transactions");
  return saved ? JSON.parse(saved) : [];
});
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("venit");
  const [category, setCategory] = useState("Client");
useEffect(() => {
  localStorage.setItem("transactions", JSON.stringify(transactions));
}, [transactions]);
  const addTransaction = () => {
    if (!description || !amount) return;

    const newTransaction = {
      id: Date.now(),
      description,
      amount: Number(amount),
      type,
      category,
    };

    setTransactions([...transactions, newTransaction]);
    setDescription("");
    setAmount("");
  };

  const venit = transactions
    .filter((t) => t.type === "venit")
    .reduce((total, t) => total + t.amount, 0);

  const costuri = transactions
    .filter((t) => t.type === "cost")
    .reduce((total, t) => total + t.amount, 0);

  const profit = venit - costuri;

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>My Company</h1>
      <h2>Dashboard</h2>

      <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
        <div style={{ background: "#eee", padding: "20px", borderRadius: "10px" }}>
          <h3>Venit</h3>
          <p>€{venit}</p>
        </div>

        <div style={{ background: "#eee", padding: "20px", borderRadius: "10px" }}>
          <h3>Costuri</h3>
          <p>€{costuri}</p>
        </div>

        <div style={{ background: "#eee", padding: "20px", borderRadius: "10px" }}>
          <h3>Profit</h3>
          <p>€{profit}</p>
        </div>
      </div>

      <div style={{ marginTop: "30px" }}>
        <h3>Adaugă tranzacție</h3>

        <input
          placeholder="Descriere"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          type="number"
          placeholder="Sumă €"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ marginLeft: "10px" }}
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ marginLeft: "10px" }}
        >
          <option value="venit">Venit</option>
          <option value="cost">Cost</option>
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ marginLeft: "10px" }}
        >
          <option>Client</option>
          <option>Salarii</option>
          <option>Subcontractori</option>
          <option>Combustibil</option>
          <option>Leasing</option>
          <option>Materiale</option>
          <option>Taxe</option>
          <option>Diverse</option>
        </select>

        <button onClick={addTransaction} style={{ marginLeft: "10px" }}>
          Adaugă
        </button>
      </div>

      <div style={{ marginTop: "30px" }}>
        <h3>Tranzacții</h3>

        {transactions.map((t) => (
  <div
    key={t.id}
    style={{
      borderBottom: "1px solid #ddd",
      padding: "10px 0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <span>
      <strong>{t.description}</strong> — €{t.amount} — {t.type} — {t.category}
    </span>

    <button
      onClick={() =>
        setTransactions(transactions.filter((item) => item.id !== t.id))
      }
    >
      Șterge
    </button>
  </div>
))}
      </div>
    </div>
  );
}

export default App;