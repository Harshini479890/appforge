// VenturimeterCalibrationDynamic.js
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Dimensions,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
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

const screenWidth = Dimensions.get("window").width;

// --- Constants ---
const g = 9.81;
const rho = 1000;
const KGCM2_TO_PA = 98066.5;

const d1 = 0.02; // inlet pipe diameter (m)
const d2 = 0.0125; // throat diameter (m)
const A1 = (Math.PI * d1 * d1) / 4;
const A2 = (Math.PI * d2 * d2) / 4;

const L = 0.6;
const B = 0.4;
const A_tank = L * B;

// --- Helpers ---
const formatScientific = (num) => {
  if (!isFinite(num) || num == null) return "-";
  if (num === 0) return "0";
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  const exponent = Math.floor(Math.log10(abs));
  const mantissa = abs / Math.pow(10, exponent);
  return '${sign}${mantissa.toFixed(5)} x 10^${exponent}';
};

const computeBestFit = (pairs) => {
  if (!pairs || pairs.length === 0) return null;
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  const n = pairs.length;
  for (const p of pairs) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (!isFinite(denom) || Math.abs(denom) < 1e-12) return null;
  const m = (n * sxy - sx * sy) / denom;
  const c = (sy - m * sx) / n;
  return { m, c };
};

// --- Venturi computation per row ---
const computeVenturiRow = (P1, P2, time_s) => {
  const dP_kgcm2 = P1 - P2;
  const dP_Pa = dP_kgcm2 * KGCM2_TO_PA;
  const H_m = dP_Pa / (rho * g);
  const ratioSq = (A2 / A1) ** 2;
  if (ratioSq >= 1) return null;

  const Q_theo = A2 * Math.sqrt((2 * g * H_m) / (1 - ratioSq));
  const Q_act = (A_tank * 0.05) / time_s;
  const Cd = Q_theo > 0 ? Q_act / Q_theo : null;

  return { dP_kgcm2, dP_Pa, H_m, Q_theo, Q_act, Cd };
};

