import React, { useState } from "react";
import type { RoadEdge, RoadNode, Ambulance, Hospital } from "../types.js";
import { blockRoad, setRoadTraffic, updateAmbulanceStatus, updateHospital, resetSimulation } from "../api.js";

interface SimulationPanelProps {
    edges: RoadEdge[];
    nodes: RoadNode[];
    ambulances: Ambulance[];
    hospitals: Hospital[];
    onDataUpdated: () => void;
    onClose?: () => void;
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
    edges,
    nodes,
    ambulances,
    hospitals,
    onDataUpdated,
    onClose,
}) => {
    const [selectedEdgeId, setSelectedEdgeId] = useState<string>(edges[0]?.id || "");
    const [trafficValue, setTrafficValue] = useState<number>(1.0);
    const [loading, setLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);

    const nodeMap = new Map<string, RoadNode>();
    for (const n of nodes) {
        nodeMap.set(n.id, n);
    }

    const currentEdge = edges.find((e) => e.id === selectedEdgeId) || edges[0];

    // Toggle Block / Unblock on selected road
    const handleToggleBlock = async () => {
        if (!currentEdge) return;
        setLoading(true);
        setStatusMsg(null);
        try {
            const newBlockedState = !currentEdge.isBlocked;
            await blockRoad(currentEdge.id, newBlockedState);
            setStatusMsg(`Road ${newBlockedState ? "BLOCKED" : "UNBLOCKED"}. Dynamic detour calculated.`);
            onDataUpdated();
        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Apply traffic factor slider
    const handleApplyTraffic = async () => {
        if (!currentEdge) return;
        setLoading(true);
        setStatusMsg(null);
        try {
            await setRoadTraffic(currentEdge.id, trafficValue);
            setStatusMsg(`Traffic set to ${trafficValue}x. Reroute evaluated.`);
            onDataUpdated();
        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Toggle Ambulance Status
    const handleAmbulanceStatus = async (ambId: string, currentStatus: string) => {
        setLoading(true);
        try {
            const nextStatus = currentStatus === "AVAILABLE" ? "OFFLINE" : "AVAILABLE";
            await updateAmbulanceStatus(ambId, nextStatus);
            onDataUpdated();
        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Toggle Hospital Open / Change Beds
    const handleHospitalToggle = async (hosp: Hospital) => {
        setLoading(true);
        try {
            await updateHospital(hosp.id, { emergencyOpen: !hosp.emergencyOpen });
            onDataUpdated();
        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleHospitalBeds = async (hosp: Hospital, delta: number) => {
        setLoading(true);
        try {
            const newBeds = Math.max(0, hosp.availableBeds + delta);
            await updateHospital(hosp.id, { availableBeds: newBeds });
            onDataUpdated();
        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Reset Entire Demo
    const handleResetDemo = async () => {
        if (!window.confirm("Reset all roads, ambulances, hospitals and emergencies to original seed data?")) return;
        setLoading(true);
        try {
            await resetSimulation();
            setStatusMsg("Demo environment successfully reset to fresh Solapur seed state!");
            onDataUpdated();
        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                background: "#1e293b",
                color: "#f8fafc",
                height: "100%",
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                fontSize: "13px",
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: "18px", color: "#f59e0b", display: "flex", alignItems: "center", gap: "8px" }}>
                        ⚙️ Simulation & Live Chaos Controls
                    </h3>
                    <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "2px" }}>
                        Inject road blockages, traffic delays, and bed shortages to demo real-time reroutes to judges
                    </div>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#94a3b8",
                            fontSize: "20px",
                            cursor: "pointer",
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>

            {statusMsg && (
                <div
                    style={{
                        background: "#064e3b",
                        border: "1px solid #059669",
                        color: "#a7f3d0",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                    }}
                >
                    {statusMsg}
                </div>
            )}

            {/* 1. Road Blockage & Traffic Control */}
            <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "10px", padding: "14px" }}>
                <h4 style={{ margin: "0 0 10px 0", color: "#38bdf8", fontSize: "14px" }}>
                    🛣️ 1. Dynamic Road Interventions
                </h4>

                <label style={{ display: "block", marginBottom: "6px", color: "#94a3b8", fontSize: "12px" }}>
                    Select Road Segment:
                </label>
                <select
                    value={selectedEdgeId}
                    onChange={(e) => {
                        setSelectedEdgeId(e.target.value);
                        const ed = edges.find((x) => x.id === e.target.value);
                        if (ed) setTrafficValue(ed.trafficFactor);
                    }}
                    style={{
                        width: "100%",
                        padding: "8px 10px",
                        background: "#1e293b",
                        color: "#fff",
                        border: "1px solid #475569",
                        borderRadius: "6px",
                        marginBottom: "12px",
                        fontSize: "12px",
                    }}
                >
                    {edges.map((e) => {
                        const u = nodeMap.get(e.fromNodeId)?.name || e.fromNodeId;
                        const v = nodeMap.get(e.toNodeId)?.name || e.toNodeId;
                        return (
                            <option key={e.id} value={e.id}>
                                {u} ↔ {v} ({e.isBlocked ? "⛔ BLOCKED" : `${e.trafficFactor}x traffic`})
                            </option>
                        );
                    })}
                </select>

                {currentEdge && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <button
                                onClick={handleToggleBlock}
                                disabled={loading}
                                style={{
                                    flex: 1,
                                    padding: "9px 12px",
                                    borderRadius: "6px",
                                    border: "none",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    background: currentEdge.isBlocked ? "#16a34a" : "#dc2626",
                                    color: "#fff",
                                    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                                }}
                            >
                                {currentEdge.isBlocked ? "✅ Clear / Unblock Road" : "⛔ Block This Road"}
                            </button>
                        </div>

                        {/* Traffic Slider */}
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "11px", color: "#94a3b8" }}>
                                <span>Traffic Congestion Factor:</span>
                                <span style={{ color: "#f59e0b", fontWeight: 700 }}>{trafficValue}x Speed Delay</span>
                            </div>
                            <input
                                type="range"
                                min="1.0"
                                max="5.0"
                                step="0.5"
                                value={trafficValue}
                                onChange={(e) => setTrafficValue(parseFloat(e.target.value))}
                                style={{ width: "100%", accentColor: "#f59e0b" }}
                            />
                            <button
                                onClick={handleApplyTraffic}
                                disabled={loading}
                                style={{
                                    marginTop: "6px",
                                    width: "100%",
                                    padding: "6px 10px",
                                    background: "#d97706",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Apply Congestion Factor
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Hospital Capacity & ER Status */}
            <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "10px", padding: "14px" }}>
                <h4 style={{ margin: "0 0 10px 0", color: "#34d399", fontSize: "14px" }}>
                    🏥 2. Hospital Beds & Emergency Admission
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                    {hospitals.map((h) => (
                        <div
                            key={h.id}
                            style={{
                                background: "#1e293b",
                                border: "1px solid #334155",
                                borderRadius: "6px",
                                padding: "8px 10px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <div style={{ maxWidth: "60%" }}>
                                <div style={{ fontWeight: 600, color: "#f8fafc", fontSize: "12px" }}>{h.name}</div>
                                <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                    Beds: <span style={{ color: h.availableBeds > 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>{h.availableBeds}</span> | ER:{" "}
                                    <span style={{ color: h.emergencyOpen ? "#4ade80" : "#f87171" }}>
                                        {h.emergencyOpen ? "OPEN" : "CLOSED"}
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "4px" }}>
                                <button
                                    onClick={() => handleHospitalBeds(h, -1)}
                                    style={{ background: "#334155", color: "#fff", border: "none", borderRadius: "4px", padding: "2px 8px", cursor: "pointer" }}
                                >
                                    -1
                                </button>
                                <button
                                    onClick={() => handleHospitalBeds(h, 1)}
                                    style={{ background: "#334155", color: "#fff", border: "none", borderRadius: "4px", padding: "2px 8px", cursor: "pointer" }}
                                >
                                    +1
                                </button>
                                <button
                                    onClick={() => handleHospitalToggle(h)}
                                    style={{
                                        background: h.emergencyOpen ? "#dc2626" : "#16a34a",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "4px",
                                        padding: "2px 8px",
                                        fontSize: "10px",
                                        cursor: "pointer",
                                    }}
                                >
                                    {h.emergencyOpen ? "Close ER" : "Open ER"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 3. Ambulance Fleet Control */}
            <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "10px", padding: "14px" }}>
                <h4 style={{ margin: "0 0 10px 0", color: "#c084fc", fontSize: "14px" }}>
                    🚑 3. Ambulance Fleet Readiness
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", maxHeight: "160px", overflowY: "auto" }}>
                    {ambulances.map((amb) => (
                        <div
                            key={amb.id}
                            style={{
                                background: "#1e293b",
                                border: "1px solid #334155",
                                borderRadius: "6px",
                                padding: "6px 8px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 600, fontSize: "11px" }}>{amb.code}</div>
                                <div style={{ fontSize: "10px", color: amb.status === "AVAILABLE" ? "#4ade80" : "#f59e0b" }}>
                                    {amb.type} • {amb.status}
                                </div>
                            </div>
                            <button
                                onClick={() => handleAmbulanceStatus(amb.id, amb.status)}
                                style={{
                                    background: amb.status === "AVAILABLE" ? "#475569" : "#16a34a",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "4px",
                                    padding: "3px 6px",
                                    fontSize: "10px",
                                    cursor: "pointer",
                                }}
                            >
                                {amb.status === "AVAILABLE" ? "Offline" : "Free"}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reset Button */}
            <div style={{ marginTop: "auto", paddingTop: "10px" }}>
                <button
                    onClick={handleResetDemo}
                    disabled={loading}
                    style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "#4f46e5",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                    }}
                >
                    🔄 Reset Complete Demo State
                </button>
            </div>
        </div>
    );
};

