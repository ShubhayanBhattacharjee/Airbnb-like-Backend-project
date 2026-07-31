export async function geocodeAddress(addressInput) {
    if (!addressInput) return null;
    const isStructured = typeof addressInput === 'object';
    let attempts;
    if (isStructured) {
        const { addressLine1, addressLine2, city, state, pincode, country } = addressInput;
        attempts = [
            [addressLine1, addressLine2, city, state, pincode, country],
            [addressLine2, city, state, pincode, country],
            [city, state, pincode, country],
            [city, state, country],
            [state, country]
        ].map(parts => parts.filter(Boolean).join(', '));
    } else {
        attempts = [addressInput];
    }
    attempts = [...new Set(attempts.filter(a => a && a.trim()))];
    for (const query of attempts) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
            const response = await fetch(url, {
                headers: { "User-Agent": "RooviaApp/1.0 (contact@yourdomain.com)" }
            });
            if (!response.ok) {
                console.error("Geocoding request failed:", response.status, "for query:", query);
                continue;
            }
            const results = await response.json();
            if (results && results.length > 0) {
                return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
            }
            await new Promise(r => setTimeout(r, 1100)); 
        } catch (err) {
            console.error("Geocoding error:", err.message, "for query:", query);
        }
    }
    return null;
}