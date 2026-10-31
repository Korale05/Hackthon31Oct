import React, { useState } from "react";
import type { Emergency } from "../types.js";

interface HistoryViewProps {
    emergencies: Emergency[];
    onSelectEmergency: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ emergencies, onSelectEmergency }) => {
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [severityFilter, setSeverityFilter] = useState<string>("ALL");
    const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

    const filtered = emergencies.filter((e) => {
        if (statusFilter !== "ALL" && e.status !== statusFilter) return false;
        if (severityFilter !== "ALL" && String(e.severity) !== severityFilter) return false;
        if (categoryFilter !== "ALL" && e.category !== categoryFilter) return false;
        return true;
    });

    const getSeverityBadgeColor = (sev: number) => {
        switch (sev) {
            case 5:
                return "#ef4444";
            case 4:
                return "#f97316";
            case 3:
                return "#eab308";
            case 2:
                return "#3b82f6";
            default:
                return "#10b981";
        }
    };

    return (
        <div style={{ padding: "24px", color: "#f8fafc", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: "22px", color: "#38bdf8" }}>📋 Emergency Dispatch Incident History</h2>
                    <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "13px" }}>
                        Audit trail of all triage classifications, assigned units, and hospital admissions
                    </p>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: "10px" }}>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{ background: "#1e293b", color: "#fff", border: "1px solid #475569", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="EN_ROUTE_TO_PATIENT">En Route to Patient</option>
                        <option value="AT_PATIENT">At Patient</option>
                        <option value="EN_ROUTE_TO_HOSPITAL">En Route to Hospital</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>

                    <select
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                        style={{ background: "#1e293b", color: "#fff", border: "1px solid #475569", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}
                    >
                        <option value="ALL">All Severities</option>
                        <option value="5">Severity 5 (Life-Threatening)</option>
                        <option value="4">Severity 4 (Critical)</option>
                        <option value="3">Severity 3 (Urgent)</option>
                        <option value="2">Severity 2 (Moderate)</option>
                        <option value="1">Severity 1 (Minor)</option>
                    </select>

                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        style={{ background: "#1e293b", color: "#fff", border: "1px solid #475569", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}
                    >
                        <option value="ALL">All Categories</option>
                        <option value="CARDIAC">CARDIAC</option>
                        <option value="TRAUMA">TRAUMA</option>
                        <option value="STROKE">STROKE</option>
                        <option value="BURNS">BURNS</option>
                        <option value="RESPIRATORY">RESPIRATORY</option>
                        <option value="MATERNITY">MATERNITY</option>
                        <option value="PEDIATRIC">PEDIATRIC</option>
                        <option value="GENERAL">GENERAL</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div style={{ background: "#1e293b", borderRadius: "12px", border: "1px solid #334155", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                        <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                            <th style={{ padding: "12px 16px" }}>Time</th>
                            <th style={{ padding: "12px 16px" }}>Caller</th>
                            <th style={{ padding: "12px 16px" }}>Category & Severity</th>
                            <th style={{ padding: "12px 16px" }}>Triage Engine</th>
                            <th style={{ padding: "12px 16px" }}>Assigned Unit</th>
                            <th style={{ padding: "12px 16px" }}>Hospital</th>
                            <th style={{ padding: "12px 16px" }}>Status</th>
                            <th style={{ padding: "12px 16px" }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                                    No emergency incidents found matching current filters.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((item) => (
                                <tr
                                    key={item.id}
                                    style={{
                                        borderBottom: "1px solid #334155",
                                        transition: "background 0.15s",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#243247")}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                    <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>
                                        {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </td>
                                    <td style={{ padding: "12px 16px" }}>
                                        <div style={{ fontWeight: 600, color: "#f8fafc" }}>{item.callerName}</div>
                                        <div style={{ color: "#94a3b8", fontSize: "11px" }}>{item.phone}</div>
                                    </td>
                                    <td style={{ padding: "12px 16px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span style={{ fontWeight: 700 }}>{item.category}</span>
                                            <span
                                                style={{
                                                    background: getSeverityBadgeColor(item.severity),
                                                    color: "#fff",
                                                    borderRadius: "4px",
                                                    padding: "1px 6px",
                                                    fontSize: "10px",
                                                    fontWeight: 700,
                                                }}
                                            >
                                                Sev {item.severity}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: "11px", color: "#94a3b8", maxWidth: "220px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {item.description}
                                        </div>
                                    </td>
                                    <td style={{ padding: "12px 16px" }}>
                                        <span
                                            style={{
                                                fontSize: "11px",
                                                padding: "2px 8px",
                                                borderRadius: "12px",
                                                fontWeight: 600,
                                                background: item.aiSource === "LLM" ? "rgba(168, 85, 247, 0.2)" : "rgba(14, 165, 233, 0.2)",
                                                color: item.aiSource === "LLM" ? "#c084fc" : "#38bdf8",
                                                border: `1px solid ${item.aiSource === "LLM" ? "#a855f7" : "#0284c7"}`,
                                            }}
                                        >
                                            {item.aiSource === "LLM" ? "🤖 AI Triage" : "⚡ Rule-Based"}
                                        </span>
                                    </td>
                                    <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>
                                        {item.ambulance ? (
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{item.ambulance.code}</div>
                                                <div style={{ fontSize: "11px", color: "#94a3b8" }}>{item.ambulance.type}</div>
                                            </div>
                                        ) : (
                                            <span style={{ color: "#64748b" }}>Unassigned</span>
                                        )}
                                    </td>
                                    <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>
                                        {item.hospital ? (
                                            <div style={{ maxWidth: "180px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {item.hospital.name}
                                            </div>
                                        ) : (
                                            <span style={{ color: "#64748b" }}>Pending Pickup</span>
                                        )}
                                    </td>
                                    <td style={{ padding: "12px 16px" }}>
                                        <span
                                            style={{
                                                fontSize: "11px",
                                                fontWeight: 700,
                                                color:
                                                    item.status === "COMPLETED"
                                                        ? "#10b981"
                                                        : item.status === "CANCELLED"
                                                        ? "#ef4444"
                                                        : "#f59e0b",
                                            }}
                                        >
                                            {item.status.replace(/_/g, " ")}
                                        </span>
                                    </td>
                                    <td style={{ padding: "12px 16px" }}>
                                        <button
                                            onClick={() => onSelectEmergency(item.id)}
                                            style={{
                                                background: "#0284c7",
                                                color: "#fff",
                                                border: "none",
                                                borderRadius: "6px",
                                                padding: "6px 12px",
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                cursor: "pointer",
                                            }}
                                        >
                                            View Journey
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

