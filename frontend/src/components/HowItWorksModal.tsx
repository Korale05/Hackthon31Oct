import React from "react";

interface HowItWorksModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                backgroundColor: "rgba(0,0,0,0.75)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: "#1e293b",
                    color: "#f8fafc",
                    maxWidth: "750px",
                    width: "100%",
                    maxHeight: "85vh",
                    overflowY: "auto",
                    borderRadius: "16px",
                    border: "1px solid #475569",
                    padding: "28px",
                    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#38bdf8" }}>
                        🚑 LifeLine System Architecture & Core Algorithms
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#94a3b8",
                            fontSize: "24px",
                            cursor: "pointer",
                            padding: "4px 8px",
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontSize: "14px", lineHeight: "1.6" }}>
                    {/* Algorithm 1 */}
                    <div style={{ background: "#0f172a", padding: "16px", borderRadius: "10px", border: "1px solid #334155" }}>
                        <h3 style={{ margin: "0 0 8px 0", color: "#60a5fa", fontSize: "16px" }}>
                            1. A* Pathfinding with Admissible Haversine Heuristic
                        </h3>
                        <p style={{ margin: 0, color: "#cbd5e1" }}>
                            Calculates the fastest route across Solapur's road network using edge travel time cost:
                            <br />
                            <code style={{ background: "#1e293b", padding: "2px 6px", borderRadius: "4px", color: "#38bdf8" }}>
                                Cost = (DistanceKm / (BaseSpeedKmh / TrafficFactor)) × 60 min
                            </code>
                            <br />
                            <strong>Heuristic Admissibility:</strong>{" "}
                            <code>h(n) = (HaversineKm(n, Goal) / MaxNetworkSpeed) × 60</code>. Because no vehicle can travel faster than the network maximum speed, the heuristic never overestimates true travel time, mathematically guaranteeing optimal shortest-time paths while exploring ~50% fewer nodes than Dijkstra.
                        </p>
                    </div>

                    {/* Algorithm 2 */}
                    <div style={{ background: "#0f172a", padding: "16px", borderRadius: "10px", border: "1px solid #334155" }}>
                        <h3 style={{ margin: "0 0 8px 0", color: "#34d399", fontSize: "16px" }}>
                            2. Capability-Informed Ambulance Selection
                        </h3>
                        <p style={{ margin: 0, color: "#cbd5e1" }}>
                            Evaluates all <strong>AVAILABLE</strong> ambulances from EMS stations across the city:
                            <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
                                <li><strong>Low/Moderate Urgency (Sev 1–3):</strong> Prioritizes Basic Life Support (BLS) units with 0 penalty, preserving Advanced/ICU ambulances for life-threatening crises.</li>
                                <li><strong>Critical Urgency (Sev 4–5):</strong> Favors ICU & Advanced units. A +3.0 min suitability penalty is assigned to basic units so advanced vehicles are dispatched unless significantly farther away.</li>
                            </ul>
                        </p>
                    </div>

                    {/* Algorithm 3 */}
                    <div style={{ background: "#0f172a", padding: "16px", borderRadius: "10px", border: "1px solid #334155" }}>
                        <h3 style={{ margin: "0 0 8px 0", color: "#fbbf24", fontSize: "16px" }}>
                            3. Multi-Criteria Hospital Recommendation (Post-Pickup)
                        </h3>
                        <p style={{ margin: 0, color: "#cbd5e1" }}>
                            Triggered strictly <em>after</em> patient pickup is confirmed on scene.
                            <br />
                            <strong>Hard Filters:</strong> Emergency department must be OPEN and have Available Beds &gt; 0 (and ICU Beds &gt; 0 if ICU required).
                            <br />
                            <strong>Weighted Scoring Formula:</strong>
                            <br />
                            <code style={{ background: "#1e293b", padding: "2px 6px", borderRadius: "4px", color: "#fbbf24" }}>
                                Score = 0.50×ETA + 0.25×SpecialtyMismatch + 0.15×BedPenalty + 0.10×TraumaPenalty
                            </code>
                            <br />
                            <em>For Severity 5 emergencies, ETA weight automatically spikes to 70% because immediate stabilization saves lives.</em>
                        </p>
                    </div>

                    {/* AI Triage */}
                    <div style={{ background: "#0f172a", padding: "16px", borderRadius: "10px", border: "1px solid #334155" }}>
                        <h3 style={{ margin: "0 0 8px 0", color: "#c084fc", fontSize: "16px" }}>
                            4. AI Triage with Autonomous 3s Offline Rule Fallback
                        </h3>
                        <p style={{ margin: 0, color: "#cbd5e1" }}>
                            Utilizes Gemini API to parse natural-language emergency descriptions into structured JSON categories (Cardiac, Trauma, Stroke, Burns, etc.) and severity (1–5).
                            <br />
                            <strong>Resilience Rule:</strong> If venue network is unavailable, API key is unset, or latency exceeds 3 seconds, the system instantly switches to a deterministic medical keyword rule engine. Routing and dispatch remain 100% deterministic and explainable.
                        </p>
                    </div>
                </div>

                <div style={{ marginTop: "24px", textAlign: "right" }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: "#0284c7",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            padding: "10px 24px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        Got It
                    </button>
                </div>
            </div>
        </div>
    );
};

