import React, { useState } from "react";
import type { Emergency, RoadNode, RoadEdge, AmbulanceStation, Hospital, Ambulance, RouteLeg, AmbulanceCandidate, HospitalCandidate } from "../types.js";
import { createEmergency, confirmPickup, completeEmergency, cancelEmergency } from "../api.js";
import { MapView } from "./MapView.js";

interface DispatchConsoleProps {
    nodes: RoadNode[];
    edges: RoadEdge[];
    stations: AmbulanceStation[];
    hospitals: Hospital[];
    ambulances: Ambulance[];
    activeEmergency: Emergency | null;
    activeLegs: RouteLeg[];
    hospitalRecommendations?: {
        winner: HospitalCandidate;
        rankedList: HospitalCandidate[];
    } | null;
    onEmergencyCreated: (emergency: Emergency) => void;
    onRefresh: () => void;
    onSelectRoad?: (edge: RoadEdge) => void;
}

// Solapur Preset Test Scenarios for Hackathon Live Demo
const DEMO_SCENARIOS = [
    {
        name: "🫀 Critical Cardiac Emergency (Saat Rasta)",
        caller: "Suresh Kulkarni",
        phone: "+91 94220 54321",
        description: "65yo male experiencing severe crushing chest pain, radiating to left arm, sweating heavily and short of breath",
        lat: 17.6680,
        lng: 75.9030,
        locationName: "Saat Rasta Junction (node_04)",
    },
    {
        name: "💥 Severe Highway Trauma (Old Pune Naka)",
        caller: "Rajesh Patil",
        phone: "+91 98231 67890",
        description: "Head-on collision between car and truck on NH-65. Driver trapped with open fracture and arterial bleeding",
        lat: 17.6830,
        lng: 75.8920,
        locationName: "Old Pune Naka (node_02)",
    },
    {
        name: "🧠 Stroke / Neurological Distress (Ashok Chowk)",
        caller: "Anjali Deshmukh",
        phone: "+91 97654 32109",
        description: "Patient suddenly collapsed at market, facial drooping on right side, slurred incoherent speech, unresponsive",
        lat: 17.6610,
        lng: 75.9180,
        locationName: "Ashok Chowk (node_07)",
    },
    {
        name: "🤰 Active Maternity Labor (Jule Solapur)",
        caller: "Pooja Jadhav",
        phone: "+91 98901 23456",
        description: "Pregnant woman at 38 weeks experiencing rapid 2-minute labor contractions and rupture of membranes",
        lat: 17.6350,
        lng: 75.8950,
        locationName: "D-Mart Jule Solapur (node_14)",
    },
];

