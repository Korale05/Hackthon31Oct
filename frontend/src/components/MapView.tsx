import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RoadNode, RoadEdge, AmbulanceStation, Hospital, Ambulance, RouteLeg } from "../types.js";

interface MapViewProps {
    nodes: RoadNode[];
    edges: RoadEdge[];
    stations: AmbulanceStation[];
    hospitals: Hospital[];
    ambulances: Ambulance[];
    activeLegs?: RouteLeg[];
    patientLocation?: { lat: number; lng: number; name?: string } | null;
    onMapClick?: (lat: number, lng: number) => void;
    onRoadClick?: (edge: RoadEdge) => void;
}

export const MapView: React.FC<MapViewProps> = ({
    nodes,
    edges,
    stations,
    hospitals,
    ambulances,
    activeLegs = [],
    patientLocation,
    onMapClick,
    onRoadClick,
}) => {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const layerGroupRef = useRef<L.LayerGroup | null>(null);

    // Initialize Map once
    useEffect(() => {
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        // Centered over Solapur city
        const map = L.map(mapContainerRef.current, {
            center: [17.6599, 75.9064],
            zoom: 13,
            zoomControl: false,
        });

        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Tile layer from OpenStreetMap with smooth error fallback
        const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "© OpenStreetMap contributors",
        });

        tileLayer.addTo(map);

        const layerGroup = L.layerGroup().addTo(map);
        layerGroupRef.current = layerGroup;
        mapInstanceRef.current = map;

        map.on("click", (e: L.LeafletMouseEvent) => {
            if (onMapClick) {
                onMapClick(parseFloat(e.latlng.lat.toFixed(4)), parseFloat(e.latlng.lng.toFixed(4)));
            }
        });

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    // Update layers whenever data changes
    useEffect(() => {
        const layerGroup = layerGroupRef.current;
        if (!layerGroup) return;

        layerGroup.clearLayers();

        const nodeMap = new Map<string, RoadNode>();
        for (const n of nodes) {
            nodeMap.set(n.id, n);
        }

        // 1. Draw Road Edges
        for (const edge of edges) {
            const from = nodeMap.get(edge.fromNodeId);
            const to = nodeMap.get(edge.toNodeId);
            if (!from || !to) continue;

            let color = "#64748b"; // default road
            let weight = 3;
            let dashArray: string | undefined = undefined;

            if (edge.isBlocked) {
                color = "#ef4444"; // Blocked road: Red
                weight = 5;
                dashArray = "6, 8";
            } else if (edge.trafficFactor >= 2.0) {
                color = "#f97316"; // Heavy traffic: Orange
                weight = 4;
            }

            const polyline = L.polyline(
                [
                    [from.lat, from.lng],
                    [to.lat, to.lng],
                ],
                {
                    color,
                    weight,
                    opacity: edge.isBlocked ? 0.9 : 0.65,
                    dashArray,
                }
            );

            polyline.bindTooltip(
                `<b>${from.name} ↔ ${to.name}</b><br/>Speed: ${edge.baseSpeedKmh} km/h | Traffic: ${edge.trafficFactor}x | ${
                    edge.isBlocked ? "<span style='color:red;font-weight:bold'>BLOCKED</span>" : "Clear"
                }`,
                { sticky: true }
            );

            polyline.on("click", (e) => {
                L.DomEvent.stopPropagation(e);
                if (onRoadClick) onRoadClick(edge);
            });

            polyline.addTo(layerGroup);
        }

        // 2. Draw Active Route Legs (Stage 1 in Blue, Stage 2 in Emerald)
        for (const leg of activeLegs) {
            if (!leg.isActive) continue;
            const rawPath = leg.pathNodeIds;
            const pathNodeIds: string[] = Array.isArray(rawPath)
                ? rawPath
                : typeof rawPath === "string"
                ? JSON.parse(rawPath)
                : [];
            const routePoints: L.LatLngExpression[] = [];

            for (const nid of pathNodeIds) {
                const n = nodeMap.get(nid);
                if (n) routePoints.push([n.lat, n.lng]);
            }

            if (routePoints.length > 1) {
                const isToHospital = leg.stage === "TO_HOSPITAL";
                const routeColor = isToHospital ? "#10b981" : "#2563eb"; // Green vs Blue

                // Shadow path for high visibility
                L.polyline(routePoints, {
                    color: "#000",
                    weight: 8,
                    opacity: 0.35,
                }).addTo(layerGroup);

                // Main route polyline
                const activePoly = L.polyline(routePoints, {
                    color: routeColor,
                    weight: 6,
                    opacity: 0.95,
                    dashArray: isToHospital ? undefined : "8, 6",
                });

                activePoly.bindTooltip(
                    `<b>Stage: ${leg.stage.replace("_", " ")}</b><br/>ETA: ${leg.etaMinutes} min | Distance: ${leg.distanceKm} km<br/>Algo: ${leg.algorithm} (v${leg.version})`,
                    { sticky: true }
                );

                activePoly.addTo(layerGroup);
            }
        }

        // 3. Draw Road Nodes
        for (const node of nodes) {
            const marker = L.circleMarker([node.lat, node.lng], {
                radius: 4,
                fillColor: "#334155",
                color: "#f8fafc",
                weight: 1.5,
                fillOpacity: 0.9,
            });

            marker.bindTooltip(`<b>${node.name}</b><br/>ID: ${node.id}`, { direction: "top" });
            marker.on("click", (e) => {
                L.DomEvent.stopPropagation(e);
                if (onMapClick) onMapClick(node.lat, node.lng);
            });
            marker.addTo(layerGroup);
        }

        // 4. Draw Ambulance Stations
        for (const st of stations) {
            const stationIcon = L.divIcon({
                className: "custom-station-icon",
                html: `<div style="background:#1e40af;color:#fff;border:2px solid #fff;border-radius:8px;padding:3px 6px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:3px;box-shadow:0 3px 8px rgba(0,0,0,0.3);">
                        🚑 EMS
                       </div>`,
                iconSize: [58, 26],
                iconAnchor: [29, 13],
            });

            const stMarker = L.marker([st.lat, st.lng], { icon: stationIcon });
            stMarker.bindPopup(`<b>${st.name}</b><br/>Station ID: ${st.id}`);
            stMarker.addTo(layerGroup);
        }

        // 5. Draw Hospitals
        for (const h of hospitals) {
            let bgColor = "#16a34a"; // Green: Available
            if (!h.emergencyOpen) bgColor = "#64748b"; // Closed: Gray
            else if (h.availableBeds === 0) bgColor = "#dc2626"; // Full: Red

            const hospIcon = L.divIcon({
                className: "custom-hospital-icon",
                html: `<div style="background:${bgColor};color:#fff;border:2px solid #fff;border-radius:8px;padding:3px 6px;font-size:11px;font-weight:700;box-shadow:0 3px 8px rgba(0,0,0,0.3);text-align:center;">
                        🏥 ${h.availableBeds} beds
                       </div>`,
                iconSize: [68, 26],
                iconAnchor: [34, 13],
            });

            const hMarker = L.marker([h.lat, h.lng], { icon: hospIcon });
            hMarker.bindPopup(`
                <div style="font-family:sans-serif;font-size:12px;">
                    <b style="font-size:13px;color:#0f172a;">${h.name}</b><br/>
                    <b>Status:</b> ${h.emergencyOpen ? "<span style='color:green'>OPEN</span>" : "<span style='color:red'>CLOSED</span>"}<br/>
                    <b>Available Beds:</b> ${h.availableBeds} / ${h.totalBeds} (ICU: ${h.icuBeds})<br/>
                    <b>Trauma Level:</b> Level ${h.traumaLevel}<br/>
                    <b>Specialties:</b> ${h.specialties.join(", ")}
                </div>
            `);
            hMarker.addTo(layerGroup);
        }

        // 6. Draw Ambulances (with live dynamic coordinates)
        for (const amb of ambulances) {
            const isAvailable = amb.status === "AVAILABLE";
            const isEnRoute =
                amb.status === "EN_ROUTE_TO_PATIENT" ||
                amb.status === "TRANSPORTING" ||
                amb.status === "AT_PATIENT";

            const borderAnim = isEnRoute
                ? "border:2px solid #ef4444;box-shadow:0 0 12px #ef4444;animation:pulse 1.5s infinite;"
                : "border:2px solid #fff;";

            const bgBadge = isAvailable ? "#22c55e" : isEnRoute ? "#f59e0b" : "#64748b";

            const ambIcon = L.divIcon({
                className: "custom-amb-icon",
                html: `<div style="background:${bgBadge};color:#fff;${borderAnim}border-radius:6px;padding:2px 5px;font-size:10px;font-weight:bold;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4);">
                        🚑 ${amb.code.split("-").pop()} (${amb.type})
                       </div>`,
                iconSize: [75, 22],
                iconAnchor: [37, 11],
            });

            const ambMarker = L.marker([amb.lat, amb.lng], { icon: ambIcon });
            ambMarker.bindPopup(`
                <div style="font-family:sans-serif;font-size:12px;">
                    <b>Ambulance:</b> ${amb.code} (${amb.type})<br/>
                    <b>Status:</b> <span style="font-weight:bold;color:${bgBadge}">${amb.status}</span><br/>
                    <b>Base Station:</b> ${amb.station?.name || "Depot"}<br/>
                    <b>Current Node:</b> ${amb.currentNodeId}
                </div>
            `);
            ambMarker.addTo(layerGroup);
        }

        // 7. Draw Patient Emergency Beacon
        if (patientLocation) {
            const patientIcon = L.divIcon({
                className: "patient-beacon",
                html: `<div style="position:relative;width:24px;height:24px;">
                        <div style="position:absolute;width:24px;height:24px;background:#ef4444;border-radius:50%;opacity:0.4;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
                        <div style="position:absolute;top:4px;left:4px;width:16px;height:16px;background:#dc2626;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:bold;">🚨</div>
                       </div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            });

            const pMarker = L.marker([patientLocation.lat, patientLocation.lng], { icon: patientIcon });
            pMarker.bindPopup(`<b>Emergency Location</b><br/>${patientLocation.name || "Incident Scene"}`);
            pMarker.addTo(layerGroup);
        }
    }, [nodes, edges, stations, hospitals, ambulances, activeLegs, patientLocation]);

    return (
        <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "450px", background: "#0f172a" }}>
            <div ref={mapContainerRef} style={{ width: "100%", height: "100%", zIndex: 1 }} />

            {/* Map Legend Overlay */}
            <div
                style={{
                    position: "absolute",
                    bottom: 16,
                    left: 16,
                    zIndex: 1000,
                    background: "rgba(15, 23, 42, 0.92)",
                    backdropFilter: "blur(6px)",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    color: "#f8fafc",
                    fontSize: "11px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                    pointerEvents: "none",
                }}
            >
                <div style={{ fontWeight: 700, marginBottom: "6px", color: "#38bdf8", letterSpacing: "0.5px" }}>
                    MAP TOPOLOGY & ROUTING
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: 14, height: 4, background: "#2563eb", borderRadius: 2 }}></span>
                        <span>Stage 1: To Patient</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: 14, height: 4, background: "#10b981", borderRadius: 2 }}></span>
                        <span>Stage 2: To Hospital</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: 14, height: 4, borderTop: "2px dashed #ef4444" }}></span>
                        <span>Blocked Road</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: 14, height: 4, background: "#f97316", borderRadius: 2 }}></span>
                        <span>Congested (Traffic)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

