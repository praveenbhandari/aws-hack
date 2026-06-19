from __future__ import annotations

from guardian.services.scoring import Hotspot, LatLng

MOCK_HOTSPOTS: list[Hotspot] = [
    {
        "id": "hs-001",
        "lat": 37.7849,
        "lng": -122.4094,
        "category": "ROBBERY",
        "severity": 5,
        "occurredAt": "2015-04-26T03:03:00Z",
        "source": "sfpd",
        "weight": 0.82,
    },
    {
        "id": "hs-002",
        "lat": 37.7785,
        "lng": -122.4258,
        "category": "ASSAULT",
        "severity": 4,
        "occurredAt": "2006-09-25T22:15:00Z",
        "source": "sfpd",
        "weight": 0.71,
    },
    {
        "id": "hs-003",
        "lat": 37.7928,
        "lng": -122.397,
        "category": "LARCENY/THEFT",
        "severity": 3,
        "occurredAt": "2016-06-21T17:27:00Z",
        "source": "sfpd",
        "weight": 0.45,
    },
]

MOCK_POLYLINE: list[LatLng] = [
    {"lat": 37.7955, "lng": -122.3937},
    {"lat": 37.793, "lng": -122.398},
    {"lat": 37.79, "lng": -122.402},
    {"lat": 37.787, "lng": -122.406},
    {"lat": 37.7849, "lng": -122.4094},
]

MOCK_POLYLINE_ALT: list[LatLng] = [
    {"lat": 37.7955, "lng": -122.3937},
    {"lat": 37.797, "lng": -122.401},
    {"lat": 37.792, "lng": -122.408},
    {"lat": 37.788, "lng": -122.412},
    {"lat": 37.7849, "lng": -122.4094},
]

SF_CENTER: LatLng = {"lat": 37.7749, "lng": -122.4194}


def mock_hotspots(lat: float, lng: float, radius: float) -> dict:
    return {
        "center": {"lat": lat, "lng": lng},
        "radiusMeters": radius,
        "count": len(MOCK_HOTSPOTS),
        "hotspots": MOCK_HOTSPOTS,
    }


def mock_safety_score(lat: float, lng: float, radius_meters: float) -> dict:
    return {
        "lat": lat,
        "lng": lng,
        "radiusMeters": radius_meters,
        "safetyScore": 68,
        "riskLevel": "moderate",
        "hotspotCount": 3,
        "topHotspots": MOCK_HOTSPOTS[:3],
        "explanation": (
            "This area has moderate incident history — mostly thefts and a few assault reports nearby. "
            "Stay alert after dark."
        ),
    }


def mock_safe_routes() -> dict:
    routes = [
        {
            "id": "route_0",
            "summary": "Embarcadero via Market St",
            "polyline": MOCK_POLYLINE,
            "encodedPolyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
            "distanceMeters": 1420,
            "durationSeconds": 1020,
            "safetyScore": 78,
            "riskLevel": "moderate",
            "hotspotExposure": 1.2,
            "avoidedHotspots": [MOCK_HOTSPOTS[0]],
            "explanation": (
                "This route avoids the densest hotspot cluster near Mission St and scores 78 out of 100 for safety."
            ),
        },
        {
            "id": "route_1",
            "summary": "Via Folsom St",
            "polyline": MOCK_POLYLINE_ALT,
            "encodedPolyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
            "distanceMeters": 1680,
            "durationSeconds": 1200,
            "safetyScore": 85,
            "riskLevel": "low",
            "hotspotExposure": 0.7,
            "avoidedHotspots": MOCK_HOTSPOTS[:2],
            "explanation": (
                "The Folsom St alternative passes fewer high-severity incidents and is the safest option at 85 out of 100."
            ),
        },
    ]
    routes.sort(key=lambda r: r["safetyScore"], reverse=True)
    routes[0]["navigationCues"] = [
        {
            "segment": "departure",
            "lat": routes[0]["polyline"][0]["lat"],
            "lng": routes[0]["polyline"][0]["lng"],
            "heading": 90,
            "streetViewAvailable": False,
            "description": (
                "You're starting on a busy waterfront promenade with wide sidewalks and good visibility."
            ),
        }
    ]
    routes[0]["navigationSummary"] = routes[0]["navigationCues"][0]["description"]
    return {
        "origin": {"lat": 37.7955, "lng": -122.3937, "address": "Ferry Building, San Francisco, CA"},
        "destination": {"lat": 37.7849, "lng": -122.4094, "address": "Mission Dolores Park area"},
        "mode": "walking",
        "routes": routes,
    }


def mock_vapi_tool_result(tool_name: str) -> dict:
    if tool_name == "get_hotspots":
        data = mock_hotspots(SF_CENTER["lat"], SF_CENTER["lng"], 500)
        return {
            "result": __import__("json").dumps(data),
            "message": f"Found {data['count']} hotspots within 500 meters.",
        }
    if tool_name == "score_safety":
        data = mock_safety_score(SF_CENTER["lat"], SF_CENTER["lng"], 300)
        return {
            "result": __import__("json").dumps(data),
            "message": f"Safety score is {data['safetyScore']} out of 100 ({data['riskLevel']} risk).",
        }
    data = mock_safe_routes()
    return {
        "result": __import__("json").dumps(data),
        "message": f"Found {len(data['routes'])} routes. Safest scores {data['routes'][0]['safetyScore']} out of 100.",
    }
