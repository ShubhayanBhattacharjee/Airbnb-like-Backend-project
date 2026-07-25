export async function verifyPincode(pincode) {
    try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode.trim()}`);
        if (!response.ok) return null; 
        const data = await response.json();
        const result = data?.[0];
        if (!result) return null;
        return result.Status === "Success" && Array.isArray(result.PostOffice) && result.PostOffice.length > 0;
    } catch (err) {
        console.error("Pincode verification error:", err.message);
        return null;
    }
}