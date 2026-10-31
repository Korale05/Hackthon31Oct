import React from "react";

interface HeaderProps {
    currentTab: "CONSOLE" | "SIMULATION" | "HISTORY";
    onTabChange: (tab: "CONSOLE" | "SIMULATION" | "HISTORY") => void;
    onOpenHowItWorks: () => void;
    onResetDemo: () => void;
    availableAmbulanceCount: number;
    openHospitalCount: number;
}

export const Header: React.FC<HeaderProps> = ({
    currentTab,
    onTabChange,
    onOpenHowItWorks,
    onResetDemo,
    availableAmbulanceCount,
    openHospitalCount,
}) => {
    return (
        <header style={{ background: "#0f172a", borderBottom: "1px solid #334155", color: "#f8fafc", zIndex: 100 }}>
            {/* MANDATORY PERSISTENT DISCLAIMER BANNER */}
            <div
                style={{
                    background: "linear-gradient(90deg, #991b1b, #b91c1c)",
                    color: "#fef2f2",
                    textAlign: "center",
                    padding: "4px 12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                }}
            >
                <span>⚠️ HACKATHON PROTOTYPE WITH SIMULATED DATA (SOLAPUR REGION). NOT AN OPERATIONAL EMERGENCY SERVICE.</span>
                <span style={{ background: "#fef2f2", color: "#991b1b", padding: "1px 6px", borderRadius: "4px", fontWeight: 800 }}>
                    IN A REAL EMERGENCY CALL 112 / 108
                </span>
            </div>

            {/* MAIN NAVIGATION BAR */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 20px",
                }}
            >
                {/* Brand & Project Identity */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                        style={{
                            background: "linear-gradient(135deg, #ef4444, #dc2626)",
                            width: "36px",
                            height: "36px",
                            borderRadius: "10px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "20px",
                            boxShadow: "0 0 15px rgba(239, 68, 68, 0.5)",
                        }}
                    >
                        🚑
                    </div>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.5px", color: "#fff" }}>
                                LifeLine
                            </span>
                            <span
                                style={{
                                    background: "#1e293b",
                                    color: "#38bdf8",
                                    border: "1px solid #0284c7",
                                    fontSize: "10px",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontWeight: 700,
                                }}
                            >
                                KALPAK-2K26
                            </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                            Intelligent EMS Dispatch, Dynamic Route Prediction & Hospital Recommendation
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div style={{ display: "flex", gap: "6px", background: "#1e293b", padding: "4px", borderRadius: "8px", border: "1px solid #334155" }}>
                    <button
                        onClick={() => onTabChange("CONSOLE")}
                        style={{
                            background: currentTab === "CONSOLE" ? "#0284c7" : "transparent",
                            color: currentTab === "CONSOLE" ? "#fff" : "#94a3b8",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 14px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s",
                        }}
                    >
                        🎮 Dispatch Console
                    </button>

                    <button
                        onClick={() => onTabChange("SIMULATION")}
                        style={{
                            background: currentTab === "SIMULATION" ? "#d97706" : "transparent",
                            color: currentTab === "SIMULATION" ? "#fff" : "#94a3b8",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 14px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s",
                        }}
                    >
                        ⚙️ Simulation & Chaos
                    </button>

                    <button
                        onClick={() => onTabChange("HISTORY")}
                        style={{
                            background: currentTab === "HISTORY" ? "#0284c7" : "transparent",
                            color: currentTab === "HISTORY" ? "#fff" : "#94a3b8",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 14px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s",
                        }}
                    >
                        📋 Incident History
                    </button>
                </div>

                {/* Right Actions & Live Fleet Metrics */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "#94a3b8" }}>
                        <div>
                            Ambulances: <strong style={{ color: "#4ade80" }}>{availableAmbulanceCount} Available</strong>
                        </div>
                        <div>
                            Hospitals: <strong style={{ color: "#38bdf8" }}>{openHospitalCount} Open</strong>
                        </div>
                    </div>

                    <button
                        onClick={onOpenHowItWorks}
                        style={{
                            background: "#334155",
                            color: "#f8fafc",
                            border: "1px solid #475569",
                            borderRadius: "6px",
                            padding: "6px 12px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        💡 How It Works
                    </button>

                    <button
                        onClick={onResetDemo}
                        style={{
                            background: "#4f46e5",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 12px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        🔄 Reset Demo
                    </button>
                </div>
            </div>
        </header>
    );
};

