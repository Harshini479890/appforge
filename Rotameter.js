// FlowCalibrationNoChart.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const V_M3 = 5e-3;
const LPH_TO_M3S = 1000 * 3600;

const emptyRow = (id) => ({ id: String(id), qrot: "", time: "" });

const formatScientific = (num) => {
  if (num === null || num === undefined || !isFinite(num)) return "-";
  if (Number(num) === 0) return "0";
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(Number(num));
  const exponent = Math.floor(Math.log10(abs));
  const mantissa = abs / Math.pow(10, exponent);
  return '${sign}${mantissa.toFixed(5)} x 10^${exponent}';
};

// Compute average slope from all pairs
// Compute average slope from all pairs, with units aligned
const computeBestSlope = (data) => {
  const points = data
    .map((r) => {
      const x = r.qrot_m3s; // convert qrot to m3/s
      const y = r.qact;
      return { x, y };
    })
    .filter((p) => isFinite(p.x) && isFinite(p.y));

  if (points.length < 2) return 0;

  const slopes = [];
  for (let i = 0; i < points.length - 1; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      if (dx !== 0) slopes.push(dy / dx);
    }
  }

  return slopes.reduce((a, b) => a + b, 0) / slopes.length;
};

export default function FlowCalibrationNoChart() {
  const [rows, setRows] = useState([emptyRow(1)]);
  const [results, setResults] = useState([]);
  const [avgCf, setAvgCf] = useState(null);
  const [bestSlope, setBestSlope] = useState(0);
  const [recentRun, setRecentRun] = useState(null);
  const [recentBestSlope, setRecentBestSlope] = useState(0);
  const [user, setUser] = useState(null);

  const auth = getAuth();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) fetchMostRecentRun(u.uid);
      else setRecentRun(null);
    });
    return () => unsub();
  }, []);

  const fetchMostRecentRun = async (uid) => {
    try {
      const q = query(
        collection(db, "users", uid, "flowCalibration"),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setRecentRun(null);
        return;
      }
      const doc = snap.docs[0].data();
      let normalized = { raw: doc };
      normalized.data = Array.isArray(doc.data)
        ? doc.data
        : Array.isArray(doc.computed)
        ? doc.computed
        : doc.data ?? doc.computed ?? doc.inputRows ?? [];
      normalized.avgCorrectionFactor =
        doc.avgCorrectionFactor ?? doc.avgCf ?? null;

      normalized.data = normalized.data.map((r) => {
        const qrot = r.qrot != null ? Number(r.qrot) : null;
        const time = r.time != null ? Number(r.time) : null;
        let qrot_m3s = r.qrot_m3s != null ? Number(r.qrot_m3s) : null;
        let qact = r.qact != null ? Number(r.qact) : null;
        let cf = r.cf != null ? Number(r.cf) : null;

        if ((qrot_m3s === null || !isFinite(qrot_m3s)) && qrot != null) {
          qrot_m3s = qrot / LPH_TO_M3S;
        }
        if ((qact === null || !isFinite(qact)) && time != null && time > 0) {
          qact = V_M3 / time;
        }
        if ((cf === null || !isFinite(cf)) && qrot_m3s > 0 && qact != null) {
          cf = qact / qrot_m3s;
        }

        return { qrot, time, qrot_m3s, qact, cf };
      });

      setRecentRun(normalized);
      setRecentBestSlope(computeBestSlope(normalized.data));
    } catch (e) {
      console.error("fetchMostRecentRun err", e);
      setRecentRun(null);
    }
  };

  const addRow = () => setRows((s) => [...s, emptyRow(s.length + 1)]);
  const removeRow = (id) => setRows((s) => s.filter((r) => r.id !== id));
  const updateRow = (id, field, value) =>
    setRows((s) => s.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const handleCalculate = async () => {
    const computed = [];
    for (const r of rows) {
      const qrotNum = Number(r.qrot);
      const timeNum = Number(r.time);
      if (isNaN(qrotNum) || isNaN(timeNum) || timeNum <= 0) continue;
      const qrot_m3s = qrotNum / LPH_TO_M3S;
      const qact = V_M3 / timeNum;
      const cf = qrot_m3s > 0 ? qact / qrot_m3s : null;
      computed.push({ qrot: qrotNum, time: timeNum, qrot_m3s, qact, cf });
    }

    if (computed.length === 0) {
      Alert.alert(
        "Error",
        "Fill at least one valid row (numeric q_rot and time)."
      );
      return;
    }

    const avg = computed.reduce((s, x) => s + (x.cf || 0), 0) / computed.length;
    setResults(computed);
    setAvgCf(avg);
    setBestSlope(computeBestSlope(computed));

    if (user) {
      try {
        await addDoc(collection(db, "users", user.uid, "flowCalibration"), {
          createdAt: new Date(),
          data: computed,
          computed: computed,
          inputRows: rows,
          avgCorrectionFactor: avg,
          avgCf: avg,
        });
        fetchMostRecentRun(user.uid);
      } catch (err) {
        console.error("save err", err);
        Alert.alert("Save error", String(err.message || err));
      }
    } else {
      Alert.alert("Note", "Not signed in — result not saved remotely.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <Text style={styles.paragraph}>
          <Text style={styles.heading}>Aim: </Text>
          To calibrate the given rotameter
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.heading}>Procedures: </Text>
          {"\n"}1. Select a rate of fluid flow through the rotameter.
          {"\n"}2. Opening the inlet valve till the float reaches the selected
          flow rate.
          {"\n"}3. Estimating the time required to fill a fixed volume of output
          water.
          {"\n"}4. The rotameter reading indicates the rotameter flow rate
          (Qrot.) in (L/min); while the volume selected divided by the time
          measured indicates the actual flow rate (Qact.) in (L/sec).
          {"\n"}5. Repeating the procedures from 1 to 3 for other selecting flow
          rate.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.heading}>Formula: </Text>
          {"\n"}Actual volumetric flow rate Qact = (A*H)/t
          {"\n"}where t: is the time it takes to fill the selected volume, sec.
          {"\n"}A: is the cross-section area of the storage tank.
          {"\n"}H: is the height of water in the storage tank, m.
          {"\n"}
          {"\n"}Correction factor Cf = Qact / Qrot
          {"\n"}where Qrot: Volumetric flowrate of Rotameter
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.heading}>Observations: </Text>
          {"\n"}1. Height of water in the storage tank (H) = 0.05 m
        </Text>
        {/* Input rows */}
        {rows.map((r) => (
          <View key={r.id} style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Rotameter Flow (L/h)"
              keyboardType="numeric"
              value={r.qrot}
              onChangeText={(v) => updateRow(r.id, "qrot", v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Time (s)"
              keyboardType="numeric"
              value={r.time}
              onChangeText={(v) => updateRow(r.id, "time", v)}
            />
            <TouchableOpacity
              style={styles.delBtn}
              onPress={() => removeRow(r.id)}
            >
              <Text style={{ color: "#fff" }}>Del</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity onPress={addRow} style={styles.addBtn}>
          <Text style={styles.addText}>+ Add Row</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleCalculate} style={styles.calcBtn}>
          <Text style={styles.calcText}>Calculate & Save</Text>
        </TouchableOpacity>

        {/* Current run */}
        {results && results.length > 0 && (
          <View style={styles.results}>
            <Text style={styles.subtitle}>Results (Current Run)</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.cell}>qrot(L/h)</Text>
              <Text style={styles.cell}>t(s)</Text>
              <Text style={styles.cell}>Q_act</Text>
              <Text style={styles.cell}>qrot(m3/s)</Text>
              <Text style={styles.cell}>C_f</Text>
            </View>
            {results.map((r, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.cell}>
                  {r.qrot != null ? String(r.qrot) : "-"}
                </Text>
                <Text style={styles.cell}>
                  {r.time != null ? String(r.time) : "-"}
                </Text>
                <Text style={styles.cell}>
                  {r.qact != null ? formatScientific(r.qact) : "-"}
                </Text>
                <Text style={styles.cell}>
                  {r.qrot_m3s != null ? formatScientific(r.qrot_m3s) : "-"}
                </Text>
                <Text style={styles.cell}>
                  {r.cf != null ? Number(r.cf).toFixed(5) : "-"}
                </Text>
              </View>
            ))}
            <Text style={styles.avgText}>
              Average Correction Factor:{" "}
              {avgCf != null ? Number(avgCf).toFixed(5) : "-"}
            </Text>
            <Text style={styles.avgText}>
              Best-fit slope (m): {bestSlope.toFixed(6)}
            </Text>
          </View>
        )}

        {/* Recent run */}
        <View style={styles.results}>
          <Text style={styles.subtitle}>Most Recent Saved Run</Text>
          {recentRun &&
          Array.isArray(recentRun.data) &&
          recentRun.data.length > 0 ? (
            <>
              <View style={styles.tableHeader}>
                <Text style={styles.cell}>qrot(L/h)</Text>
                <Text style={styles.cell}>t(s)</Text>
                <Text style={styles.cell}>Q_act</Text>
                <Text style={styles.cell}>qrot(m3/s)</Text>
                <Text style={styles.cell}>C_f</Text>
              </View>
              {recentRun.data.map((r, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.cell}>
                    {r.qrot != null ? String(r.qrot) : "-"}
                  </Text>
                  <Text style={styles.cell}>
                    {r.time != null ? String(r.time) : "-"}
                  </Text>
                  <Text style={styles.cell}>
                    {r.qact != null ? formatScientific(r.qact) : "-"}
                  </Text>
                  <Text style={styles.cell}>
                    {r.qrot_m3s != null ? formatScientific(r.qrot_m3s) : "-"}
                  </Text>
                  <Text style={styles.cell}>
                    {r.cf != null ? Number(r.cf).toFixed(5) : "-"}
                  </Text>
                </View>
              ))}
              <Text style={styles.avgText}>
                Average Correction Factor:{" "}
                {recentRun.avgCorrectionFactor != null
                  ? Number(recentRun.avgCorrectionFactor).toFixed(5)
                  : "-"}
              </Text>
              <Text style={styles.avgText}>
                Best-fit slope (m): {recentBestSlope.toFixed(6)}
              </Text>
            </>
          ) : (
            <Text style={{ color: "#666" }}>
              No recent saved run available.
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#aaa",
    borderRadius: 6,
    padding: 10,
    flex: 1,
    marginRight: 6,
  },
  delBtn: { backgroundColor: "#e53935", padding: 8, borderRadius: 6 },
  addBtn: {
    backgroundColor: "#2196F3",
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
  },
  addText: { color: "#fff", textAlign: "center" },
  calcBtn: {
    backgroundColor: "#4CAF50",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  calcText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  results: { marginTop: 10, marginBottom: 20 },
  subtitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, paddingBottom: 6 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    paddingVertical: 6,
  },
  cell: { flex: 1, textAlign: "center", fontSize: 12 },
  avgText: { marginTop: 8, fontWeight: "700" },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
    color: "#000",
    textAlign: "left",
  },
  heading: {
    fontWeight: "700", // bold for section titles
  },
});