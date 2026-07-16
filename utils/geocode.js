export async function geocodeAddress(address) {
    if (!address || !address.trim()) return null;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "HomestaysApp/1.0 (contact@yourdomain.com)"
            }
        });
        if (!response.ok) {
            console.error("Geocoding request failed:", response.status);
            return null;
        }
        const results = await response.json();
        if (!results || results.length === 0) {
            return null;
        }
        return {
            lat: parseFloat(results[0].lat),
            lng: parseFloat(results[0].lon)
        };
    } catch (err) {
        console.error("Geocoding error:", err.message);
        return null;
    }
}