export default function VenturimeterCalibrationDynamic() {
  const idRef = useRef(Date.now());
  const makeRow = (id) => ({ id: String(id), P1: "", P2: "", time: "" });

  const [rows, setRows] = useState([makeRow(idRef.current++)]);
  const [results, setResults] = useState([]);
  const [avgCd, setAvgCd] = useState(null);
  const [user, setUser] = useState(null);
  const [recentRun, setRecentRun] = useState(null);

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
        collection(db, "users", uid, "venturimeterCalibration"),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setRecentRun(null);
        return;
      }
      const doc = snap.docs[0].data();

      // Normalize data
      const normalized = {
        data: doc.data ?? [],
        avgCd: doc.averageCd ?? null,
        inputRows: doc.inputRows ?? [],
      };

      setRecentRun(normalized);

      // Populate input fields with previous run
      if (normalized.inputRows && normalized.inputRows.length > 0) {
        const prevRows = normalized.inputRows.map((r, idx) => ({
          id: String(idx + 1),
          P1: r.P1 ?? "",
          P2: r.P2 ?? "",
          time: r.time ?? "",
        }));
        setRows(prevRows);
        idRef.current = prevRows.length + 1;
      }
    } catch (err) {
      console.error("fetchMostRecentRun err", err);
      setRecentRun(null);
    }
  };

  const addRow = () => setRows((s) => [...s, makeRow(idRef.current++)]);
  const removeRow = (id) => setRows((s) => s.filter((r) => r.id !== id));
  const updateRow = (id, field, value) =>
    setRows((s) => s.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const handleCalculate = async () => {
    const computed = [];
    for (const r of rows) {
      const P1 = Number(r.P1);
      const P2 = Number(r.P2);
      const time = Number(r.time);
      if (isNaN(P1) || isNaN(P2) || isNaN(time) || time <= 0) continue;

      const rowRes = computeVenturiRow(P1, P2, time);
      if (!rowRes) continue;

      computed.push({
        P1,
        P2,
        time,
        dP_kgcm2: rowRes.dP_kgcm2,
        dP_Pa: rowRes.dP_Pa,
        H_m: rowRes.H_m,
        Q_theo: rowRes.Q_theo,
        Q_act: rowRes.Q_act,
        Cd: rowRes.Cd,
      });
    }

    if (computed.length === 0) {
      Alert.alert("Error", "Fill at least one valid row.");
      return;
    }

    const avg = computed.reduce((s, x) => s + (x.Cd || 0), 0) / computed.length;
    setResults(computed);
    setAvgCd(avg);

    if (user) {
      try {
        await addDoc(
          collection(db, "users", user.uid, "venturimeterCalibration"),
          {
            createdAt: new Date(),
            inputRows: rows,
            data: computed,
            averageCd: avg,
          }
        );
        fetchMostRecentRun(user.uid);
        Alert.alert("Saved", "Run saved to Firestore.");
      } catch (err) {
        Alert.alert("Save error", String(err.message || err));
      }
    }
  };

  // Current run chart
  const chartData = useMemo(() => {
    const pairs = results.filter(
      (r) => r && Number.isFinite(r.Q_act) && Number.isFinite(r.Q_theo)
    );
    if (!pairs.length) return null;

    return {
      labels: pairs.map((r) => formatScientific(r.Q_theo)), // x-axis = Q_theo
      datasets: [{ data: pairs.map((r) => r.Q_act) }], // y-axis = Q_act
    };
  }, [results]);

  // Recent run chart
  const recentChartData = useMemo(() => {
    if (!recentRun || !Array.isArray(recentRun.data)) return null;
    const pairs = recentRun.data.filter(
      (r) => r && Number.isFinite(r.Q_act) && Number.isFinite(r.Q_theo)
    );
    if (!pairs.length) return null;

    return {
      labels: pairs.map((r) => formatScientific(r.Q_theo)), // x-axis = Q_theo
      datasets: [{ data: pairs.map((r) => r.Q_act) }], // y-axis = Q_act
    };
  }, [recentRun]);

  const fitRecent = computeBestFit(
    (recentRun?.data || [])
      .filter((r) => Number.isFinite(r.Q_act) && Number.isFinite(r.Q_theo))
      .map((r) => ({ x: r.Q_theo, y: r.Q_act }))
  );
  const fitCurrent = computeBestFit(
    results
      .filter((r) => Number.isFinite(r.Q_act) && Number.isFinite(r.Q_theo))
      .map((r) => ({ x: r.Q_theo, y: r.Q_act }))
  );

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 150 }}
      style={styles.container}
      horizontal={false}
    >
      <Text style={styles.paragraph}>
        <Text style={styles.heading}>Aim: </Text>
        To determine the co-efficient of discharge of the venturimeter.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.heading}>Procedure:{"\n"}</Text>
        1. The diameter of the pipe and throat are recorded and the internal
        plan dimensions of the collecting tank are measured.{"\n"}
        2. Start the pump and adjust the control valve in the pipeline for
        maximum discharge.{"\n"}
        3. Measure the pressure difference across the meter.{"\n"}
        4. By closing the outlet valve of the collecting tank, the time taken
        for 5 cm rise of water in the piezometer is noted. After taking a set of
        readings, the collecting tank outlet valve is fully opened to drain the
        water.{"\n"}
        5. Decrease the flow rate through the system by regulating the control
        valve.{"\n"}
        6. Repeat steps 3 to 5 for at least 5 different settings of the control
        valve.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.heading}>Formula:{"\n"}</Text>
        Actual Volumetric flowrate Qact = (A*H)/t{"\n"}
        where t: time to fill the selected volume (sec), A: cross-section area
        of storage tank, H: height of water in tank (m){"\n\n"}
        Pressure drop P = P1 - P2{"\n"}
        Pressure drop in terms of head of water column H = P / (ρ * g){"\n\n"}
        Theoretical flow rate Qtheo = A_throat * sqrt(2 * g * H / (1 - (A_throat
        / A_pipe)^2)){"\n"}
        Discharge coefficient Cd = Qact / Qtheo
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.heading}>Observation:{"\n"}</Text>
        Diameter of inlet pipe (d1) = 0.02 m{"\n"}
        Diameter of throat section (d2) = 0.0125 m{"\n"}
        Inner length of collecting tank (L) = 0.6 m{"\n"}
        Inner breadth of collecting tank (B) = 0.4 m{"\n"}
        Density of water (ρ) = 1000 kg/m³{"\n"}
        Acceleration due to gravity (g) = 9.81 m/s²
      </Text>

      {rows.map((r) => (
        <View key={r.id} style={styles.row}>
          <TextInput
            style={styles.input}
            placeholder="P1 (kg/cm²)"
            keyboardType="numeric"
            value={r.P1}
            onChangeText={(v) => updateRow(r.id, "P1", v)}
          />
          <TextInput
            style={styles.input}
            placeholder="P2 (kg/cm²)"
            keyboardType="numeric"
            value={r.P2}
            onChangeText={(v) => updateRow(r.id, "P2", v)}
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

      {/* Current run results */}
      {results.length > 0 && (
        <ScrollView horizontal style={{ marginTop: 10 }}>
          <View>
            <View style={styles.tableHeader}>
              {[
                "P1",
                "P2",
                "t(s)",
                "ΔP(Pa)",
                "H(m)",
                "Q_act",
                "Q_theo",
                "Cd",
              ].map((h, i) => (
                <Text key={i} style={styles.cell}>
                  {h}
                </Text>
              ))}
            </View>
            {results.map((r, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.cell}>{r.P1}</Text>
                <Text style={styles.cell}>{r.P2}</Text>
                <Text style={styles.cell}>{r.time}</Text>
                <Text style={styles.cell}>{Math.round(r.dP_Pa)}</Text>
                <Text style={styles.cell}>{r.H_m.toFixed(3)}</Text>
                <Text style={styles.cell}>{formatScientific(r.Q_act)}</Text>
                <Text style={styles.cell}>{formatScientific(r.Q_theo)}</Text>
                <Text style={styles.cell}>{r.Cd.toFixed(5)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {fitCurrent && (
        <Text style={{ fontSize: 12, marginTop: 4 }}>
          Best-fit slope: {fitCurrent.m.toFixed(6)}, intercept:{" "}
          {fitCurrent.c.toExponential(3)}
        </Text>
      )}
      <Text style={styles.avgText}>
        Average Cd: {avgCd != null ? avgCd.toFixed(5) : "-"}
      </Text>

      {/* Most recent saved run */}
      <View style={{ marginTop: 20 }}>
        <Text style={[styles.title, { fontSize: 18 }]}>
          Most Recent Saved Run
        </Text>
        {recentRun && recentRun.data.length > 0 ? (
          <>
            <ScrollView horizontal>
              <View>
                <View style={styles.tableHeader}>
                  {[
                    "P1",
                    "P2",
                    "t(s)",
                    "ΔP(Pa)",
                    "H(m)",
                    "Q_act",
                    "Q_theo",
                    "Cd",
                  ].map((h, i) => (
                    <Text key={i} style={styles.cell}>
                      {h}
                    </Text>
                  ))}
                </View>
                {recentRun.data.map((r, i) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={styles.cell}>{r.P1}</Text>
                    <Text style={styles.cell}>{r.P2}</Text>
                    <Text style={styles.cell}>{r.time}</Text>
                    <Text style={styles.cell}>{Math.round(r.dP_Pa)}</Text>
                    <Text style={styles.cell}>{r.H_m.toFixed(3)}</Text>
                    <Text style={styles.cell}>{formatScientific(r.Q_act)}</Text>
                    <Text style={styles.cell}>
                      {formatScientific(r.Q_theo)}
                    </Text>
                    <Text style={styles.cell}>{r.Cd.toFixed(5)}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            {fitRecent && (
              <Text style={{ fontSize: 14, marginTop: 13, fontWeight: "700" }}>
                Best-fit slope: {fitRecent.m.toFixed(6)}
              </Text>
            )}
            <Text style={styles.avgText}>
              Average Cd:{" "}
              {recentRun.avgCd != null ? recentRun.avgCd.toFixed(5) : "-"}
            </Text>
          </>
        ) : (
          <Text style={{ color: "#666", marginTop: 6 }}>
            No recent saved run available.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: "#fff" },

  title: {
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 10,
    color: "#000",
    fontWeight: "400", // normal weight
    textAlign: "left", // left-align the paragraph
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
  },
  input: {
    borderWidth: 1,
    borderColor: "#aaa",
    borderRadius: 6,
    padding: 8,
    minWidth: 80,
    marginRight: 6,
    flex: 1,
  },
  delBtn: {
    backgroundColor: "#e53935",
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  addBtn: {
    backgroundColor: "#2196F3",
    padding: 10,
    borderRadius: 8,
    marginVertical: 6,
    alignItems: "center",
  },
  addText: { color: "#fff", fontWeight: "700" },
  calcBtn: {
    backgroundColor: "#4CAF50",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  calcText: { color: "#fff", fontWeight: "600" },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, paddingBottom: 6 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    paddingVertical: 6,
  },
  cell: { minWidth: 80, textAlign: "center", fontSize: 12 },
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