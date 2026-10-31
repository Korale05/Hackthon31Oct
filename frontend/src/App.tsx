import React, { useEffect, useState, useCallback } from "react";
import type { RoadNode, RoadEdge, AmbulanceStation, Hospital, Ambulance, Emergency, RouteLeg, HospitalCandidate } from "./types.js";
import { fetchMapGraph, fetchEmergencies, fetchEmergencyById, resetSimulation } from "./api.js";
import { Header } from "./components/Header.js";
import { DispatchConsole } from "./components/DispatchConsole.js";
import { SimulationPanel } from "./components/SimulationPanel.js";
import { HistoryView } from "./components/HistoryView.js";
import { HowItWorksModal } from "./components/HowItWorksModal.js";
import { MapView } from "./components/MapView.js";

export const App: React.FC = () => {
    // Navigation state
    const [currentTab, setCurrentTab] = useState<"CONSOLE" | "SIMULATION" | "HISTORY">("CONSOLE");
    const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

    // Topology & Fleet state
    const [nodes, setNodes] = useState<RoadNode[]>([]);
    const [edges, setEdges] = useState<RoadEdge[]>([]);
    const [stations, setStations] = useState<AmbulanceStation[]>([]);
    const [hospitals, setHospitals] = useState<Hospital[]>([]);
    const [ambulances, setAmbulances] = useState<Ambulance[]>([]);

    // Emergency tracking state
    const [emergencies, setEmergencies] = useState<Emergency[]>([]);
    const [activeEmergencyId, setActiveEmergencyId] = useState<string | null>(null);
    const [activeEmergency, setActiveEmergency] = useState<Emergency | null>(null);
    const [activeLegs, setActiveLegs] = useState<RouteLeg[]>([]);
    const [hospitalRecommendations, setHospitalRecommendations] = useState<{
        winner: HospitalCandidate;
        rankedList: HospitalCandidate[];
    } | null>(null);

    // Selected road for quick click inspection
    const [selectedRoadEdge, setSelectedRoadEdge] = useState<RoadEdge | null>(null);

    // Initial Data Fetch
    const refreshData = useCallback(async () => {
        try {
            const [graph, emList] = await Promise.all([fetchMapGraph(), fetchEmergencies()]);
            setNodes(graph.nodes);
            setEdges(graph.edges);
            setStations(graph.stations);
            setHospitals(graph.hospitals);
            setAmbulances(graph.ambulances);
            setEmergencies(emList);

            // Auto-select the most recent active emergency if none selected
            if (!activeEmergencyId && emList.length > 0) {
                const firstActive = emList.find(
                    (e) => e.status !== "COMPLETED" && e.status !== "CANCELLED"
                );
                if (firstActive) {
                    setActiveEmergencyId(firstActive.id);
                }
            }
        } catch (err) {
            console.error("Failed to refresh live data:", err);
        }
    }, [activeEmergencyId]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    // Live Polling every 1 second for real-time ambulance animation and route recalculations
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const graph = await fetchMapGraph();
                setEdges(graph.edges);
                setAmbulances(graph.ambulances);
                setHospitals(graph.hospitals);

                if (activeEmergencyId) {
                    const detail = await fetchEmergencyById(activeEmergencyId);
                    setActiveEmergency(detail.emergency);

                    const legs = detail.emergency.routeLegs?.filter((l) => l.isActive) || [];
                    setActiveLegs(legs);

                    if (detail.hospitalRecommendations) {
                        setHospitalRecommendations(detail.hospitalRecommendations as any);
                    }
                }
            } catch (err) {
                // Ignore transient polling glitches
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [activeEmergencyId]);

    // When an emergency is created from the console
    const handleEmergencyCreated = (emergency: Emergency) => {
        setActiveEmergencyId(emergency.id);
        setActiveEmergency(emergency);
        refreshData();
    };

    // When selecting an emergency from history
    const handleSelectEmergencyFromHistory = (id: string) => {
        setActiveEmergencyId(id);
        setCurrentTab("CONSOLE");
    };

    // Reset Demo
    const handleResetDemo = async () => {
        if (!window.confirm("Reset all Solapur simulation data to default seed?")) return;
        try {
            await resetSimulation();
            setActiveEmergencyId(null);
            setActiveEmergency(null);
            setActiveLegs([]);
            setHospitalRecommendations(null);
            await refreshData();
        } catch (err: any) {
            alert(`Reset error: ${err.message}`);
        }
    };

    const availableCount = ambulances.filter((a) => a.status === "AVAILABLE").length;
    const openHospCount = hospitals.filter((h) => h.emergencyOpen && h.availableBeds > 0).length;

    return (
        <div style={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", overflow: "hidden", background: "#0b0f19" }}>
            {/* Header */}
            <Header
                currentTab={currentTab}
                onTabChange={setCurrentTab}
                onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
                onResetDemo={handleResetDemo}
                availableAmbulanceCount={availableCount}
                openHospitalCount={openHospCount}
            />

            {/* Main Content Area */}
            <main style={{ flex: 1, height: "calc(100vh - 84px)", position: "relative", overflow: "hidden" }}>
                {currentTab === "CONSOLE" && (
                    <DispatchConsole
                        nodes={nodes}
                        edges={edges}
                        stations={stations}
                        hospitals={hospitals}
                        ambulances={ambulances}
                        activeEmergency={activeEmergency}
                        activeLegs={activeLegs}
                        hospitalRecommendations={hospitalRecommendations}
                        onEmergencyCreated={handleEmergencyCreated}
                        onRefresh={refreshData}
                        onSelectRoad={(edge) => {
                            setSelectedRoadEdge(edge);
                            setCurrentTab("SIMULATION");
                        }}
                    />
                )}

                {currentTab === "SIMULATION" && (
                    <div style={{ display: "flex", width: "100%", height: "100%" }}>
                        <div style={{ width: "420px", height: "100%", borderRight: "1px solid #334155" }}>
                            <SimulationPanel
                                edges={edges}
                                nodes={nodes}
                                ambulances={ambulances}
                                hospitals={hospitals}
                                onDataUpdated={refreshData}
                                onClose={() => setCurrentTab("CONSOLE")}
                            />
                        </div>
                        <div style={{ flex: 1, height: "100%" }}>
                            <MapView
                                nodes={nodes}
                                edges={edges}
                                stations={stations}
                                hospitals={hospitals}
                                ambulances={ambulances}
                                activeLegs={activeLegs}
                                onRoadClick={(edge) => {
                                    if (selectedRoadEdge?.id === edge.id) {
                                        setSelectedRoadEdge(null);
                                    } else {
                                        setSelectedRoadEdge(edge);
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}

                {currentTab === "HISTORY" && (
                    <HistoryView
                        emergencies={emergencies}
                        onSelectEmergency={handleSelectEmergencyFromHistory}
                    />
                )}
            </main>

            {/* How It Works Modal */}
            <HowItWorksModal
                isOpen={isHowItWorksOpen}
                onClose={() => setIsHowItWorksOpen(false)}
            />
        </div>
    );
};

export default App;