export const DispatchConsole: React.FC<DispatchConsoleProps> = ({
    nodes,
    edges,
    stations,
    hospitals,
    ambulances,
    activeEmergency,
    activeLegs,
    hospitalRecommendations,
    onEmergencyCreated,
    onRefresh,
    onSelectRoad,
}) => {
    // Form state
    const [callerName, setCallerName] = useState("Vijay Sharma");
    const [phone, setPhone] = useState("+91 98224 56789");
    const [description, setDescription] = useState("Elderly patient complaining of severe acute chest pain and dizziness");
    const [lat, setLat] = useState<number>(17.6680);
    const [lng, setLng] = useState<number>(75.9030);
    const [locationLabel, setLocationLabel] = useState<string>("Saat Rasta (node_04)");
    const [loading, setLoading] = useState(false);
    const [lastDispatchInfo, setLastDispatchInfo] = useState<{
        triage: any;
        winnerAmbulance: AmbulanceCandidate;
        rankedAmbulances: AmbulanceCandidate[];
    } | null>(null);

    // Dynamic Reroute Alert Banner State
    const [rerouteNotice, setRerouteNotice] = useState<string | null>(null);

    // Watch for new reroute events in timeline
    React.useEffect(() => {
        if (!activeEmergency?.journeyEvents) return;
        const rerouteEvent = activeEmergency.journeyEvents
            .slice()
            .reverse()
            .find((ev) => ev.type === "REROUTE");
        if (rerouteEvent) {
            setRerouteNotice(rerouteEvent.message);
        }
    }, [activeEmergency?.journeyEvents]);

    // Handle map click to snap/set incident coordinates
    const handleMapClick = (clickLat: number, clickLng: number) => {
        setLat(clickLat);
        setLng(clickLng);
        setLocationLabel(`Custom Pin: ${clickLat}, ${clickLng}`);
    };

    // Apply demo preset
    const handleApplyScenario = (sc: (typeof DEMO_SCENARIOS)[0]) => {
        setCallerName(sc.caller);
        setPhone(sc.phone);
        setDescription(sc.description);
        setLat(sc.lat);
        setLng(sc.lng);
        setLocationLabel(sc.locationName);
    };

    // Submit Emergency
    const handleSubmitEmergency = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setRerouteNotice(null);
        try {
            const data = await createEmergency({
                callerName,
                phone,
                description,
                lat,
                lng,
            });
            setLastDispatchInfo({
                triage: data.triage,
                winnerAmbulance: data.winnerAmbulance,
                rankedAmbulances: data.rankedAmbulances,
            });
            onEmergencyCreated(data.emergency);
        } catch (err: any) {
            const msg =
                err.message === "Network Error"
                    ? "Backend server is not reachable on port 3000. Please start the backend server by running 'cd backend && npm run dev'."
                    : err.response?.data?.message || err.message;
            alert(`Dispatch Error: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    // Confirm Pickup
    const handleConfirmPickup = async () => {
        if (!activeEmergency) return;
        setLoading(true);
        try {
            await confirmPickup(activeEmergency.id);
            onRefresh();
        } catch (err: any) {
            alert(`Pickup Error: ${err.response?.data?.message || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Complete Mission
    const handleCompleteEmergency = async () => {
        if (!activeEmergency) return;
        setLoading(true);
        try {
            await completeEmergency(activeEmergency.id);
            onRefresh();
        } catch (err: any) {
            alert(`Complete Error: ${err.response?.data?.message || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Cancel Mission
    const handleCancelEmergency = async () => {
        if (!activeEmergency) return;
        if (!window.confirm("Cancel this emergency response mission?")) return;
        setLoading(true);
        try {
            await cancelEmergency(activeEmergency.id);
            onRefresh();
        } catch (err: any) {
            alert(`Cancel Error: ${err.response?.data?.message || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const currentLeg = activeLegs[0];
    const isAtPatient =
        activeEmergency?.status === "AT_PATIENT" ||
        activeEmergency?.ambulance?.status === "AT_PATIENT";

    return (
        <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>
            {/* LEFT CONTROL PANEL (45% width, scrollable) */}
            <div
                style={{
                    width: "45%",
                    minWidth: "480px",
                    maxWidth: "650px",
                    height: "100%",
                    overflowY: "auto",
                    background: "#0f172a",
                    borderRight: "1px solid #334155",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                    color: "#f8fafc",
                }}
            >
                {/* Reroute Alert Banner */}
                {rerouteNotice && (
                    <div
                        style={{
                            background: "linear-gradient(90deg, #7f1d1d, #991b1b)",
                            border: "1px solid #ef4444",
                            borderRadius: "10px",
                            padding: "12px 16px",
                            boxShadow: "0 0 15px rgba(239, 68, 68, 0.4)",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            animation: "pulse 2s infinite",
                        }}
                    >
                        <span style={{ fontSize: "20px" }}>🚨</span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: "12px", color: "#fca5a5" }}>DYNAMIC DETOUR CALCULATED</div>
                            <div style={{ fontSize: "12px", color: "#fff" }}>{rerouteNotice}</div>
                        </div>
                    </div>
                )}

                {/* ACTIVE EMERGENCY JOURNEY TRACKER */}
                {activeEmergency && activeEmergency.status !== "COMPLETED" && activeEmergency.status !== "CANCELLED" && (
                    <div
                        style={{
                            background: "#1e293b",
                            border: "1px solid #38bdf8",
                            borderRadius: "12px",
                            padding: "16px",
                            boxShadow: "0 10px 25px -5px rgba(56, 189, 248, 0.15)",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                            <div>
                                <span
                                    style={{
                                        background: "#0284c7",
                                        color: "#fff",
                                        fontSize: "10px",
                                        fontWeight: 800,
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        letterSpacing: "0.5px",
                                    }}
                                >
                                    ACTIVE INCIDENT #{activeEmergency.id.slice(-6).toUpperCase()}
                                </span>
                                <h3 style={{ margin: "6px 0 2px 0", fontSize: "16px", color: "#f8fafc" }}>
                                    {activeEmergency.callerName} • {activeEmergency.category}
                                </h3>
                                <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                    Severity Level: <strong style={{ color: "#ef4444" }}>{activeEmergency.severity}/5</strong> • Triage:{" "}
                                    <strong style={{ color: "#38bdf8" }}>{activeEmergency.aiSource === "LLM" ? "AI Model" : "Rule Engine"}</strong>
                                </div>
                            </div>
                            <button
                                onClick={handleCancelEmergency}
                                style={{
                                    background: "#475569",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "4px",
                                    padding: "4px 8px",
                                    fontSize: "10px",
                                    cursor: "pointer",
                                }}
                            >
                                Cancel
                            </button>
                        </div>

                        {/* Journey Stepper */}
                        <div style={{ display: "flex", justifyContent: "space-between", margin: "14px 0", position: "relative" }}>
                            {[
                                { key: "ASSIGNED", label: "Assigned" },
                                { key: "EN_ROUTE_TO_PATIENT", label: "En Route" },
                                { key: "AT_PATIENT", label: "At Scene" },
                                { key: "PICKUP_CONFIRMED", label: "Picked Up" },
                                { key: "EN_ROUTE_TO_HOSPITAL", label: "To Hospital" },
                                { key: "COMPLETED", label: "Admitted" },
                            ].map((step, idx) => {
                                const status = activeEmergency.status;
                                let isDone = false;
                                let isCurrent = false;

                                if (status === "EN_ROUTE_TO_PATIENT") {
                                    if (idx === 0) isDone = true;
                                    if (idx === 1) isCurrent = true;
                                } else if (status === "AT_PATIENT" || isAtPatient) {
                                    if (idx <= 1) isDone = true;
                                    if (idx === 2) isCurrent = true;
                                } else if (status === "PICKUP_CONFIRMED") {
                                    if (idx <= 2) isDone = true;
                                    if (idx === 3) isCurrent = true;
                                } else if (status === "EN_ROUTE_TO_HOSPITAL") {
                                    if (idx <= 3) isDone = true;
                                    if (idx === 4) isCurrent = true;
                                } else if (status === "COMPLETED") {
                                    isDone = true;
                                }

                                const circleBg = isCurrent ? "#38bdf8" : isDone ? "#10b981" : "#334155";
                                const textColor = isCurrent ? "#38bdf8" : isDone ? "#cbd5e1" : "#64748b";

                                return (
                                    <div key={step.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2 }}>
                                        <div
                                            style={{
                                                width: "20px",
                                                height: "20px",
                                                borderRadius: "50%",
                                                background: circleBg,
                                                color: "#fff",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "10px",
                                                fontWeight: 700,
                                                boxShadow: isCurrent ? "0 0 10px #38bdf8" : "none",
                                            }}
                                        >
                                            {isDone ? "✓" : idx + 1}
                                        </div>
                                        <span style={{ fontSize: "9px", marginTop: "4px", color: textColor, fontWeight: isCurrent ? 700 : 500 }}>
                                            {step.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Live Route Telemetry */}
                        {currentLeg && (
                            <div
                                style={{
                                    background: "#0f172a",
                                    border: "1px solid #334155",
                                    borderRadius: "8px",
                                    padding: "10px 14px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontSize: "12px",
                                }}
                            >
                                <div>
                                    <span style={{ color: "#94a3b8" }}>Current Target:</span>{" "}
                                    <strong style={{ color: "#f8fafc" }}>
                                        {currentLeg.stage === "TO_PATIENT" ? "Patient Incident Location" : activeEmergency.hospital?.name || "Recommended Hospital"}
                                    </strong>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: "14px" }}>
                                        ETA ~{currentLeg.etaMinutes} min
                                    </div>
                                    <div style={{ color: "#94a3b8", fontSize: "11px" }}>{currentLeg.distanceKm} km (A* v{currentLeg.version})</div>
                                </div>
                            </div>
                        )}

                        {/* CONFIRM PICKUP BUTTON (Phase 4 requirement: Enabled when ambulance arrives at scene) */}
                        <div style={{ marginTop: "14px" }}>
                            {activeEmergency.status === "EN_ROUTE_TO_PATIENT" && !isAtPatient && (
                                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                    <button
                                        onClick={handleConfirmPickup}
                                        style={{
                                            flex: 1,
                                            padding: "10px",
                                            background: "#0284c7",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: "8px",
                                            fontWeight: 700,
                                            fontSize: "13px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        🚑 Confirm Patient Pickup & Recommend Hospital
                                    </button>
                                </div>
                            )}

                            {isAtPatient && (
                                <button
                                    onClick={handleConfirmPickup}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        background: "#16a34a",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "8px",
                                        fontWeight: 800,
                                        fontSize: "14px",
                                        cursor: "pointer",
                                        boxShadow: "0 0 15px rgba(22, 163, 74, 0.4)",
                                    }}
                                >
                                    ✅ Paramedics On Scene: Confirm Pickup & Route to Hospital
                                </button>
                            )}

                            {activeEmergency.status === "EN_ROUTE_TO_HOSPITAL" && (
                                <button
                                    onClick={handleCompleteEmergency}
                                    style={{
                                        width: "100%",
                                        padding: "10px",
                                        background: "#059669",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "8px",
                                        fontWeight: 700,
                                        fontSize: "13px",
                                        cursor: "pointer",
                                    }}
                                >
                                    🏥 Complete Admission at Hospital
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* POST-PICKUP HOSPITAL RECOMMENDATION CARD */}
                {hospitalRecommendations && (
                    <div style={{ background: "#1e293b", border: "1px solid #10b981", borderRadius: "12px", padding: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <h4 style={{ margin: 0, color: "#34d399", fontSize: "14px" }}>
                                🏥 Multi-Criteria Hospital Recommendation
                            </h4>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>Weighted Decision Support</span>
                        </div>

                        {/* Top Winner Card */}
                        <div style={{ background: "#064e3b", border: "1px solid #059669", borderRadius: "8px", padding: "10px 12px", marginBottom: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#6ee7b7", textTransform: "uppercase" }}>
                                        ★ Best Hospital Match
                                    </div>
                                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>
                                        {hospitalRecommendations.winner.name}
                                    </div>
                                    <div style={{ fontSize: "11px", color: "#a7f3d0" }}>
                                        ETA: {hospitalRecommendations.winner.etaMinutes} min | Beds: {hospitalRecommendations.winner.availableBeds} | Trauma Level {hospitalRecommendations.winner.traumaLevel}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#34d399" }}>
                                        {hospitalRecommendations.winner.scoreBreakdown.totalScore.toFixed(2)}
                                    </div>
                                    <div style={{ fontSize: "9px", color: "#6ee7b7" }}>Overall Score</div>
                                </div>
                            </div>
                            <div style={{ fontSize: "11px", color: "#d1fae5", marginTop: "6px", fontStyle: "italic" }}>
                                "{hospitalRecommendations.winner.recommendationReason}"
                            </div>
                        </div>

                        {/* Ranked List & Score Breakdown Table */}
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "6px", fontWeight: 600 }}>
                            Comparison of Solapur Hospitals:
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "180px", overflowY: "auto" }}>
                            {hospitalRecommendations.rankedList.map((h) => (
                                <div
                                    key={h.hospitalId}
                                    style={{
                                        background: h.isWinner ? "rgba(16, 185, 129, 0.15)" : "#0f172a",
                                        border: `1px solid ${h.isWinner ? "#10b981" : "#334155"}`,
                                        borderRadius: "6px",
                                        padding: "8px 10px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <div style={{ maxWidth: "65%" }}>
                                        <div style={{ fontWeight: 600, color: h.eligible ? "#f8fafc" : "#94a3b8", fontSize: "11px" }}>
                                            {h.isWinner ? "👑 " : ""}{h.name}
                                        </div>
                                        {h.eligible ? (
                                            <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                                                ETA: {h.etaMinutes}m • {h.specialtyMatched ? "Specialty Match" : "General"} • {h.availableBeds} beds
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: "10px", color: "#ef4444" }}>
                                                ⛔ Excluded: {h.ineligibleReason}
                                            </div>
                                        )}
                                    </div>
                                    {h.eligible ? (
                                        <div style={{ textAlign: "right" }}>
                                            <span style={{ fontWeight: 700, color: h.isWinner ? "#34d399" : "#cbd5e1" }}>
                                                Score: {h.scoreBreakdown.totalScore.toFixed(2)}
                                            </span>
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 700 }}>Ineligible</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* AI TRIAGE & RANKED AMBULANCE CARD (After Submit) */}
                {lastDispatchInfo && (
                    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "18px" }}>🤖</span>
                                <h4 style={{ margin: 0, color: "#c084fc", fontSize: "14px" }}>
                                    AI Emergency Triage Classification
                                </h4>
                            </div>
                            <span
                                style={{
                                    fontSize: "11px",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontWeight: 700,
                                    background: lastDispatchInfo.triage.aiSource === "LLM" ? "rgba(168, 85, 247, 0.2)" : "rgba(14, 165, 233, 0.2)",
                                    color: lastDispatchInfo.triage.aiSource === "LLM" ? "#c084fc" : "#38bdf8",
                                    border: `1px solid ${lastDispatchInfo.triage.aiSource === "LLM" ? "#a855f7" : "#0284c7"}`,
                                }}
                            >
                                {lastDispatchInfo.triage.aiSource === "LLM" ? "AI Triage" : "Rule-based Triage"}
                            </span>
                        </div>

                        <div style={{ background: "#0f172a", borderRadius: "8px", padding: "10px 12px", border: "1px solid #334155", marginBottom: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>Category: <strong style={{ color: "#fff" }}>{lastDispatchInfo.triage.category}</strong></span>
                                <span>
                                    Severity:{" "}
                                    <strong
                                        style={{
                                            color:
                                                lastDispatchInfo.triage.severity >= 4
                                                    ? "#ef4444"
                                                    : lastDispatchInfo.triage.severity === 3
                                                    ? "#f59e0b"
                                                    : "#10b981",
                                        }}
                                    >
                                        Level {lastDispatchInfo.triage.severity}/5
                                    </strong>
                                </span>
                            </div>
                            <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "4px" }}>
                                <strong>Reasoning:</strong> {lastDispatchInfo.triage.reasoning}
                            </div>
                        </div>

                        {/* Ranked Ambulance Comparison Table */}
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px", fontWeight: 600 }}>
                            Ambulance Fleet Evaluation & Dispatch Rationale:
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
                            {lastDispatchInfo.rankedAmbulances.map((amb) => (
                                <div
                                    key={amb.ambulanceId}
                                    style={{
                                        background: amb.isWinner ? "rgba(2, 132, 199, 0.2)" : "#0f172a",
                                        border: `1px solid ${amb.isWinner ? "#0284c7" : "#334155"}`,
                                        borderRadius: "6px",
                                        padding: "8px 10px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        fontSize: "11px",
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 700, color: amb.isWinner ? "#38bdf8" : "#f8fafc" }}>
                                            {amb.isWinner ? "★ SELECTED: " : ""}{amb.code} ({amb.type})
                                        </div>
                                        <div style={{ color: "#94a3b8", fontSize: "10px" }}>
                                            {amb.stationName} • {amb.distanceKm} km • Raw ETA: {amb.rawEtaMinutes}m
                                        </div>
                                        <div style={{ color: amb.isWinner ? "#bae6fd" : "#64748b", fontSize: "10px" }}>
                                            {amb.reason}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                        <div style={{ fontWeight: 800, color: amb.isWinner ? "#38bdf8" : "#cbd5e1" }}>
                                            {amb.effectiveEtaMinutes} min
                                        </div>
                                        <div style={{ fontSize: "9px", color: "#64748b" }}>Effective ETA</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* EMERGENCY INTAKE FORM */}
                <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <h3 style={{ margin: 0, fontSize: "15px", color: "#38bdf8" }}>🚨 Emergency Call Intake</h3>
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>Solapur EMS Dispatch</span>
                    </div>

                    {/* Preset Scenarios Dropdown for Instant Demo */}
                    <div style={{ marginBottom: "14px" }}>
                        <label style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
                            Load Sample Demo Scenario:
                        </label>
                        <select
                            onChange={(e) => {
                                const sc = DEMO_SCENARIOS[Number(e.target.value)];
                                if (sc) handleApplyScenario(sc);
                            }}
                            style={{
                                width: "100%",
                                padding: "7px 10px",
                                background: "#0f172a",
                                color: "#f8fafc",
                                border: "1px solid #475569",
                                borderRadius: "6px",
                                fontSize: "12px",
                            }}
                        >
                            {DEMO_SCENARIOS.map((sc, i) => (
                                <option key={i} value={i}>
                                    {sc.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <form onSubmit={handleSubmitEmergency} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginBottom: "3px" }}>Caller Name</label>
                                <input
                                    type="text"
                                    value={callerName}
                                    onChange={(e) => setCallerName(e.target.value)}
                                    required
                                    style={{ width: "100%", padding: "7px 10px", background: "#0f172a", color: "#fff", border: "1px solid #334155", borderRadius: "6px", fontSize: "12px" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginBottom: "3px" }}>Phone Number</label>
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                    style={{ width: "100%", padding: "7px 10px", background: "#0f172a", color: "#fff", border: "1px solid #334155", borderRadius: "6px", fontSize: "12px" }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginBottom: "3px" }}>
                                Emergency Description (Natural Language Triage)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                required
                                rows={2}
                                style={{ width: "100%", padding: "7px 10px", background: "#0f172a", color: "#fff", border: "1px solid #334155", borderRadius: "6px", fontSize: "12px", resize: "none" }}
                            />
                        </div>

                        <div style={{ background: "#0f172a", padding: "8px 12px", borderRadius: "6px", border: "1px dashed #475569" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                                <span style={{ color: "#94a3b8" }}>Incident Location:</span>
                                <span style={{ color: "#38bdf8", fontWeight: 700 }}>{locationLabel}</span>
                            </div>
                            <div style={{ color: "#64748b", fontSize: "10px", marginTop: "2px" }}>
                                💡 Tip: Click anywhere on the map to pin a custom emergency location
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                marginTop: "6px",
                                padding: "12px",
                                background: "#dc2626",
                                color: "#fff",
                                border: "none",
                                borderRadius: "8px",
                                fontWeight: 800,
                                fontSize: "14px",
                                cursor: "pointer",
                                boxShadow: "0 4px 12px rgba(220, 38, 38, 0.4)",
                            }}
                        >
                            {loading ? "Analyzing Triage & Dispatching..." : "🚨 Dispatch Nearest Emergency Unit"}
                        </button>
                    </form>
                </div>

                {/* TIMELINE OF JOURNEY EVENTS */}
                {activeEmergency?.journeyEvents && activeEmergency.journeyEvents.length > 0 && (
                    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "16px" }}>
                        <h4 style={{ margin: "0 0 10px 0", color: "#94a3b8", fontSize: "13px" }}>
                            ⏱️ Mission Timeline & Audit Log
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "160px", overflowY: "auto" }}>
                            {activeEmergency.journeyEvents.map((ev) => (
                                <div key={ev.id} style={{ display: "flex", gap: "8px", fontSize: "11px" }}>
                                    <span style={{ color: "#64748b", minWidth: "55px" }}>
                                        {new Date(ev.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                    </span>
                                    <span style={{ color: "#cbd5e1" }}>{ev.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT SIDE MAP VIEW (55% width, full height) */}
            <div style={{ flex: 1, height: "100%", position: "relative" }}>
                <MapView
                    nodes={nodes}
                    edges={edges}
                    stations={stations}
                    hospitals={hospitals}
                    ambulances={ambulances}
                    activeLegs={activeLegs}
                    patientLocation={
                        activeEmergency && activeEmergency.status !== "COMPLETED" && activeEmergency.status !== "CANCELLED"
                            ? { lat: activeEmergency.lat, lng: activeEmergency.lng, name: `${activeEmergency.callerName} (Incident Scene)` }
                            : { lat, lng, name: locationLabel }
                    }
                    onMapClick={handleMapClick}
                    onRoadClick={onSelectRoad}
                />
            </div>
        </div>
    );
};

