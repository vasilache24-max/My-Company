import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [authError, setAuthError] = useState("");

  const [transactions, setTransactions] = useState([]);

  const [activePage, setActivePage] = useState("dashboard");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("venit");
  const [category, setCategory] = useState("Client");
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [txFilter, setTxFilter] = useState("toate");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState([
    { role: "ai", text: "Bună! Sunt asistentul tău financiar. Te pot ajuta să analizezi tranzacțiile, să afli profitul pe o perioadă, cele mai mari cheltuieli sau orice altă întrebare despre finanțele firmei tale." }
  ]);
  const [chatInput, setChatInput] = useState("");

  const [flota, setFlota] = useState([]);
  const [chirii, setChirii] = useState([]);
  const [asigurari, setAsigurari] = useState([]);
  const [abonamente, setAbonamente] = useState([]);
  const [addingTo, setAddingTo] = useState(null);
  const [homeForm, setHomeForm] = useState({});
  const [expandedItem, setExpandedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editingTxId, setEditingTxId] = useState(null);
  const [editTxForm, setEditTxForm] = useState({});

  const [settings, setSettings] = useState({ companyName: "My Company", currency: "EUR" });
  const [settingsForm, setSettingsForm] = useState(settings);

  const loadUserData = async (userId) => {
    const [tx, files, fl, ch, as, ab, st] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("uploaded_files").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("flota").select("*").eq("user_id", userId),
      supabase.from("chirii").select("*").eq("user_id", userId),
      supabase.from("asigurari").select("*").eq("user_id", userId),
      supabase.from("abonamente").select("*").eq("user_id", userId),
      supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (tx.data) setTransactions(tx.data);
    if (files.data) setUploadedFiles(files.data);
    if (fl.data) setFlota(fl.data);
    if (ch.data) setChirii(ch.data);
    if (as.data) setAsigurari(as.data);
    if (ab.data) setAbonamente(ab.data);
    if (st.data) {
      const s = { companyName: st.data.company_name, currency: st.data.currency };
      setSettings(s);
      setSettingsForm(s);
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        setUser({ id: u.id, name: u.user_metadata?.name || u.email, email: u.email });
        loadUserData(u.id);
      } else {
        setLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        setUser({ id: u.id, name: u.user_metadata?.name || u.email, email: u.email });
      } else {
        setUser(null);
        setTransactions([]); setUploadedFiles([]);
        setFlota([]); setChirii([]); setAsigurari([]); setAbonamente([]);
        setSettings({ companyName: "My Company", currency: "EUR" });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || flota.length === 0) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expiring = flota.filter((car) => {
      if (!car.keuring_expirare) return false;
      const p = car.keuring_expirare.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);
      if (!p) return false;
      const exp = new Date(Number(p[3]), Number(p[2]) - 1, Number(p[1]));
      const days = Math.ceil((exp - today) / 86400000);
      return days >= 0 && days <= 10;
    });
    if (expiring.length === 0) return;
    if (!("Notification" in window)) return;
    Notification.requestPermission().then((perm) => {
      if (perm !== "granted") return;
      expiring.forEach((car) => {
        const p = car.keuring_expirare.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);
        const exp = new Date(Number(p[3]), Number(p[2]) - 1, Number(p[1]));
        const days = Math.ceil((exp - today) / 86400000);
        new Notification("Keuring expiră curând!", {
          body: `${car.marca || ""} ${car.model || ""} (${car.numar || ""}) — mai ${days === 0 ? "azi!" : `${days} zile`} (${car.keuring_expirare})`,
          icon: "/favicon.ico",
        });
      });
    });
  }, [user, flota]);

  const homeCategories = {
    flota: {
      label: "Flotă", icon: "🚗", color: "#2563eb",
      fields: [
        { key: "marca",    label: "Marcă",              placeholder: "ex: Ford" },
        { key: "model",    label: "Model",              placeholder: "ex: Transit" },
        { key: "an",       label: "An fabricație",      placeholder: "ex: 2021" },
        { key: "numar",    label: "Număr înmatriculare", placeholder: "ex: B 123 ABC" },
        { key: "km",       label: "Kilometraj",         placeholder: "ex: 85000" },
        { key: "combustibil", label: "Combustibil",     placeholder: "Diesel / Benzină / Electric" },
        { key: "note",     label: "Note",               placeholder: "Observații" },
        { key: "leasing_inceput", label: "Leasing început", placeholder: "ex: 01.01.2024", section: "Leasing" },
        { key: "leasing_sfarsit", label: "Leasing sfârșit", placeholder: "ex: 01.01.2027", section: "Leasing" },
        { key: "leasing_stare",   label: "Stare leasing",   placeholder: "ex: Activ / Achitat", section: "Leasing" },
        { key: "keuring_expirare", label: "Keuring expiră", placeholder: "ex: 15.06.2025", section: "Keuring" },
      ],
      state: flota, setState: setFlota,
      display: (item) => `${item.marca || ""} ${item.model || ""} — ${item.numar || ""}`,
      sub: (item) => `${item.an || ""} · ${item.km || ""} km · ${item.combustibil || ""}`,
    },
    chirii: {
      label: "Chirii", icon: "🏠", color: "#16a34a",
      fields: [
        { key: "adresa",   label: "Adresă / Descriere", placeholder: "ex: Depozit Str. Mihai 5" },
        { key: "suma",     label: "Sumă lunară",        placeholder: "ex: 1500" },
        { key: "scadenta", label: "Ziua scadentă",      placeholder: "ex: 1 (prima zi a lunii)" },
        { key: "proprietar", label: "Proprietar",       placeholder: "Nume proprietar" },
        { key: "note",     label: "Note",               placeholder: "Observații" },
      ],
      state: chirii, setState: setChirii,
      display: (item) => item.adresa || "—",
      sub: (item) => `${item.suma ? item.suma + " " + settings.currency + "/lună" : ""} · Scadent ziua ${item.scadenta || "—"}`,
    },
    asigurari: {
      label: "Asigurări", icon: "🛡️", color: "#7c3aed",
      fields: [
        { key: "tip",      label: "Tip asigurare",      placeholder: "ex: RCA / CASCO / Clădire" },
        { key: "companie", label: "Companie",            placeholder: "ex: Allianz" },
        { key: "vehicul",  label: "Vehicul (opțional)", placeholder: "ex: B 123 ABC" },
        { key: "prima",    label: "Primă anuală",        placeholder: "ex: 2400" },
        { key: "expirare", label: "Data expirării",      placeholder: "ex: 31.12.2025" },
        { key: "note",     label: "Note",               placeholder: "Observații" },
      ],
      state: asigurari, setState: setAsigurari,
      display: (item) => `${item.tip || "—"} — ${item.companie || ""}`,
      sub: (item) => `${item.vehicul ? "🚗 " + item.vehicul + " · " : ""}Expiră: ${item.expirare || "—"}`,
    },
    abonamente: {
      label: "Abonamente", icon: "📋", color: "#ea580c",
      fields: [
        { key: "nume",      label: "Serviciu",           placeholder: "ex: Telekom / Rompetrol Card" },
        { key: "suma",      label: "Sumă",               placeholder: "ex: 250" },
        { key: "frecventa", label: "Frecvență",          placeholder: "Lunar / Anual" },
        { key: "reinnoire", label: "Data reînnoirii",    placeholder: "ex: 15.01.2026" },
        { key: "note",      label: "Note",               placeholder: "Observații" },
      ],
      state: abonamente, setState: setAbonamente,
      display: (item) => item.nume || "—",
      sub: (item) => `${item.suma ? item.suma + " " + settings.currency + " / " + (item.frecventa || "") : ""} · Reînnoire: ${item.reinnoire || "—"}`,
    },
  };

  const addHomeItem = async (catKey) => {
    const cat = homeCategories[catKey];
    const item = { id: Date.now(), user_id: user.id, ...homeForm };
    await supabase.from(catKey).insert(item);
    cat.setState((prev) => [...prev, item]);
    setAddingTo(null); setHomeForm({});
  };

  const deleteHomeItem = async (catKey, id) => {
    await supabase.from(catKey).delete().eq("id", id);
    homeCategories[catKey].setState((prev) => prev.filter((i) => i.id !== id));
  };

  const updateHomeItem = async (catKey, id) => {
    const { id: _id, user_id: _uid, ...fields } = editForm;
    await supabase.from(catKey).update(fields).eq("id", id);
    homeCategories[catKey].setState((prev) =>
      prev.map((i) => i.id === id ? { ...i, ...editForm } : i)
    );
    setEditingItem(null); setEditForm({});
  };

  const handleLogin = async () => {
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: authForm.email, password: authForm.password,
    });
    if (error) { setAuthError("Email sau parolă greșită."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const u = session.user;
      setUser({ id: u.id, name: u.user_metadata?.name || u.email, email: u.email });
      setLoading(true);
      await loadUserData(u.id);
    }
  };

  const handleRegister = async () => {
    if (!authForm.name || !authForm.email || !authForm.password) {
      setAuthError("Completează toate câmpurile."); return;
    }
    if (authForm.password !== authForm.confirm) {
      setAuthError("Parolele nu coincid."); return;
    }
    setAuthError("");
    const { data, error } = await supabase.auth.signUp({
      email: authForm.email, password: authForm.password,
      options: { data: { name: authForm.name } },
    });
    if (error) { setAuthError(error.message); return; }
    if (data.user) {
      const u = data.user;
      setUser({ id: u.id, name: authForm.name, email: u.email });
      setLoading(true);
      await loadUserData(u.id);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setActivePage("dashboard");
    setAuthForm({ name: "", email: "", password: "", confirm: "" });
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = "";

    const fileId = `pdf_${Date.now()}`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const newTransactions = [];

    const catFromText = (lower) => {
      if (/gaz|fuel|petrol|benzin|combustibil|forte gaz|q8|rompetrol|mol /.test(lower)) return "Combustibil";
      if (/leasing/.test(lower)) return "Leasing";
      if (/tax|impozit|tva|onss|rsvz/.test(lower)) return "Taxe";
      if (/salar|salary|securex|payroll/.test(lower)) return "Salarii";
      if (/client|factur|invoice/.test(lower)) return "Client";
      return "Diverse";
    };

    // Detectează formatul băncii din prima pagină
    const page1 = await pdf.getPage(1);
    const tc1 = await page1.getTextContent();
    const allText1 = tc1.items.map((i) => i.str).join(" ");
    const isBNP = /BNP|GEBABEBB|BBRUBEBB|bnpparibasfortis/i.test(allText1);

    if (isBNP) {
      // ── PARSER BNP PARIBAS FORTIS ──────────────────────────────────────────
      let currentYear = new Date().getFullYear().toString();
      let lastDate = new Date().toLocaleDateString("ro-RO");

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const tc = await page.getTextContent();

        const rowMap = {};
        tc.items.forEach((item) => {
          if (!item.str.trim()) return;
          const y = Math.round(item.transform[5]);
          if (!rowMap[y]) rowMap[y] = [];
          rowMap[y].push({ text: item.str.trim(), x: Math.round(item.transform[4]) });
        });

        const sortedRows = Object.entries(rowMap)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([, cols]) => cols.sort((a, b) => a.x - b.x));

        for (const cols of sortedRows) {
          const first = cols[0];
          if (!first) continue;

          // Rând antet dată secțiune: "31-01-2026" la x<60
          if (first.x < 60 && /^\d{2}-\d{2}-\d{4}$/.test(first.text)) {
            currentYear = first.text.split("-")[2];
            continue;
          }

          // Rând tranzacție: număr 4 cifre la x<60 (ex: "0027")
          if (first.x >= 60 || !/^\d{4}$/.test(first.text)) continue;

          // Suma: ultima coloană la x≥490, format "1.234,56 -" sau "1.234,56+"
          const amtCol = cols.filter((c) => c.x >= 490).pop();
          if (!amtCol) continue;
          const amtMatch = amtCol.text.match(/^([\d.]+,\d{2})\s*([+\-])$|^([\d.]+,\d{2})([+\-])$/);
          if (!amtMatch) continue;
          const amount = parseFloat((amtMatch[1] || amtMatch[3]).replace(/\./g, "").replace(",", "."));
          const sign = amtMatch[2] || amtMatch[4];
          if (!amount || amount <= 0) continue;

          // Data valorii: la x≈442, format "DD-MM"
          const dateCol = cols.find((c) => c.x >= 430 && c.x <= 465);
          if (dateCol) {
            const dm = dateCol.text.match(/^(\d{2})-(\d{2})$/);
            if (dm) lastDate = `${dm[1]}.${dm[2]}.${currentYear}`;
          }

          // Descriere: contrapartidă la x≈305 (numele companiei), altfel tipul operațiunii
          const counterpart = cols.find((c) => c.x >= 290 && c.x <= 320);
          const opType = cols.find((c) => c.x >= 70 && c.x <= 85);
          const desc = (counterpart?.text || opType?.text || "BNP tranzacție").substring(0, 60);

          newTransactions.push({
            id: Date.now() + newTransactions.length,
            file_id: fileId,
            date: lastDate,
            description: desc,
            amount,
            type: sign === "+" ? "venit" : "cost",
            category: catFromText(desc.toLowerCase()),
          });
        }
      }
    } else if (/KBC|KREDBEBB/i.test(allText1)) {
      // ── PARSER KBC ─────────────────────────────────────────────────────────
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const tc = await page.getTextContent();

        const rowMap = {};
        tc.items.forEach((item) => {
          if (!item.str.trim()) return;
          const y = Math.round(item.transform[5]);
          if (!rowMap[y]) rowMap[y] = [];
          rowMap[y].push({ text: item.str.trim(), x: Math.round(item.transform[4]) });
        });

        // Sortăm rândurile de sus în jos (y descrescător)
        const sortedRows = Object.entries(rowMap)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([, cols]) => cols.sort((a, b) => a.x - b.x));

        let pendingTx = null;
        const pushPending = () => {
          if (!pendingTx) return;
          const { date, opType, amount, sign, details } = pendingTx;
          let desc = opType;
          for (const line of details) {
            if (/^BE\d{14,}$/.test(line.replace(/\s/g, ""))) continue;
            if (/^(ORDERING BANK|BENEFICIARY.S BANK|CARDHOLDER|WITH KBC|INFO FROM|CREDITOR REF|MANDATE REF|REFERENCE\s*:)/i.test(line)) continue;
            if (/AT \d{2}[.:]\d{2}/i.test(line)) continue;
            if (/^\d{2}-\d{2}-\d{4}/.test(line)) continue;
            if (/^\d{4}\s+\d{2}XX/.test(line)) continue;
            if (/^[A-Z0-9\/\-\.]{8,}$/.test(line) && !/\s/.test(line)) continue;
            desc = line.replace(/^(CREDITOR|OWN DESCRIPTION)\s*:\s*/i, "").trim();
            if (desc) break;
          }
          newTransactions.push({
            id: Date.now() + newTransactions.length,
            file_id: fileId,
            date, description: desc.substring(0, 60), amount,
            type: sign === "+" ? "venit" : "cost",
            category: catFromText(desc.toLowerCase()),
          });
          pendingTx = null;
        };

        for (const cols of sortedRows) {
          const first = cols[0];
          if (!first) continue;

          // Rând principal KBC: "061 15-04-2025" la x<60
          const mainMatch = first.x < 60 && first.text.match(/^(\d{3})\s+(\d{2}-\d{2}-\d{4})$/);
          if (mainMatch) {
            pushPending();
            // Suma: coloană la x≥490, format "25 000,00 -" sau "710,50 +"
            const amtCol = cols.filter((c) => c.x >= 490).pop();
            if (!amtCol) continue;
            const amtMatch = amtCol.text.match(/^([\d ]+,\d{2})\s*([+\-])$/);
            if (!amtMatch) continue;
            const amount = parseFloat(amtMatch[1].replace(/ /g, "").replace(",", "."));
            if (!amount || amount <= 0) continue;
            const [, , dateStr] = mainMatch;
            const [d, m, y] = dateStr.split("-");
            const opCol = cols.find((c) => c.x >= 120 && c.x <= 140);
            pendingTx = {
              date: `${d}.${m}.${y}`,
              opType: opCol?.text || "KBC tranzacție",
              amount,
              sign: amtMatch[2],
              details: [],
            };
            continue;
          }

          // Rând detaliu: colectăm textele pentru descriere
          if (pendingTx) {
            // Combinăm celulele de pe același rând (ex: "CREDITOR" + ": FORD")
            const lineText = cols.map((c) => c.text).join(" ").replace(/\s+/g, " ").trim();
            if (lineText && !/^(no\s+date|description|value date|amount|Balance on)/i.test(lineText)) {
              pendingTx.details.push(lineText);
            }
          }
        }
        pushPending();
      }
    } else {
      // ── PARSER GENERIC (alte bănci) ─────────────────────────────────────────
      let lastSeenDate = new Date().toLocaleDateString("ro-RO");

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const rowMap = {};
        textContent.items.forEach((item) => {
          if (!item.str.trim()) return;
          const y = Math.round(item.transform[5] / 4) * 4;
          if (!rowMap[y]) rowMap[y] = [];
          rowMap[y].push({ text: item.str.trim(), x: Math.round(item.transform[4]) });
        });

        const rows = Object.entries(rowMap)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([, cols]) => cols.sort((a, b) => a.x - b.x));

        const amountRegex = /^[+\-]?\d{1,3}(?:[. ]\d{3})*,\d{2}[+\-]?$/;
        const parseAmountCell = (text) => {
          const match = text.match(/^([+\-]?)(\d{1,3}(?:[. ]\d{3})*,\d{2})([+\-]?)$/);
          if (!match) return null;
          const sign = match[1] || match[3];
          const num = parseFloat(match[2].replace(/[. ]/g, "").replace(",", "."));
          if (isNaN(num) || num === 0) return null;
          return { amount: num, sign };
        };

        let debitX = null, creditX = null;
        for (const row of rows) {
          for (const cell of row) {
            const t = cell.text.toLowerCase();
            if (/^(debit|ieșiri|iesiri|plăți|plati|out)$/.test(t)) debitX = cell.x;
            if (/^(credit|intrări|intrari|încasări|incasari|in)$/.test(t)) creditX = cell.x;
          }
          if (debitX !== null && creditX !== null) break;
        }

        for (const row of rows) {
          const amountCells = row
            .map((c, idx) => ({ ...parseAmountCell(c.text), x: c.x, idx }))
            .filter((c) => c.amount);
          if (amountCells.length === 0) continue;

          const rowText = row.map((c) => c.text).join(" ");
          const lower = rowText.toLowerCase();
          if (/sold\s*(initial|final)|balance|total|data\s+descriere/.test(lower)) continue;

          const dateMatch = rowText.match(/(\d{2}[.\-\/]\d{2}[.\-\/]\d{2,4})|(\d{4}[.\-\/]\d{2}[.\-\/]\d{2})/);
          if (dateMatch) lastSeenDate = dateMatch[0];

          const mainAmt = amountCells[0];
          let txType = "cost", txAmount = 0;

          if (mainAmt.sign === "+") { txType = "venit"; txAmount = mainAmt.amount; }
          else if (mainAmt.sign === "-") { txType = "cost"; txAmount = mainAmt.amount; }
          else {
            const nextCell = row[mainAmt.idx + 1];
            if (nextCell?.text.trim() === "+") txType = "venit";
            else if (nextCell?.text.trim() === "-") txType = "cost";
            else if (debitX !== null && creditX !== null) {
              txType = Math.abs(mainAmt.x - creditX) < Math.abs(mainAmt.x - debitX) ? "venit" : "cost";
            } else if (/credit|received|incoming|intrare|încasat|incasat/.test(lower)) {
              txType = "venit";
            }
            txAmount = mainAmt.amount;
          }
          if (!txAmount || txAmount <= 0) continue;

          let desc = row
            .filter((c) => !amountRegex.test(c.text) && !/^\d{2}[.\-\/]/.test(c.text) && c.text !== "+" && c.text !== "-")
            .map((c) => c.text).join(" ").trim();
          if (!desc) desc = rowText.replace(amountRegex, "").replace(/[+\-]\s*$/, "").trim();
          if (!desc) continue;
          desc = desc.substring(0, 60);

          newTransactions.push({
            id: Date.now() + newTransactions.length,
            file_id: fileId,
            date: lastSeenDate, description: desc, amount: txAmount,
            type: txType, category: catFromText(lower),
          });
        }
      }
    }

    const txWithUser = newTransactions.map((t) => ({ ...t, user_id: user.id }));
    if (txWithUser.length > 0) await supabase.from("transactions").insert(txWithUser);
    const fileEntry = { id: fileId, user_id: user.id, name: file.name, date: new Date().toLocaleDateString("ro-RO"), count: newTransactions.length };
    await supabase.from("uploaded_files").insert(fileEntry);
    setTransactions((prev) => [...prev, ...newTransactions]);
    setUploadedFiles((prev) => [...prev, fileEntry]);
  };

  const deleteFile = async (fileId) => {
    await supabase.from("transactions").delete().eq("file_id", fileId);
    await supabase.from("uploaded_files").delete().eq("id", fileId);
    setTransactions((prev) => prev.filter((t) => t.file_id !== fileId));
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    setConfirmDeleteFileId(null);
  };

  const addTransaction = async () => {
    if (!description || !amount) return;
    const item = {
      id: Date.now(), user_id: user.id,
      date: new Date().toLocaleDateString("ro-RO"),
      description, amount: Number(amount), type, category,
    };
    await supabase.from("transactions").insert(item);
    setTransactions((prev) => [item, ...prev]);
    setDescription(""); setAmount("");
  };

  const deleteTransaction = async (id) => {
    await supabase.from("transactions").delete().eq("id", id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    await supabase.from("transactions").delete().in("id", ids);
    setTransactions((prev) => prev.filter((t) => !selectedIds.has(t.id)));
    setSelectedIds(new Set());
  };

  const updateTransaction = async (id) => {
    const { id: _id, user_id: _uid, created_at: _ca, ...fields } = editTxForm;
    fields.amount = Number(fields.amount);
    await supabase.from("transactions").update(fields).eq("id", id);
    setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, ...fields } : t));
    setEditingTxId(null);
    setEditTxForm({});
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(transactions.map((t) => t.id)));
  const selectNone = () => setSelectedIds(new Set());
  const allSelected = transactions.length > 0 && selectedIds.size === transactions.length;

  const venit = transactions.filter((t) => t.type === "venit").reduce((s, t) => s + t.amount, 0);
  const costuri = transactions.filter((t) => t.type === "cost").reduce((s, t) => s + t.amount, 0);
  const profit = venit - costuri;

  const formatCurrency = (value) =>
    new Intl.NumberFormat("ro-RO", { style: "currency", currency: settings.currency }).format(value);

  const answerChat = (q) => {
    const lower = q.toLowerCase();
    const fmt = formatCurrency;
    const venT = transactions.filter((t) => t.type === "venit").reduce((s, t) => s + t.amount, 0);
    const cosT = transactions.filter((t) => t.type === "cost").reduce((s, t) => s + t.amount, 0);
    const profT = venT - cosT;

    if (transactions.length === 0)
      return "Nu am nicio tranzacție înregistrată încă. Adaugă tranzacții sau importă un extras PDF.";

    // Profit / sumar general
    if (/profit|sumar|rezumat|general|situati/.test(lower)) {
      return `Situație financiară generală:\n• Venit total: ${fmt(venT)}\n• Costuri totale: ${fmt(cosT)}\n• Profit net: ${fmt(profT)}\n• Total tranzacții: ${transactions.length}`;
    }

    // Cheltuieli pe categorie
    if (/categor|cheltuiel|cost/.test(lower)) {
      const byCat = {};
      transactions.filter((t) => t.type === "cost").forEach((t) => {
        byCat[t.category] = (byCat[t.category] || 0) + t.amount;
      });
      const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      if (!sorted.length) return "Nu ai cheltuieli înregistrate.";
      return `Cheltuieli pe categorii:\n${sorted.map(([c, a]) => `• ${c}: ${fmt(a)}`).join("\n")}`;
    }

    // Venituri pe categorie
    if (/venit|incasar|intrare/.test(lower)) {
      const byCat = {};
      transactions.filter((t) => t.type === "venit").forEach((t) => {
        byCat[t.category] = (byCat[t.category] || 0) + t.amount;
      });
      const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      if (!sorted.length) return "Nu ai venituri înregistrate.";
      return `Venituri pe categorii:\n${sorted.map(([c, a]) => `• ${c}: ${fmt(a)}`).join("\n")}`;
    }

    // Cea mai mare tranzacție
    if (/mare|maxim|cel mai/.test(lower)) {
      const max = [...transactions].sort((a, b) => b.amount - a.amount)[0];
      return `Cea mai mare tranzacție:\n• ${max.description}\n• Sumă: ${fmt(max.amount)}\n• Tip: ${max.type}\n• Data: ${max.date}`;
    }

    // Luna cea mai profitabilă
    if (/luna|lun|lunar|lunar/.test(lower)) {
      const byMonth = {};
      transactions.forEach((t) => {
        const p = t.date.match(/(\d{2})[.\-\/](\d{2})[.\-\/](\d{2,4})/);
        if (!p) return;
        const key = `${p[2]}/${p[3].slice(-2)}`;
        if (!byMonth[key]) byMonth[key] = { venit: 0, cost: 0 };
        if (t.type === "venit") byMonth[key].venit += t.amount;
        else byMonth[key].cost += t.amount;
      });
      const months = Object.entries(byMonth).map(([k, v]) => ({ luna: k, profit: v.venit - v.cost, venit: v.venit, cost: v.cost }));
      const best = months.sort((a, b) => b.profit - a.profit)[0];
      const worst = months.sort((a, b) => a.profit - b.profit)[0];
      return `📈 Luna cu cel mai mare profit: ${best.luna} (${fmt(best.profit)})\n📉 Luna cu cel mai mic profit: ${worst.luna} (${fmt(worst.profit)})\n\nTop luni:\n${months.sort((a,b)=>b.profit-a.profit).slice(0,5).map(m=>`• ${m.luna}: ${fmt(m.profit)}`).join("\n")}`;
    }

    // Număr tranzacții
    if (/câte|cate|numar|număr/.test(lower)) {
      const v = transactions.filter((t) => t.type === "venit").length;
      const c = transactions.filter((t) => t.type === "cost").length;
      return `Total tranzacții: ${transactions.length}\n• Venituri: ${v}\n• Cheltuieli: ${c}`;
    }

    // Medie
    if (/medie|mediu|average/.test(lower)) {
      const avgV = venT / (transactions.filter(t=>t.type==="venit").length || 1);
      const avgC = cosT / (transactions.filter(t=>t.type==="cost").length || 1);
      return `Valori medii per tranzacție:\n• Venit mediu: ${fmt(avgV)}\n• Cheltuială medie: ${fmt(avgC)}`;
    }

    return `Nu am înțeles exact întrebarea. Poți să mă întrebi despre:\n• profit / sumar general\n• cheltuieli pe categorie\n• venituri\n• cea mai mare tranzacție\n• luna cea mai profitabilă\n• numărul de tranzacții\n• medie tranzacții`;
  };

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    const userMsg = { role: "user", text };
    const aiMsg = { role: "ai", text: answerChat(text) };
    setChatMessages((prev) => [...prev, userMsg, aiMsg]);
    setChatInput("");
  };

  const formatShort = (value) =>
    new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(value);

  // Grupează tranzacțiile pe luni pentru graficul lunar
  const monthlyData = (() => {
    const map = {};
    transactions.forEach((t) => {
      const parts = t.date.match(/(\d{2})[.\-\/](\d{2})[.\-\/](\d{2,4})/);
      if (!parts) return;
      const [, day, month, year] = parts;
      const key = `${month}/${year.slice(-2)}`;
      if (!map[key]) map[key] = { luna: key, Venit: 0, Costuri: 0 };
      if (t.type === "venit") map[key].Venit += t.amount;
      else map[key].Costuri += t.amount;
    });
    return Object.values(map)
      .sort((a, b) => {
        const [am, ay] = a.luna.split("/");
        const [bm, by] = b.luna.split("/");
        return ay !== by ? ay - by : am - bm;
      })
      .slice(-12)
      .map((d) => ({ ...d, Profit: d.Venit - d.Costuri }));
  })();

  const summaryChartData = [
    { nume: "Venit", valoare: venit },
    { nume: "Costuri", valoare: costuri },
    { nume: "Profit", valoare: profit },
  ];

  const luniRO = ["", "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
    "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];

  // Extrage toate perechile lună/an disponibile din tranzacții
  const availablePeriods = (() => {
    const set = new Set();
    transactions.forEach((t) => {
      const parts = t.date.match(/(\d{2})[.\-\/](\d{2})[.\-\/](\d{2,4})/);
      if (!parts) return;
      const month = parts[2].padStart(2, "0");
      const year = parts[3].length === 2 ? "20" + parts[3] : parts[3];
      set.add(`${month}-${year}`);
    });
    return [...set].sort((a, b) => {
      const [am, ay] = a.split("-");
      const [bm, by] = b.split("-");
      return by !== ay ? by - ay : bm - am;
    });
  })();

  const availableYears = [...new Set(availablePeriods.map((p) => p.split("-")[1]))].sort((a, b) => b - a);

  // Dacă nu e selectată nicio perioadă, folosește cea mai recentă
  const activePeriod = selectedMonth && selectedYear
    ? `${selectedMonth}-${selectedYear}`
    : availablePeriods[0] || "";

  const [activeMonth, activeYear] = activePeriod ? activePeriod.split("-") : ["", ""];

  // Filtrează tranzacțiile pentru luna/anul selectat
  const filteredTransactions = transactions.filter((t) => {
    const parts = t.date.match(/(\d{2})[.\-\/](\d{2})[.\-\/](\d{2,4})/);
    if (!parts) return false;
    const month = parts[2].padStart(2, "0");
    const year = parts[3].length === 2 ? "20" + parts[3] : parts[3];
    return month === activeMonth && year === activeYear;
  });

  const lunarVenit = filteredTransactions.filter((t) => t.type === "venit").reduce((s, t) => s + t.amount, 0);
  const lunarCosturi = filteredTransactions.filter((t) => t.type === "cost").reduce((s, t) => s + t.amount, 0);
  const lunarProfit = lunarVenit - lunarCosturi;

  // Grafic zilnic pentru luna selectată
  const dailyData = (() => {
    const map = {};
    filteredTransactions.forEach((t) => {
      const parts = t.date.match(/(\d{2})[.\-\/](\d{2})[.\-\/](\d{2,4})/);
      if (!parts) return;
      const day = parts[1];
      if (!map[day]) map[day] = { zi: day, Venit: 0, Costuri: 0 };
      if (t.type === "venit") map[day].Venit += t.amount;
      else map[day].Costuri += t.amount;
    });
    return Object.values(map)
      .sort((a, b) => Number(a.zi) - Number(b.zi))
      .map((d) => ({ ...d, Profit: d.Venit - d.Costuri }));
  })();

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "40px", height: "40px", border: "4px solid #e5e7eb", borderTop: "4px solid #2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#6b7280", fontSize: "14px" }}>Se încarcă datele...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── LOGIN / REGISTER PAGE ──────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={styles.authPage}>
        <div style={styles.authCard}>
          <h2 style={styles.authLogo}>{settings.companyName}</h2>
          <p style={styles.authSub}>
            {authMode === "login" ? "Intră în cont" : "Creează cont nou"}
          </p>

          {authMode === "register" && (
            <input style={styles.authInput} placeholder="Nume complet"
              value={authForm.name}
              onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} />
          )}
          <input style={styles.authInput} placeholder="Email" type="email"
            value={authForm.email}
            onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} />
          <input style={styles.authInput} placeholder="Parolă" type="password"
            value={authForm.password}
            onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} />
          {authMode === "register" && (
            <input style={styles.authInput} placeholder="Confirmă parola" type="password"
              value={authForm.confirm}
              onChange={(e) => setAuthForm({ ...authForm, confirm: e.target.value })} />
          )}

          {authError && <p style={styles.authError}>{authError}</p>}

          <button style={styles.authButton}
            onClick={authMode === "login" ? handleLogin : handleRegister}>
            {authMode === "login" ? "Intră" : "Înregistrează-te"}
          </button>

          <p style={styles.authSwitch}>
            {authMode === "login" ? "Nu ai cont? " : "Ai deja cont? "}
            <span style={styles.authLink}
              onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}>
              {authMode === "login" ? "Înregistrează-te" : "Intră"}
            </span>
          </p>
        </div>
      </div>
    );
  }

  // ── MAIN APP ───────────────────────────────────────────────────────────────
  const menuItems = [
    { id: "home",        label: "Home",         icon: "⌂" },
    { id: "dashboard",   label: "Dashboard",    icon: "⬡" },
    { id: "tranzactii",  label: "Tranzacții",   icon: "⇄" },
    { id: "asistent",    label: "Asistent AI",  icon: "◈" },
    { id: "setari",      label: "Setări",       icon: "⚙" },
  ];

  return (
    <div style={styles.page}>

      {/* Buton toggle mereu vizibil */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: "fixed",
          top: "50%",
          transform: "translateY(-50%)",
          left: sidebarOpen ? "204px" : "8px",
          zIndex: 200,
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          border: "1px solid rgba(99,179,237,0.4)",
          background: "rgba(15,12,41,0.95)",
          color: "#63b3ed",
          cursor: "pointer",
          fontSize: "14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 12px rgba(99,179,237,0.3)",
          transition: "left 0.3s ease",
        }}
      >
        {sidebarOpen ? "◀" : "▶"}
      </button>

      <aside style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        width: sidebarOpen ? "220px" : "0px",
        overflow: "hidden",
        transition: "width 0.3s ease",
        background: "linear-gradient(160deg, #0a0a1a 0%, #111132 50%, #0d1224 100%)",
        borderRight: "1px solid rgba(99,179,237,0.15)",
        display: "flex",
        flexDirection: "column",
        padding: sidebarOpen ? "24px 16px" : "0",
        boxShadow: "4px 0 24px rgba(0,0,0,0.4)",
        zIndex: 100,
        overflowY: "auto",
        boxSizing: "border-box",
      }}>

        {/* Logo */}
        <h2 style={{
          margin: "0 0 0 0",
          fontSize: "22px",
          fontWeight: "800",
          color: "#f59e0b",
          cursor: "pointer",
          letterSpacing: "1px",
          textShadow: "0 0 20px rgba(245,158,11,0.5)",
          whiteSpace: "nowrap",
        }} onClick={() => setActivePage("home")}>
          {settings.companyName}
        </h2>

        {/* Linie decorativă */}
        <div style={{ height: "1px", background: "linear-gradient(90deg, rgba(99,179,237,0.5), transparent)", margin: "14px 0" }} />

        {/* User box */}
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          background: "rgba(99,179,237,0.07)",
          border: "1px solid rgba(99,179,237,0.15)",
          borderRadius: "12px", padding: "10px 12px",
          marginBottom: "24px",
        }}>
          <div style={{
            width: "34px", height: "34px", borderRadius: "50%",
            background: "linear-gradient(135deg, #2563eb, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: "bold", fontSize: "15px", color: "white", flexShrink: 0,
            boxShadow: "0 0 10px rgba(99,179,237,0.3)",
          }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "bold", color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</p>
            <p style={{ margin: 0, fontSize: "11px", color: "rgba(148,163,184,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</p>
          </div>
          <button onClick={handleLogout} title="Deconectare" style={{
            background: "none", border: "none", color: "rgba(148,163,184,0.7)",
            cursor: "pointer", fontSize: "16px", flexShrink: 0, padding: "2px",
          }}>↩</button>
        </div>

        {/* Meniu */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {menuItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <div key={item.id} onClick={() => setActivePage(item.id)} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "11px 14px", borderRadius: "10px", cursor: "pointer",
                whiteSpace: "nowrap",
                background: isActive ? "rgba(99,179,237,0.15)" : "transparent",
                border: isActive ? "1px solid rgba(99,179,237,0.35)" : "1px solid transparent",
                color: isActive ? "#93c5fd" : "rgba(148,163,184,0.8)",
                fontWeight: isActive ? "600" : "400",
                fontSize: "14px",
                boxShadow: isActive ? "0 0 12px rgba(99,179,237,0.15), inset 0 0 10px rgba(99,179,237,0.05)" : "none",
                transition: "all 0.2s ease",
              }}>
                <span style={{ fontSize: "16px", opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
                {item.label}
                {isActive && <span style={{ marginLeft: "auto", width: "5px", height: "5px", borderRadius: "50%", background: "#63b3ed", boxShadow: "0 0 6px #63b3ed" }} />}
              </div>
            );
          })}
        </nav>

        {/* Footer sidebar */}
        <div style={{ marginTop: "auto", paddingTop: "20px" }}>
          <div style={{ height: "1px", background: "linear-gradient(90deg, rgba(99,179,237,0.3), transparent)", marginBottom: "12px" }} />
          <p style={{ margin: 0, fontSize: "10px", color: "rgba(148,163,184,0.4)", letterSpacing: "1px", textTransform: "uppercase" }}>
            Versiune MVP
          </p>
        </div>
      </aside>

      <main style={{ ...styles.main, marginLeft: sidebarOpen ? "220px" : "0px", transition: "margin-left 0.3s ease" }}>

        {/* HOME */}
        {activePage === "home" && (
          <>
            <div style={styles.header}>
              <div>
                <h1 style={styles.title}>{settings.companyName}</h1>
                <p style={styles.subtitle}>Gestionează resursele firmei tale.</p>
              </div>
            </div>

            {(() => {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const alerts = flota.filter((car) => {
                if (!car.keuring_expirare) return false;
                const p = car.keuring_expirare.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);
                if (!p) return false;
                const exp = new Date(Number(p[3]), Number(p[2]) - 1, Number(p[1]));
                return Math.ceil((exp - today) / 86400000) <= 10;
              });
              if (alerts.length === 0) return null;
              return (
                <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {alerts.map((car) => {
                    const p = car.keuring_expirare.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);
                    const exp = new Date(Number(p[3]), Number(p[2]) - 1, Number(p[1]));
                    const days = Math.ceil((exp - today) / 86400000);
                    return (
                      <div key={car.id} style={{ background: days <= 0 ? "#fef2f2" : "#fffbeb", border: `1px solid ${days <= 0 ? "#fca5a5" : "#fcd34d"}`, borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "20px" }}>{days <= 0 ? "🚨" : "⚠️"}</span>
                        <div>
                          <p style={{ margin: 0, fontWeight: "700", fontSize: "14px", color: days <= 0 ? "#dc2626" : "#92400e" }}>
                            Keuring {days <= 0 ? "expirat!" : `expiră în ${days} ${days === 1 ? "zi" : "zile"}!`}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>
                            {car.marca} {car.model} ({car.numar}) — {car.keuring_expirare}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {Object.entries(homeCategories).map(([catKey, cat]) => (
                <section key={catKey} style={{ ...styles.panel, marginBottom: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ margin: 0, fontSize: "17px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>{cat.icon}</span> {cat.label}
                      <span style={{ marginLeft: "6px", background: "#f3f4f6", borderRadius: "20px", padding: "2px 10px", fontSize: "12px", color: "#6b7280" }}>
                        {cat.state.length}
                      </span>
                    </h3>
                    <button
                      style={{ ...styles.button, padding: "7px 14px", fontSize: "13px", background: cat.color }}
                      onClick={() => { setAddingTo(addingTo === catKey ? null : catKey); setHomeForm({}); }}
                    >
                      {addingTo === catKey ? "Anulează" : "+ Adaugă"}
                    </button>
                  </div>

                  {addingTo === catKey && (
                    <div style={{ background: "#f9fafb", borderRadius: "10px", padding: "14px", marginBottom: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {cat.fields.map((f) => (
                        <div key={f.key} style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: "8px" }}>
                          <label style={{ fontSize: "12px", color: "#6b7280", fontWeight: "bold" }}>{f.label}</label>
                          <input
                            style={{ ...styles.input, padding: "8px 10px", fontSize: "13px" }}
                            placeholder={f.placeholder}
                            value={homeForm[f.key] || ""}
                            onChange={(e) => setHomeForm({ ...homeForm, [f.key]: e.target.value })}
                          />
                        </div>
                      ))}
                      <button style={{ ...styles.button, marginTop: "4px", background: cat.color, alignSelf: "flex-end" }}
                        onClick={() => addHomeItem(catKey)}>
                        Salvează
                      </button>
                    </div>
                  )}

                  {cat.state.length === 0 ? (
                    <p style={{ ...styles.empty, padding: "12px 0" }}>Nicio intrare adăugată încă.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {cat.state.map((item) => {
                        const isExpanded = expandedItem === item.id;
                        return (
                          <div key={item.id} style={{ borderRadius: "10px", border: `1px solid ${isExpanded ? cat.color + "60" : "#e5e7eb"}`, overflow: "hidden", transition: "border 0.2s" }}>
                            {/* Rând principal — click pentru expand */}
                            <div
                              onClick={() => { setExpandedItem(isExpanded ? null : item.id); if (editingItem === item.id) { setEditingItem(null); setEditForm({}); } }}
                              style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: isExpanded ? cat.color + "10" : "#f9fafb", cursor: "pointer" }}>
                              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.display(item)}</p>
                                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.sub(item)}</p>
                              </div>
                              <span style={{ fontSize: "11px", color: cat.color, fontWeight: "bold", marginRight: "6px" }}>{isExpanded ? "▲" : "▼"}</span>
                              <button
                                style={{ ...styles.deleteButton, background: "#eff6ff", color: "#2563eb", marginRight: "4px" }}
                                onClick={(e) => { e.stopPropagation(); setEditingItem(item.id); setEditForm({ ...item }); setExpandedItem(item.id); }}>
                                ✏
                              </button>
                              <button
                                style={styles.deleteButton}
                                onClick={(e) => { e.stopPropagation(); deleteHomeItem(catKey, item.id); }}>
                                ✕
                              </button>
                            </div>

                            {/* Detalii expandate */}
                            {isExpanded && (
                              <div style={{ padding: "12px 16px", background: "white", borderTop: `1px solid ${cat.color}30` }}>
                                {editingItem === item.id ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {cat.fields.map((f) => (
                                      <div key={f.key} style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: "8px" }}>
                                        <label style={{ fontSize: "12px", color: "#6b7280", fontWeight: "bold" }}>{f.label}</label>
                                        <input
                                          style={{ ...styles.input, padding: "8px 10px", fontSize: "13px" }}
                                          placeholder={f.placeholder}
                                          value={editForm[f.key] || ""}
                                          onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                                        />
                                      </div>
                                    ))}
                                    <div style={{ display: "flex", gap: "8px", marginTop: "4px", justifyContent: "flex-end" }}>
                                      <button style={{ ...styles.button, background: "#6b7280", padding: "7px 14px", fontSize: "13px" }}
                                        onClick={() => { setEditingItem(null); setEditForm({}); }}>
                                        Anulează
                                      </button>
                                      <button style={{ ...styles.button, background: cat.color, padding: "7px 14px", fontSize: "13px" }}
                                        onClick={() => updateHomeItem(catKey, item.id)}>
                                        Salvează
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px" }}>
                                    {cat.fields.map((f) => item[f.key] ? (
                                      <div key={f.key}>
                                        <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px" }}>{f.label}</p>
                                        <p style={{ margin: "2px 0 0", fontSize: "14px", color: "#111827", fontWeight: "500" }}>{item[f.key]}</p>
                                      </div>
                                    ) : null)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </>
        )}

        {/* DASHBOARD */}
        {activePage === "dashboard" && (
          <>
            {/* HEADER */}
            <div style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#9ca3af", letterSpacing: "1px", textTransform: "uppercase" }}>
                  {new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
                <h1 style={{ margin: 0, fontSize: "30px", fontWeight: "700", color: "#111827" }}>
                  Bună, {user.name.split(" ")[0]} 👋
                </h1>
                <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
                  Iată situația financiară a firmei tale.
                </p>
              </div>
              <button style={{ ...styles.button, fontSize: "13px", padding: "9px 16px" }}
                onClick={() => setActivePage("tranzactii")}>
                + Adaugă tranzacție
              </button>
            </div>

            {/* KPI CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "18px", marginBottom: "24px" }}>
              {[
                { label: "Venit total", value: venit, icon: "↑", bg: "linear-gradient(135deg, #065f46, #10b981)", shadow: "0 8px 24px rgba(16,185,129,0.25)" },
                { label: "Costuri totale", value: costuri, icon: "↓", bg: "linear-gradient(135deg, #7f1d1d, #ef4444)", shadow: "0 8px 24px rgba(239,68,68,0.25)" },
                { label: "Profit net", value: profit, icon: profit >= 0 ? "◈" : "▼", bg: profit >= 0 ? "linear-gradient(135deg, #1e3a5f, #2563eb)" : "linear-gradient(135deg, #78350f, #f59e0b)", shadow: profit >= 0 ? "0 8px 24px rgba(37,99,235,0.25)" : "0 8px 24px rgba(245,158,11,0.25)" },
              ].map((card) => (
                <div key={card.label} style={{ background: card.bg, borderRadius: "18px", padding: "22px 24px", boxShadow: card.shadow, color: "white" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <p style={{ margin: 0, fontSize: "13px", opacity: 0.8, letterSpacing: "0.5px" }}>{card.label}</p>
                    <span style={{ fontSize: "20px", opacity: 0.7 }}>{card.icon}</span>
                  </div>
                  <h2 style={{ margin: "10px 0 0", fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px" }}>
                    {formatCurrency(card.value)}
                  </h2>
                  <p style={{ margin: "8px 0 0", fontSize: "12px", opacity: 0.65 }}>
                    din {transactions.length} tranzacții totale
                  </p>
                </div>
              ))}
            </div>

            {/* GRAFIC EVOLUTIE LUNARA — full width */}
            <section style={{ ...styles.panel, marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={styles.sectionTitle}>Evoluție lunară</h3>
                <div style={{ display: "flex", gap: "10px" }}>
                  {[["#16a34a", "Venit"], ["#ef4444", "Costuri"], ["#2563eb", "Profit"]].map(([c, l]) => (
                    <span key={l} style={{ fontSize: "12px", color: "#6b7280", display: "flex", alignItems: "center", gap: "5px" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: c, display: "inline-block" }} />{l}
                    </span>
                  ))}
                </div>
              </div>
              {monthlyData.length === 0 ? (
                <p style={styles.empty}>Nu există date încă. Adaugă tranzacții pentru a vedea graficul.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyData} barSize={14} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="luna" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={formatShort} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={65} />
                    <Tooltip contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} formatter={(v) => formatCurrency(v)} />
                    <Bar dataKey="Venit" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Costuri" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Profit" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            {/* ANALIZA LUNARA + TRANZACTII RECENTE — doua coloane */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "24px", marginBottom: "24px" }}>

              {/* Analiza lunara */}
              <section style={{ ...styles.panel, marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={styles.sectionTitle}>{luniRO[Number(activeMonth)] || "Lună"} {activeYear}</h3>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <select style={{ ...styles.filterSelect, padding: "5px 8px", fontSize: "12px" }}
                      value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                      {availablePeriods.map((p) => {
                        const [m] = p.split("-");
                        return <option key={p} value={m}>{luniRO[Number(m)]}</option>;
                      }).filter((el, idx, arr) => arr.findIndex((e) => e.props.value === el.props.value) === idx)}
                    </select>
                    <select style={{ ...styles.filterSelect, padding: "5px 8px", fontSize: "12px" }}
                      value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                      {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[
                    { label: "Venit", value: lunarVenit, color: "#16a34a", bg: "#f0fdf4" },
                    { label: "Costuri", value: lunarCosturi, color: "#dc2626", bg: "#fef2f2" },
                    { label: "Profit", value: lunarProfit, color: lunarProfit >= 0 ? "#2563eb" : "#dc2626", bg: lunarProfit >= 0 ? "#eff6ff" : "#fef2f2" },
                    { label: "Tranzacții", value: filteredTransactions.length, color: "#6b7280", bg: "#f9fafb", isCnt: true },
                  ].map((row) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: row.bg, borderRadius: "10px" }}>
                      <span style={{ fontSize: "13px", color: "#374151", fontWeight: "500" }}>{row.label}</span>
                      <span style={{ fontSize: "16px", fontWeight: "700", color: row.color }}>
                        {row.isCnt ? row.value : formatCurrency(row.value)}
                      </span>
                    </div>
                  ))}
                </div>

                {dailyData.length > 0 && (
                  <div style={{ marginTop: "16px" }}>
                    <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#9ca3af" }}>Evoluție zilnică</p>
                    <ResponsiveContainer width="100%" height={130}>
                      <BarChart data={dailyData} barSize={8}>
                        <CartesianGrid strokeDasharray="2 2" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="zi" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} formatter={(v) => formatCurrency(v)} labelFormatter={(l) => `Ziua ${l}`} />
                        <Bar dataKey="Venit" fill="#16a34a" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Costuri" fill="#ef4444" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              {/* Tranzactii recente */}
              <section style={{ ...styles.panel, marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={styles.sectionTitle}>Tranzacții recente</h3>
                  <button style={styles.linkButton} onClick={() => setActivePage("tranzactii")}>Vezi toate →</button>
                </div>
                {transactions.length === 0 ? (
                  <p style={styles.empty}>Nu ai tranzacții încă.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    {transactions.slice(0, 8).map((t) => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "10px", transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: t.type === "venit" ? "#f0fdf4" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                          {t.type === "venit" ? "↑" : "↓"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.description}</p>
                          <p style={{ margin: "1px 0 0", fontSize: "11px", color: "#9ca3af" }}>{t.date} · {t.category}</p>
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: "700", color: t.type === "venit" ? "#16a34a" : "#dc2626", flexShrink: 0 }}>
                          {t.type === "venit" ? "+" : "-"}{formatCurrency(t.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {/* TRANZACȚII */}
        {activePage === "tranzactii" && (
          <>
            <div style={styles.header}>
              <div>
                <h1 style={styles.title}>Tranzacții</h1>
                <p style={styles.subtitle}>Adaugă și gestionează toate tranzacțiile firmei.</p>
              </div>
            </div>

            <section style={styles.panel}>
              <h3 style={styles.sectionTitle}>Adaugă tranzacție manuală</h3>
              <div style={styles.form}>
                <input style={styles.input} placeholder="Descriere, ex: Decat / Q8 / Ford"
                  value={description} onChange={(e) => setDescription(e.target.value)} />
                <input style={styles.input} type="number" placeholder="Sumă"
                  value={amount} onChange={(e) => setAmount(e.target.value)} />
                <select style={styles.input} value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="venit">Venit</option>
                  <option value="cost">Cost</option>
                </select>
                <select style={styles.input} value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option>Client</option><option>Salarii</option><option>Subcontractori</option>
                  <option>Combustibil</option><option>Leasing</option><option>Materiale</option>
                  <option>Taxe</option><option>Diverse</option>
                </select>
                <button style={styles.button} onClick={addTransaction}>Adaugă</button>
              </div>
              <div style={{ marginTop: "24px", borderTop: "1px solid #e5e7eb", paddingTop: "20px" }}>
                <h3 style={{ marginTop: 0, marginBottom: "12px", fontSize: "16px" }}>Import extras bancar PDF</h3>
                <input type="file" accept="application/pdf" onChange={handlePdfUpload} />

                <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {uploadedFiles.length === 0 ? (
                    <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
                      Niciun fișier importat încă. Fișierele vor apărea aici după import.
                    </p>
                  ) : (
                    uploadedFiles.map((f) => (
                      <div key={f.id} style={styles.fileRow}>
                        <div style={styles.fileIcon}>PDF</div>
                        <div style={{ flex: 1 }}>
                          <p style={styles.fileName}>{f.name}</p>
                          <p style={styles.fileMeta}>
                            Adăugat pe {f.date} · {f.count} tranzacții importate
                          </p>
                        </div>
                        {confirmDeleteFileId === f.id ? (
                          <div style={styles.confirmBox}>
                            <span style={{ fontSize: "13px", color: "#374151" }}>Ștergi fișierul și tranzacțiile importate?</span>
                            <button style={styles.confirmYes} onClick={() => deleteFile(f.id)}>Da, șterge</button>
                            <button style={styles.confirmNo} onClick={() => setConfirmDeleteFileId(null)}>Anulează</button>
                          </div>
                        ) : (
                          <button style={styles.fileDeleteBtn} onClick={() => setConfirmDeleteFileId(f.id)}>✕</button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section style={styles.panel}>
              {/* Tab-uri filtrare */}
              {(() => {
                const totalVenit = transactions.filter(t => t.type === "venit").reduce((s, t) => s + t.amount, 0);
                const totalCost = transactions.filter(t => t.type === "cost").reduce((s, t) => s + t.amount, 0);
                const filteredTx = transactions.filter(t =>
                  txFilter === "toate" ? true : txFilter === "venituri" ? t.type === "venit" : t.type === "cost"
                );
                const totalPages = Math.ceil(filteredTx.length / pageSize);
                const pageTx = filteredTx.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                const allSelectedFiltered = filteredTx.length > 0 && filteredTx.every(t => selectedIds.has(t.id));

                return (
                  <>
                    {/* Sumare + tabs */}
                    <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
                      {[
                        { key: "toate", label: "Toate", count: transactions.length, color: "#6b7280", bg: "#f3f4f6" },
                        { key: "venituri", label: "Venituri", count: transactions.filter(t => t.type === "venit").length, total: totalVenit, color: "#16a34a", bg: "#f0fdf4" },
                        { key: "cheltuieli", label: "Cheltuieli", count: transactions.filter(t => t.type === "cost").length, total: totalCost, color: "#dc2626", bg: "#fef2f2" },
                      ].map(tab => (
                        <button key={tab.key} onClick={() => { setTxFilter(tab.key); setCurrentPage(1); }} style={{
                          flex: 1, minWidth: "120px", padding: "12px 16px", borderRadius: "12px", border: `2px solid ${txFilter === tab.key ? tab.color : "transparent"}`,
                          background: txFilter === tab.key ? tab.bg : "#f9fafb", cursor: "pointer", textAlign: "left",
                          boxShadow: txFilter === tab.key ? `0 0 0 3px ${tab.color}20` : "none", transition: "all 0.15s",
                        }}>
                          <p style={{ margin: 0, fontSize: "12px", color: txFilter === tab.key ? tab.color : "#9ca3af", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>{tab.label}</p>
                          <p style={{ margin: "4px 0 0", fontSize: "18px", fontWeight: "800", color: txFilter === tab.key ? tab.color : "#374151" }}>{tab.count} tranzacții</p>
                          {tab.total !== undefined && (
                            <p style={{ margin: "2px 0 0", fontSize: "13px", color: tab.color, fontWeight: "600" }}>{formatCurrency(tab.total)}</p>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Bara de acțiuni */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <button style={styles.selectBtn} onClick={() => {
                          if (allSelectedFiltered) {
                            setSelectedIds(prev => { const n = new Set(prev); filteredTx.forEach(t => n.delete(t.id)); return n; });
                          } else {
                            setSelectedIds(prev => { const n = new Set(prev); filteredTx.forEach(t => n.add(t.id)); return n; });
                          }
                        }}>
                          {allSelectedFiltered ? "Deselectează tot" : "Selectează tot"}
                        </button>
                        {selectedIds.size > 0 && (
                          <button style={styles.deleteSelectedBtn} onClick={deleteSelected}>
                            Șterge selectate ({selectedIds.size})
                          </button>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13px", color: "#6b7280" }}>Rânduri:</span>
                        {[15, 50, 100].map(n => (
                          <button key={n} style={pageSize === n ? styles.pageSizeActive : styles.pageSizeBtn}
                            onClick={() => { setPageSize(n); setCurrentPage(1); }}>{n}</button>
                        ))}
                      </div>
                    </div>

                    {/* Tabel */}
                    <div style={styles.table}>
                      <div style={{ ...styles.tableHeader, gridTemplateColumns: "32px 1fr 2fr 1.3fr 1fr 1fr auto" }}>
                        <input type="checkbox" checked={allSelectedFiltered}
                          onChange={() => {
                            if (allSelectedFiltered) {
                              setSelectedIds(prev => { const n = new Set(prev); filteredTx.forEach(t => n.delete(t.id)); return n; });
                            } else {
                              setSelectedIds(prev => { const n = new Set(prev); filteredTx.forEach(t => n.add(t.id)); return n; });
                            }
                          }}
                          style={{ cursor: "pointer" }} />
                        <span>Data</span><span>Descriere</span><span>Categorie</span>
                        <span>Tip</span><span>Sumă</span><span></span>
                      </div>
                      {filteredTx.length === 0 ? (
                        <p style={styles.empty}>Nicio tranzacție în această categorie.</p>
                      ) : (
                        pageTx.map(t => editingTxId === t.id ? (
                          <div key={t.id} style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", background: "#f0f9ff", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                            <input style={{ ...styles.input, padding: "5px 8px", fontSize: "12px", width: "100px" }} value={editTxForm.date || ""} onChange={e => setEditTxForm({ ...editTxForm, date: e.target.value })} placeholder="Data" />
                            <input style={{ ...styles.input, padding: "5px 8px", fontSize: "12px", flex: 1, minWidth: "120px" }} value={editTxForm.description || ""} onChange={e => setEditTxForm({ ...editTxForm, description: e.target.value })} placeholder="Descriere" />
                            <select style={{ ...styles.input, padding: "5px 8px", fontSize: "12px", width: "120px" }} value={editTxForm.category || ""} onChange={e => setEditTxForm({ ...editTxForm, category: e.target.value })}>
                              <option>Client</option><option>Salarii</option><option>Subcontractori</option>
                              <option>Combustibil</option><option>Leasing</option><option>Materiale</option>
                              <option>Taxe</option><option>Diverse</option>
                            </select>
                            <select style={{ ...styles.input, padding: "5px 8px", fontSize: "12px", width: "90px" }} value={editTxForm.type || ""} onChange={e => setEditTxForm({ ...editTxForm, type: e.target.value })}>
                              <option value="venit">Venit</option>
                              <option value="cost">Cost</option>
                            </select>
                            <input style={{ ...styles.input, padding: "5px 8px", fontSize: "12px", width: "90px" }} type="number" value={editTxForm.amount || ""} onChange={e => setEditTxForm({ ...editTxForm, amount: e.target.value })} placeholder="Sumă" />
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button style={{ ...styles.button, padding: "5px 12px", fontSize: "12px" }} onClick={() => updateTransaction(t.id)}>Salvează</button>
                              <button style={{ ...styles.button, padding: "5px 12px", fontSize: "12px", background: "#6b7280" }} onClick={() => { setEditingTxId(null); setEditTxForm({}); }}>Anulează</button>
                            </div>
                          </div>
                        ) : (
                          <div key={t.id} style={{
                            ...styles.tableRow,
                            gridTemplateColumns: "32px 1fr 2fr 1.3fr 1fr 1fr auto",
                            background: selectedIds.has(t.id) ? "#eff6ff" : "transparent",
                          }}>
                            <input type="checkbox" checked={selectedIds.has(t.id)}
                              onChange={() => toggleSelect(t.id)} style={{ cursor: "pointer" }} />
                            <span>{t.date}</span>
                            <strong>{t.description}</strong>
                            <span>{t.category}</span>
                            <span style={t.type === "venit" ? styles.income : styles.cost}>{t.type}</span>
                            <strong style={{ color: t.type === "venit" ? "#16a34a" : "#dc2626" }}>{formatCurrency(t.amount)}</strong>
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button style={{ ...styles.deleteButton, background: "#eff6ff", color: "#2563eb" }} onClick={() => { setEditingTxId(t.id); setEditTxForm({ ...t }); }}>✏</button>
                              <button style={styles.deleteButton} onClick={() => deleteTransaction(t.id)}>✕</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Paginare */}
                    {filteredTx.length > pageSize && (
                      <div style={styles.pagination}>
                        <button style={styles.pageBtn} disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => p - 1)}>← Anterior</button>
                        <span style={styles.pageInfo}>
                          Pagina {currentPage} din {totalPages}
                          {" "}({(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredTx.length)} din {filteredTx.length})
                        </span>
                        <button style={styles.pageBtn} disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => p + 1)}>Următor →</button>
                      </div>
                    )}
                  </>
                );
              })()}
            </section>
          </>
        )}

        {/* ASISTENT AI */}
        {activePage === "asistent" && (
          <>
            <div style={styles.header}>
              <div>
                <h1 style={styles.title}>Asistent AI</h1>
                <p style={styles.subtitle}>Întreabă-mă orice despre finanțele firmei tale.</p>
              </div>
            </div>

            <section style={{ ...styles.panel, display: "flex", flexDirection: "column", height: "60vh" }}>
              <div style={styles.chatSuggestions}>
                {["Care e profitul total?", "Cheltuieli pe categorie", "Luna cea mai profitabilă", "Cea mai mare tranzacție"].map((s) => (
                  <button key={s} style={styles.suggestionBtn}
                    onClick={() => { setChatInput(s); }}>
                    {s}
                  </button>
                ))}
              </div>

              <div style={styles.chatMessages}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={msg.role === "user" ? styles.chatUser : styles.chatAi}>
                    {msg.role === "ai" && <div style={styles.chatAiLabel}>AI</div>}
                    <div style={msg.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAi}>
                      {msg.text.split("\n").map((line, j) => (
                        <span key={j}>{line}<br /></span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.chatInputRow}>
                <input
                  style={styles.chatInput}
                  placeholder="Scrie o întrebare despre finanțele tale..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                />
                <button style={styles.chatSendBtn} onClick={sendChat}>Trimite</button>
              </div>
            </section>
          </>
        )}

        {/* SETĂRI */}
        {activePage === "setari" && (
          <>
            <div style={styles.header}>
              <div>
                <h1 style={styles.title}>Setări</h1>
                <p style={styles.subtitle}>Configurează aplicația după nevoile firmei tale.</p>
              </div>
            </div>

            <section style={styles.panel}>
              <h3 style={styles.sectionTitle}>Firmă</h3>
              <div style={styles.settingsGrid}>
                <label style={styles.label}>Numele firmei</label>
                <input style={styles.input} value={settingsForm.companyName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, companyName: e.target.value })} />
                <label style={styles.label}>Monedă</label>
                <select style={styles.input} value={settingsForm.currency}
                  onChange={(e) => setSettingsForm({ ...settingsForm, currency: e.target.value })}>
                  <option value="EUR">EUR — Euro</option>
                  <option value="RON">RON — Leu românesc</option>
                  <option value="USD">USD — Dolar american</option>
                </select>
              </div>
              <button style={{ ...styles.button, marginTop: "16px" }}
                onClick={async () => {
                  setSettings(settingsForm);
                  await supabase.from("settings").upsert({ user_id: user.id, company_name: settingsForm.companyName, currency: settingsForm.currency });
                }}>
                Salvează
              </button>
            </section>

            <section style={styles.panel}>
              <h3 style={styles.sectionTitle}>Cont</h3>
              <div style={styles.settingsGrid}>
                <label style={styles.label}>Nume</label>
                <p style={styles.settingsValue}>{user.name}</p>
                <label style={styles.label}>Email</label>
                <p style={styles.settingsValue}>{user.email}</p>
              </div>
              <button style={{ ...styles.button, marginTop: "16px", background: "#dc2626" }}
                onClick={handleLogout}>
                Deconectare
              </button>
            </section>
          </>
        )}

      </main>
    </div>
  );
}

const styles = {
  // ── AUTH ──
  authPage: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#f3f4f6", fontFamily: "Arial, sans-serif",
  },
  authCard: {
    background: "white", padding: "40px", borderRadius: "20px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.1)", width: "360px", display: "flex",
    flexDirection: "column", gap: "12px",
  },
  authLogo: { margin: 0, fontSize: "26px", color: "#f59e0b", textAlign: "center" },
  authSub: { margin: 0, textAlign: "center", color: "#6b7280", fontSize: "14px" },
  authInput: {
    padding: "12px", borderRadius: "10px", border: "1px solid #d1d5db",
    fontSize: "14px", outline: "none",
  },
  authButton: {
    background: "#2563eb", color: "white", border: "none", borderRadius: "10px",
    padding: "13px", cursor: "pointer", fontWeight: "bold", fontSize: "15px",
  },
  authError: { color: "#dc2626", fontSize: "13px", margin: 0 },
  authSwitch: { textAlign: "center", fontSize: "13px", color: "#6b7280", margin: 0 },
  authLink: { color: "#2563eb", cursor: "pointer", fontWeight: "bold" },

  // ── LAYOUT ──
  page: {
    minHeight: "100vh", display: "flex", background: "#f3f4f6",
    color: "#111827", fontFamily: "Arial, sans-serif",
  },

  main: { flex: 1, padding: "30px" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px",
  },
  title: { margin: 0, fontSize: "34px" },
  subtitle: { marginTop: "8px", color: "#6b7280" },
  badge: {
    background: "#dbeafe", color: "#1d4ed8", padding: "10px 14px",
    borderRadius: "999px", fontWeight: "bold",
  },
  cards: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "24px" },
  card: { background: "white", padding: "22px", borderRadius: "16px", boxShadow: "0 8px 20px rgba(0,0,0,0.06)" },
  cardLabel: { margin: 0, color: "#6b7280" },
  cardValue: { margin: "10px 0 0", fontSize: "28px" },
  panel: {
    background: "white", padding: "22px", borderRadius: "16px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.06)", marginBottom: "24px",
  },
  sectionTitle: { marginTop: 0 },
  form: { display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "10px" },
  input: { padding: "12px", borderRadius: "10px", border: "1px solid #d1d5db", fontSize: "14px" },
  button: {
    background: "#2563eb", color: "white", border: "none", borderRadius: "10px",
    padding: "12px 18px", cursor: "pointer", fontWeight: "bold",
  },
  table: { width: "100%" },
  tableHeader: {
    display: "grid", gridTemplateColumns: "1fr 2fr 1.3fr 1fr 1fr auto",
    gap: "10px", padding: "8px 12px", background: "#f9fafb",
    borderRadius: "10px", color: "#6b7280", fontWeight: "bold", fontSize: "12px",
  },
  tableRow: {
    display: "grid", gridTemplateColumns: "1fr 2fr 1.3fr 1fr 1fr auto",
    gap: "10px", padding: "9px 12px", borderBottom: "1px solid #e5e7eb", alignItems: "center",
    fontSize: "12px",
  },
  income: { color: "#16a34a", fontWeight: "bold" },
  cost: { color: "#dc2626", fontWeight: "bold" },
  deleteButton: {
    background: "#fee2e2", color: "#991b1b", border: "none",
    borderRadius: "8px", padding: "8px 10px", cursor: "pointer",
  },
  empty: { color: "#6b7280", padding: "20px" },
  linkButton: {
    background: "none", border: "none", color: "#2563eb",
    cursor: "pointer", fontWeight: "bold", fontSize: "14px",
  },
  chartsRow: {
    display: "flex", gap: "24px", marginBottom: "24px",
  },
  lunarCards: {
    display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px",
  },
  lunarCard: {
    background: "#f9fafb", padding: "14px 16px", borderRadius: "12px",
  },
  filterSelect: {
    padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db",
    fontSize: "14px", background: "white", cursor: "pointer",
  },
  selectBtn: {
    background: "white", border: "1px solid #d1d5db", borderRadius: "8px",
    padding: "7px 14px", cursor: "pointer", fontSize: "13px", color: "#374151", fontWeight: "bold",
  },
  deleteSelectedBtn: {
    background: "#dc2626", color: "white", border: "none", borderRadius: "8px",
    padding: "7px 14px", cursor: "pointer", fontSize: "13px", fontWeight: "bold",
  },
  fileRow: {
    display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px",
    background: "#f9fafb", borderRadius: "10px", border: "1px solid #e5e7eb",
  },
  fileIcon: {
    background: "#dc2626", color: "white", borderRadius: "6px",
    padding: "4px 7px", fontSize: "11px", fontWeight: "bold", flexShrink: 0,
  },
  fileName: { margin: 0, fontSize: "14px", fontWeight: "bold", color: "#111827" },
  fileMeta: { margin: "2px 0 0", fontSize: "12px", color: "#6b7280" },
  fileDeleteBtn: {
    background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "6px",
    padding: "6px 10px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", flexShrink: 0,
  },
  confirmBox: {
    display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, flexWrap: "wrap",
  },
  confirmYes: {
    background: "#dc2626", color: "white", border: "none", borderRadius: "6px",
    padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: "bold",
  },
  confirmNo: {
    background: "white", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px",
    padding: "6px 12px", cursor: "pointer", fontSize: "12px",
  },
  chatSuggestions: {
    display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px",
  },
  suggestionBtn: {
    background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "20px",
    padding: "6px 14px", cursor: "pointer", fontSize: "13px", color: "#1d4ed8",
  },
  chatMessages: {
    flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
    gap: "12px", padding: "4px 0 12px",
  },
  chatUser: { display: "flex", justifyContent: "flex-end" },
  chatAi: { display: "flex", alignItems: "flex-start", gap: "8px" },
  chatAiLabel: {
    background: "#2563eb", color: "white", borderRadius: "6px",
    padding: "3px 7px", fontSize: "11px", fontWeight: "bold", flexShrink: 0, marginTop: "4px",
  },
  chatBubbleUser: {
    background: "#2563eb", color: "white", borderRadius: "16px 16px 4px 16px",
    padding: "10px 14px", fontSize: "14px", maxWidth: "70%",
  },
  chatBubbleAi: {
    background: "#f3f4f6", color: "#111827", borderRadius: "4px 16px 16px 16px",
    padding: "10px 14px", fontSize: "14px", maxWidth: "80%", lineHeight: "1.6",
  },
  chatInputRow: {
    display: "flex", gap: "10px", paddingTop: "12px", borderTop: "1px solid #e5e7eb",
  },
  chatInput: {
    flex: 1, padding: "12px", borderRadius: "10px",
    border: "1px solid #d1d5db", fontSize: "14px", outline: "none",
  },
  chatSendBtn: {
    background: "#2563eb", color: "white", border: "none", borderRadius: "10px",
    padding: "12px 20px", cursor: "pointer", fontWeight: "bold", fontSize: "14px",
  },
  settingsGrid: { display: "grid", gridTemplateColumns: "180px 1fr", gap: "12px 20px", alignItems: "center" },
  label: { color: "#6b7280", fontSize: "14px", fontWeight: "bold" },
  settingsValue: { margin: 0, fontSize: "14px" },
  pagination: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e5e7eb",
  },
  pageBtn: {
    background: "white", border: "1px solid #d1d5db", borderRadius: "8px",
    padding: "8px 14px", cursor: "pointer", fontSize: "14px", color: "#374151",
  },
  pageInfo: { fontSize: "14px", color: "#6b7280" },
  pageSizeBtn: {
    background: "white", border: "1px solid #d1d5db", borderRadius: "6px",
    padding: "4px 10px", cursor: "pointer", fontSize: "13px", color: "#374151",
  },
  pageSizeActive: {
    background: "#2563eb", border: "1px solid #2563eb", borderRadius: "6px",
    padding: "4px 10px", cursor: "pointer", fontSize: "13px", color: "white", fontWeight: "bold",
  },
};

export default App;
